import { MappingRule, TransactionRow } from '../types';
import { NUMERIC_EPSILON } from './constants';

const INVALID_NUMERIC_PREFIX = '__INVALID_NUMERIC__';

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

/**
 * Extracts a unique string signature from a transaction row based on the defined mapping rules.
 * This is used to identify duplicates and potential matches by exact-key bucketing.
 *
 * @param row The raw parsed transaction row (Bank or ERP)
 * @param rules The user-defined mapping rules
 * @param rowType Indicates whether we are extracting keys for the bank side or erp side
 */
export const getRowSignature = (
  row: TransactionRow,
  rules: MappingRule[],
  rowType: 'bank' | 'erp'
): string => {
  const parts: string[] = [];

  for (const rule of rules) {
    const fieldName = rowType === 'bank' ? rule.bankColumn : rule.erpColumn;
    // `?? ''` (not `|| ''`) so a legitimate value of 0 is preserved rather than blanked.
    const val = String(row[fieldName] ?? '').trim();

    if (rule.comparisonMode === 'numeric') {
      const numericVal = normalizeNumeric(val);
      parts.push(
        numericVal === null ? `${INVALID_NUMERIC_PREFIX}${rowType}` : numericVal.toFixed(2)
      );
    } else {
      parts.push(val.toLowerCase());
    }
  }

  // JSON.stringify keeps field boundaries unambiguous — "a|b" + "c" can no longer
  // collide with "a" + "b|c".
  return JSON.stringify(parts);
};

/**
 * Validates if two specific transaction rows match on every mapping rule.
 */
export const evaluateMatch = (
  bankRow: TransactionRow,
  erpRow: TransactionRow,
  rules: MappingRule[]
): boolean => {
  for (const rule of rules) {
    const bankVal = String(bankRow[rule.bankColumn] ?? '').trim();
    const erpVal = String(erpRow[rule.erpColumn] ?? '').trim();

    if (rule.comparisonMode === 'numeric') {
      const numBank = normalizeNumeric(bankVal);
      const numErp = normalizeNumeric(erpVal);

      if (numBank === null || numErp === null || Math.abs(numBank - numErp) > NUMERIC_EPSILON) {
        return false;
      }
    } else if (bankVal.toLowerCase() !== erpVal.toLowerCase()) {
      return false;
    }
  }

  return true;
};
