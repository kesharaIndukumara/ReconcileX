import { MappingRule, TransactionRow, RuleConfiguration, RuleSection } from '../types';

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

export const splitRules = (rules: MappingRule[]) => {
  const exactRules: MappingRule[] = [];
  const fuzzyRules: MappingRule[] = [];
  for (const rule of rules) {
    const isNumericFuzzy = rule.comparisonMode === 'numeric' && (rule.operator && rule.operator !== 'equals' || rule.customValue1 || rule.customValue2);
    const isTextFuzzy = rule.comparisonMode !== 'numeric' && rule.operator === 'contains';
    if (isNumericFuzzy || isTextFuzzy) {
      fuzzyRules.push(rule);
    } else {
      exactRules.push(rule);
    }
  }
  return { exactRules, fuzzyRules };
};

/**
 * Validates if two specific transaction rows match based on the provided mapping rules.
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
      const numBank = Number(cleanBank);

      if (isNaN(numBank)) return false;

      // Range check using custom values
      const minVal = rule.customValue1 ? Number(rule.customValue1) : undefined;
      const maxVal = rule.customValue2 ? Number(rule.customValue2) : undefined;

      if (minVal !== undefined && !isNaN(minVal)) {
        if (numBank < minVal) return false;
      }
      if (maxVal !== undefined && !isNaN(maxVal)) {
        if (numBank > maxVal) return false;
      }

      // If neither custom value is provided, evaluate against ERP
      if (minVal === undefined && maxVal === undefined) {
        const cleanErp = erpVal.replace(/,/g, '');
        const numErp = Number(cleanErp);
        
        if (isNaN(numErp)) return false;

        const operator = rule.operator || 'equals';
        switch (operator) {
          case 'equals': if (numBank !== numErp) return false; break;
          case 'less-than': if (numBank >= numErp) return false; break;
          case 'greater-than': if (numBank <= numErp) return false; break;
          case 'less-than-or-equal': if (numBank > numErp) return false; break;
          case 'greater-than-or-equal': if (numBank < numErp) return false; break;
          default: if (numBank !== numErp) return false; break;
        }
      }
    } else {
      const operator = rule.operator || 'equals';
      if (operator === 'contains') {
        if (!bankVal.toLowerCase().includes(erpVal.toLowerCase())) {
          return false;
        }
      } else {
        if (bankVal.toLowerCase() !== erpVal.toLowerCase()) {
          return false;
        }
      }
    }
  }

  return true;
};

// ============ SECTION-BASED EVALUATION ============

/**
 * Evaluates a single section (bundle) — all rules within are AND-connected.
 * Returns true if ALL rules in the section match the given bank/erp row pair.
 */
export const evaluateSection = (
  bankRow: TransactionRow,
  erpRow: TransactionRow,
  section: RuleSection
): boolean => {
  return evaluateMatch(bankRow, erpRow, section.rules);
};

/**
 * Evaluates a full RuleConfiguration — sections connected via AND/OR logic.
 * Evaluation is left-to-right (no operator precedence).
 */
export const evaluateConfiguration = (
  bankRow: TransactionRow,
  erpRow: TransactionRow,
  config: RuleConfiguration
): boolean => {
  if (config.sections.length === 0) return false;

  let result = evaluateSection(bankRow, erpRow, config.sections[0]);

  for (let i = 1; i < config.sections.length; i++) {
    const connector = config.connectors[i - 1];
    const sectionResult = evaluateSection(bankRow, erpRow, config.sections[i]);

    if (connector?.logic === 'OR') {
      result = result || sectionResult;
    } else {
      // Default to AND
      result = result && sectionResult;
    }
  }

  return result;
};

/**
 * Flattens a RuleConfiguration into a flat array of MappingRule[] (for backward compat).
 * Useful for signature-based bucketing when all connectors are AND.
 */
export const flattenConfiguration = (config: RuleConfiguration): MappingRule[] => {
  return config.sections.flatMap(s => s.rules);
};

/**
 * Checks whether a configuration has any OR connectors.
 * When OR connectors exist, the bucketing optimization cannot be used.
 */
export const hasOrConnectors = (config: RuleConfiguration): boolean => {
  return config.connectors.some(c => c.logic === 'OR');
};


