import { MappingRule, TransactionRow } from '../types';
import { NUMERIC_EPSILON } from './constants';

const INVALID_NUMERIC_PREFIX = '__INVALID_NUMERIC__';
const MS_PER_DAY = 86_400_000;

/**
 * Parses a raw cell value into a comparable number: strips thousands separators and
 * whitespace, then rounds to the cent so that values that only differ by floating-point
 * noise or formatting (`1,099.98` vs `1099.9800000001`) compare equal.
 *
 * Returns `null` when the cell is empty or not numeric.
 */
export const normalizeNumeric = (raw: string): number | null => {
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
};

/** Best-effort date parsing: Date, ISO, and d/m/y or m/d/y. Returns epoch ms or null. */
export const parseDateMs = (raw: string | number | Date | undefined): number | null => {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime();

  const str = String(raw).trim();
  const native = Date.parse(str);
  if (!Number.isNaN(native)) return native;

  const m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, a, b, y] = m;
    const yr = y.length === 2 ? 2000 + Number(y) : Number(y);
    // Prefer d/m/y; swap to m/d/y only when the first field cannot be a day.
    let day = Number(a);
    let mon = Number(b);
    if (day > 31 || mon > 12) return null;
    if (mon > 12) [day, mon] = [mon, day];
    const d = new Date(yr, mon - 1, day);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
};

const normalizeText = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
const alnum = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Evaluates a single rule for a bank/erp value pair, honouring `rule.tolerance`.
 * Returns whether they match under this rule.
 */
export const evaluateRule = (rule: MappingRule, bankRaw: string, erpRaw: string): boolean => {
  const bankVal = bankRaw.trim();
  const erpVal = erpRaw.trim();
  const tol = rule.tolerance ?? { kind: 'exact' as const };

  if (rule.comparisonMode === 'date') {
    const a = parseDateMs(bankVal);
    const b = parseDateMs(erpVal);
    if (a === null || b === null) return false;
    const slackDays = tol.kind === 'days' ? tol.value : 0;
    return Math.abs(a - b) <= slackDays * MS_PER_DAY + 1000;
  }

  if (rule.comparisonMode === 'numeric') {
    const a = normalizeNumeric(bankVal);
    const b = normalizeNumeric(erpVal);
    if (a === null || b === null) return false;
    const diff = Math.abs(a - b);
    if (tol.kind === 'amount') return diff <= Math.abs(tol.value) + NUMERIC_EPSILON;
    if (tol.kind === 'percent') return diff <= (Math.max(Math.abs(a), Math.abs(b)) * Math.abs(tol.value)) / 100 + NUMERIC_EPSILON;
    return diff <= NUMERIC_EPSILON;
  }

  // text
  switch (tol.kind) {
    case 'normalized':
      return normalizeText(bankVal) === normalizeText(erpVal);
    case 'alnum':
      return alnum(bankVal) === alnum(erpVal);
    case 'contains': {
      const a = bankVal.toLowerCase();
      const b = erpVal.toLowerCase();
      if (!a || !b) return false;
      return a.includes(b) || b.includes(a);
    }
    default:
      return bankVal.toLowerCase() === erpVal.toLowerCase();
  }
};

/**
 * Signature for exact-key bucketing (the strict first pass). Tolerant rules still
 * contribute their raw normalised value here — the fuzzy pass handles slack separately.
 */
export const getRowSignature = (
  row: TransactionRow,
  rules: MappingRule[],
  rowType: 'bank' | 'erp'
): string => {
  const parts: string[] = [];

  for (const rule of rules) {
    const fieldName = rowType === 'bank' ? rule.bankColumn : rule.erpColumn;
    const val = String(row[fieldName] ?? '').trim();

    if (rule.comparisonMode === 'numeric') {
      const numericVal = normalizeNumeric(val);
      parts.push(numericVal === null ? `${INVALID_NUMERIC_PREFIX}${rowType}` : numericVal.toFixed(2));
    } else if (rule.comparisonMode === 'date') {
      const ms = parseDateMs(val);
      parts.push(ms === null ? `${INVALID_NUMERIC_PREFIX}date_${rowType}` : String(Math.round(ms / MS_PER_DAY)));
    } else {
      parts.push(val.toLowerCase());
    }
  }

  return JSON.stringify(parts);
};

/**
 * A short human-readable rendering of the mapped values of a row, e.g.
 * `Amount=1250 · Ref=INV-1`.
 */
export const describeRow = (
  row: TransactionRow,
  rules: MappingRule[],
  side: 'bank' | 'erp'
): string =>
  rules
    .map(rule => {
      const col = side === 'bank' ? rule.bankColumn : rule.erpColumn;
      return `${col}=${String(row[col] ?? '').trim() || '∅'}`;
    })
    .join(' · ');

/** True when every rule matches (tolerances honoured). */
export const evaluateMatch = (
  bankRow: TransactionRow,
  erpRow: TransactionRow,
  rules: MappingRule[]
): boolean =>
  rules.every(rule =>
    evaluateRule(rule, String(bankRow[rule.bankColumn] ?? ''), String(erpRow[rule.erpColumn] ?? ''))
  );

export interface RuleOutcome {
  rule: MappingRule;
  bankValue: string;
  erpValue: string;
  ok: boolean;
}

/** Per-rule pass/fail for a candidate pair — powers the "why unmatched?" explainer. */
export const explainMatch = (
  bankRow: TransactionRow,
  erpRow: TransactionRow,
  rules: MappingRule[]
): RuleOutcome[] =>
  rules.map(rule => {
    const bankValue = String(bankRow[rule.bankColumn] ?? '').trim();
    const erpValue = String(erpRow[rule.erpColumn] ?? '').trim();
    return { rule, bankValue, erpValue, ok: evaluateRule(rule, bankValue, erpValue) };
  });

/**
 * Finds the unmatched row on the other side that agrees on the most rules — the
 * "closest miss" — so the UI can show which rule(s) broke the match.
 */
export const nearestCandidate = (
  row: TransactionRow,
  side: 'bank' | 'erp',
  others: TransactionRow[],
  rules: MappingRule[],
  scanLimit = 400
): { candidate: TransactionRow; outcomes: RuleOutcome[]; score: number } | null => {
  let best: { candidate: TransactionRow; outcomes: RuleOutcome[]; score: number } | null = null;
  const limit = Math.min(others.length, scanLimit);

  for (let i = 0; i < limit; i++) {
    const other = others[i];
    const bankRow = side === 'bank' ? row : other;
    const erpRow = side === 'bank' ? other : row;
    const outcomes = explainMatch(bankRow, erpRow, rules);
    const score = outcomes.reduce((n, o) => n + (o.ok ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { candidate: other, outcomes, score };
      if (score === rules.length - 1) break; // one rule away — good enough
    }
  }
  return best;
};
