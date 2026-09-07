import { ComparisonMode, MappingRule } from '../types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const DATE_HINTS = ['date', 'dt', 'posted', 'value date', 'eff'];
const NUMERIC_HINTS = ['amount', 'amt', 'debit', 'credit', 'value', 'balance', 'total', 'sum', 'qty', 'quantity'];

/** Guess how a column should be compared from its header text. */
export const guessComparisonMode = (bankCol: string, erpCol: string): ComparisonMode => {
  const hay = `${bankCol} ${erpCol}`.toLowerCase();
  if (DATE_HINTS.some(h => hay.includes(h))) return 'date';
  if (NUMERIC_HINTS.some(h => hay.includes(h))) return 'numeric';
  return 'text';
};

/** 0–1 similarity between two header strings. */
export const headerSimilarity = (a: string, b: string): number => {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (ta.size === 0 || tb.length === 0) return 0;
  const shared = tb.filter(t => ta.has(t)).length;
  return shared / Math.max(ta.size, tb.length);
};

/**
 * Proposes mapping rules by pairing the most similar Bank and ERP headers
 * (greedy, one-to-one, above a confidence threshold).
 */
export const suggestMappings = (
  bankColumns: string[],
  erpColumns: string[],
  threshold = 0.5
): MappingRule[] => {
  const pairs: { bank: string; erp: string; score: number }[] = [];
  for (const bank of bankColumns) {
    for (const erp of erpColumns) {
      const score = headerSimilarity(bank, erp);
      if (score >= threshold) pairs.push({ bank, erp, score });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  const usedBank = new Set<string>();
  const usedErp = new Set<string>();
  const rules: MappingRule[] = [];
  for (const p of pairs) {
    if (usedBank.has(p.bank) || usedErp.has(p.erp)) continue;
    usedBank.add(p.bank);
    usedErp.add(p.erp);
    rules.push({
      id: crypto.randomUUID(),
      bankColumn: p.bank,
      erpColumn: p.erp,
      comparisonMode: guessComparisonMode(p.bank, p.erp),
    });
  }
  return rules;
};
