import {
  MappingRule,
  TransactionRow,
  MatchedPair,
  DuplicateGroup,
  DuplicateSummary,
  DuplicateStrategy,
  GroupMatch,
} from '../types';
import { getRowSignature, describeRow, evaluateMatch, evaluateRule, normalizeNumeric } from './reconcile';
import { NUMERIC_EPSILON } from './constants';

export interface EngineInput {
  bankData: TransactionRow[];
  erpData: TransactionRow[];
  rules: MappingRule[];
  duplicateStrategy: DuplicateStrategy;
}

export interface EngineOutput {
  matched: MatchedPair[];
  unmatchedBank: TransactionRow[];
  unmatchedERP: TransactionRow[];
  duplicateGroups: DuplicateGroup[];
  duplicateSummary: { bank: DuplicateSummary; erp: DuplicateSummary };
  progress: number;
  bankMatchRate: number;
  erpMatchRate: number;
  fuzzyCount: number;
  fuzzySkipped: boolean;
  groupMatched: GroupMatch[];
}

/** Cap on leftover comparisons for the tolerant second pass. */
export const FUZZY_CAP = 4_000_000;
/** Max rows on the "many" side of a one-to-many group. */
export const MAX_GROUP = 4;
/** Skip the group pass if the leftover set is larger than this. */
export const GROUP_LEFTOVER_CAP = 4_000;

/** Returns the indices of a subset of `values` (size 2..maxSize) that sums to target. */
const subsetSum = (values: number[], target: number, tol: number, maxSize: number): number[] | null => {
  const n = values.length;
  const pick: number[] = [];
  const dfs = (start: number, remaining: number, depth: number): number[] | null => {
    if (pick.length >= 2 && Math.abs(remaining) <= tol) return [...pick];
    if (depth === 0) return null;
    for (let i = start; i < n; i++) {
      pick.push(i);
      const hit = dfs(i + 1, remaining - values[i], depth - 1);
      if (hit) return hit;
      pick.pop();
    }
    return null;
  };
  return dfs(0, target, maxSize);
};

const rate = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);

const groupBySignature = (rows: TransactionRow[], rules: MappingRule[], side: 'bank' | 'erp') => {
  const bySig = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const sig = getRowSignature(row, rules, side);
    const bucket = bySig.get(sig);
    if (bucket) bucket.push(row);
    else bySig.set(sig, [row]);
  }
  return bySig;
};

const summarise = (bySig: Map<string, TransactionRow[]>): DuplicateSummary => {
  let groups = 0;
  let extras = 0;
  for (const bucket of bySig.values()) {
    if (bucket.length > 1) { groups += 1; extras += bucket.length - 1; }
  }
  return { groups, extras };
};

const collectGroups = (bySig: Map<string, TransactionRow[]>, rules: MappingRule[], side: 'bank' | 'erp') => {
  const out: DuplicateGroup[] = [];
  for (const bucket of bySig.values()) {
    if (bucket.length > 1) out.push({ side, label: describeRow(bucket[0], rules, side), rows: bucket });
  }
  return out;
};

/**
 * Two-pass reconciliation:
 *   1. exact — signature bucket lookup, honouring the duplicate strategy
 *   2. fuzzy — only when a rule has real tolerance and the leftover set is small enough;
 *      brute-force tolerant scan over what pass 1 left behind
 *
 * `onProgress` receives 0–100 and is called between phases and periodically during pass 1.
 */
