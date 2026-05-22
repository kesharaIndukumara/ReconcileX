import { MappingRule, TransactionRow } from '../types';

const INVALID_NUMERIC_PREFIX = '__INVALID_NUMERIC__';

/**
 * Extracts a unique string signature from a transaction row based on the defined mapping rules.
 * This is used to securely identify duplicates or potential matches mathematically.
 * 
 * @param row The raw parsed transaction row (Bank or ERP)
 * @param rules The user-defined mapping rules
 * @param type Indicates whether we are extracting keys for the bank side or erp side
 */
export const getRowSignature = (
  row: TransactionRow,
  rules: MappingRule[],
  rowType: 'bank' | 'erp'
): string => {
  let signature = '';
  
  for (const rule of rules) {
    const fieldName = rowType === 'bank' ? rule.bankColumn : rule.erpColumn;
    let val = String(row[fieldName] || '').trim();
    
    if (rule.comparisonMode === 'numeric') {
      const cleanVal = val.replace(/,/g, '');
      const numericVal = Number(cleanVal);
      val = Number.isNaN(numericVal)
        ? `${INVALID_NUMERIC_PREFIX}${rowType}`
        : String(numericVal);
    } else {
      val = val.toLowerCase();
    }
    
    signature += val + '|';
  }
  
  return signature;
};

/**
 * Validates if two specific transaction rows perfectly match based on all mapping rules.
 */
export const evaluateMatch = (
  bankRow: TransactionRow,
  erpRow: TransactionRow,
  rules: MappingRule[]
): boolean => {
  for (const rule of rules) {
    const bankVal = String(bankRow[rule.bankColumn] || '').trim();
    const erpVal = String(erpRow[rule.erpColumn] || '').trim();

    if (rule.comparisonMode === 'numeric') {
      const cleanBank = bankVal.replace(/,/g, '');
      const cleanErp = erpVal.replace(/,/g, '');

      const numBank = Number(cleanBank);
      const numErp = Number(cleanErp);

      if (isNaN(numBank) || isNaN(numErp) || numBank !== numErp) {
        return false;
      }
    } else {
      if (bankVal.toLowerCase() !== erpVal.toLowerCase()) {
        return false;
      }
    }
  }

  return true;
};
