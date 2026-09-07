import {
  MappingRule,
  TransactionRow,
  MatchedPair,
  DuplicateGroup,
  DuplicateSummary,
  DuplicateStrategy,
} from '../types';
import { getRowSignature, describeRow, evaluateMatch } from './reconcile';

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
}

/** Cap on leftover comparisons for the tolerant second pass. */
export const FUZZY_CAP = 4_000_000;

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
      progress: 0, bankMatchRate: 0, erpMatchRate: 0, fuzzyCount: 0, fuzzySkipped: false,
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

  report(100);
  const matchedCount = matched.length;
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
  };
}