export function runReconciliation(
  input: EngineInput,
  onProgress?: (pct: number) => void
): EngineOutput {
  const { bankData, erpData, rules, duplicateStrategy } = input;
  const report = (p: number) => onProgress?.(Math.max(0, Math.min(100, Math.round(p))));

  const bankItems = bankData;
  const erpItems = erpData;
  const bankTotal = bankItems.length;
  const erpTotal = erpItems.length;

  const bankBySig = groupBySignature(bankItems, rules, 'bank');
  const erpBySig = groupBySignature(erpItems, rules, 'erp');

  const duplicateSummary = { bank: summarise(bankBySig), erp: summarise(erpBySig) };
  const duplicateGroups = [
    ...collectGroups(bankBySig, rules, 'bank'),
    ...collectGroups(erpBySig, rules, 'erp'),
  ];
  report(5);

  if (bankTotal === 0) {
    return {
      matched: [], unmatchedBank: [], unmatchedERP: [...erpItems],
      duplicateGroups, duplicateSummary,
      progress: 0, bankMatchRate: 0, erpMatchRate: 0, fuzzyCount: 0, fuzzySkipped: false, groupMatched: [],
    };
  }

  // ----- pass 1: exact ------------------------------------------------------
  const poisoned = new Set<string>();
  if (duplicateStrategy === 'all-unmatched') {
    for (const [sig, b] of bankBySig) if (b.length > 1) poisoned.add(sig);
    for (const [sig, b] of erpBySig) if (b.length > 1) poisoned.add(sig);
  }

  const erpBuckets = new Map<string, TransactionRow[]>();
  const heldOutErp: TransactionRow[] = [];
  for (const [sig, bucket] of erpBySig) {
    if (poisoned.has(sig)) heldOutErp.push(...bucket);
    else erpBuckets.set(sig, [...bucket]);
  }

  const matched: MatchedPair[] = [];
  let unmatchedBank: TransactionRow[] = [];

  for (let i = 0; i < bankTotal; i++) {
    const bankRow = bankItems[i];
    const sig = getRowSignature(bankRow, rules, 'bank');
    const bucket = poisoned.has(sig) ? undefined : erpBuckets.get(sig);
    if (bucket && bucket.length > 0) {
      matched.push({ bank: bankRow, erp: bucket.shift()!, kind: 'exact' });
      if (bucket.length === 0) erpBuckets.delete(sig);
    } else {
      unmatchedBank.push(bankRow);
    }
    if ((i & 1023) === 0) report(5 + (i / bankTotal) * 75);
  }

  let unmatchedERP: TransactionRow[] = [...heldOutErp];
  for (const bucket of erpBuckets.values()) unmatchedERP.push(...bucket);
  report(80);

  // ----- pass 2: fuzzy ----------------------------------------------------
  let fuzzyCount = 0;
  let fuzzySkipped = false;
  const hasTolerance = rules.some(r => r.tolerance && r.tolerance.kind !== 'exact');

  if (hasTolerance && unmatchedBank.length > 0 && unmatchedERP.length > 0) {
    if (unmatchedBank.length * unmatchedERP.length > FUZZY_CAP) {
      fuzzySkipped = true;
    } else {
      const erpTaken = new Set<number>();
      const stillUnmatchedBank: TransactionRow[] = [];
      for (let bi = 0; bi < unmatchedBank.length; bi++) {
        const bankRow = unmatchedBank[bi];
        let hit = -1;
        for (let ei = 0; ei < unmatchedERP.length; ei++) {
          if (erpTaken.has(ei)) continue;
          if (evaluateMatch(bankRow, unmatchedERP[ei], rules)) { hit = ei; break; }
        }
        if (hit >= 0) {
          erpTaken.add(hit);
          matched.push({ bank: bankRow, erp: unmatchedERP[hit], kind: 'fuzzy' });
          fuzzyCount += 1;
        } else {
          stillUnmatchedBank.push(bankRow);
        }
        if ((bi & 255) === 0) report(80 + (bi / unmatchedBank.length) * 18);
      }
      unmatchedBank = stillUnmatchedBank;
      unmatchedERP = unmatchedERP.filter((_, ei) => !erpTaken.has(ei));
    }
  }

  // ----- pass 3: one-to-many (split payments / batches) -------------------
  const groupMatched: GroupMatch[] = [];
  const primaryNumeric = rules.find(r => r.comparisonMode === 'numeric');
  const otherRules = rules.filter(r => r !== primaryNumeric);
  const groupTol =
    primaryNumeric?.tolerance?.kind === 'amount' ? Math.abs(primaryNumeric.tolerance.value) : NUMERIC_EPSILON;
  const canGroup =
    !!primaryNumeric &&
    unmatchedBank.length > 0 &&
    unmatchedERP.length > 0 &&
    unmatchedBank.length + unmatchedERP.length <= GROUP_LEFTOVER_CAP;

  if (canGroup && primaryNumeric) {
    const numOf = (row: TransactionRow, side: 'bank' | 'erp') =>
      normalizeNumeric(String(row[side === 'bank' ? primaryNumeric.bankColumn : primaryNumeric.erpColumn] ?? ''));

    const runDirection = (anchorSide: 'bank' | 'erp') => {
      const anchors = anchorSide === 'bank' ? unmatchedBank : unmatchedERP;
      const manySide: 'bank' | 'erp' = anchorSide === 'bank' ? 'erp' : 'bank';
      const pool = manySide === 'bank' ? unmatchedBank : unmatchedERP;
      const poolTaken = new Set<number>();
      const keptAnchors: TransactionRow[] = [];

      for (const anchor of anchors) {
        const target = numOf(anchor, anchorSide);
        if (target === null) { keptAnchors.push(anchor); continue; }

        const candIdx: number[] = [];
        for (let i = 0; i < pool.length && candIdx.length < 30; i++) {
          if (poolTaken.has(i)) continue;
          const many = pool[i];
          const bankRow = anchorSide === 'bank' ? anchor : many;
          const erpRow = anchorSide === 'bank' ? many : anchor;
          if (otherRules.every(r =>
            evaluateRule(r, String(bankRow[r.bankColumn] ?? ''), String(erpRow[r.erpColumn] ?? ''))
          )) candIdx.push(i);
        }
        const values = candIdx.map(i => numOf(pool[i], manySide) ?? NaN);
        if (values.some(Number.isNaN)) { keptAnchors.push(anchor); continue; }

        const hit = subsetSum(values, target, groupTol, MAX_GROUP);
        if (hit) {
          const picked = hit.map(k => candIdx[k]);
          picked.forEach(i => poolTaken.add(i));
          groupMatched.push({ anchorSide, anchor, group: picked.map(i => pool[i]) });
        } else {
          keptAnchors.push(anchor);
        }
      }

      const remainingMany = pool.filter((_, i) => !poolTaken.has(i));
      if (anchorSide === 'bank') { unmatchedBank = keptAnchors; unmatchedERP = remainingMany; }
      else { unmatchedERP = keptAnchors; unmatchedBank = remainingMany; }
    };

    runDirection('bank');
    if (unmatchedBank.length > 0 && unmatchedERP.length > 0) runDirection('erp');
  }

  report(100);
  // Each grouped row (anchor + its group) counts once toward the match rate.
  const groupRowCount = groupMatched.reduce((n, g) => n + 1 + g.group.length, 0);
  const matchedCount = matched.length + groupRowCount;
  const combined = bankTotal + erpTotal;
  return {
    matched,
    unmatchedBank,
    unmatchedERP,
    duplicateGroups,
    duplicateSummary,
    progress: combined > 0 ? Math.round((matchedCount * 2 * 100) / combined) : 0,
    bankMatchRate: rate(matchedCount, bankTotal),
    erpMatchRate: rate(matchedCount, erpTotal),
    fuzzyCount,
    fuzzySkipped,
    groupMatched,
  };
}
