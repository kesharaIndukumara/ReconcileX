export interface MappingRule {
  id: string;
  bankColumn: string;
  erpColumn: string;
  comparisonMode?: 'numeric' | 'text';
  operator?: 'equals' | 'less-than' | 'greater-than' | 'less-than-or-equal' | 'greater-than-or-equal' | 'contains';
  customValue1?: string;
  customValue2?: string;
}

// ============ MODULAR RULE BUILDER TYPES ============

/** A bundle/section of rules — internal logic is always AND */
export interface RuleSection {
  id: string;
  name: string;
  rules: MappingRule[];
  colorAccent?: string;
}

/** Logic connector between adjacent sections */
export type LogicOperator = 'AND' | 'OR';

export interface SectionConnector {
  afterSectionId: string;
  logic: LogicOperator;
}

/** Full rule configuration — sections connected by logic operators */
export interface RuleConfiguration {
  sections: RuleSection[];
  connectors: SectionConnector[]; // Length = sections.length - 1
}

/** Saved section for the reuse library */
export interface SavedSection {
  id: string;
  name: string;
  description?: string;
  section: RuleSection;
  createdAt: Date;
  updatedAt: Date;
}

// ============ CORE DATA TYPES ============

export type TransactionRow = Record<string, string | number | undefined>;

export interface ParsedDataState {
  bankData: TransactionRow[];
  erpData: TransactionRow[];
}

export interface ReconciliationState {
  parsedData: ParsedDataState;
  rules: MappingRule[];
  configuration?: RuleConfiguration;
  bankFileName?: string;
  erpFileName?: string;
}

export interface MatchedPair {
  bank: TransactionRow;
  erp: TransactionRow;
}

export interface ReconciliationResults {
  matched: MatchedPair[];
  unmatchedBank: TransactionRow[];
  unmatchedERP: TransactionRow[];
  progress: number;
}

// ============ DATABASE TYPES ============

export interface SavedRule {
  id: string;
  name: string;
  description?: string;
  rules: MappingRule[];
  configuration?: RuleConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationSession {
  id: string;
  name?: string;
  bankFileName: string;
  erpFileName: string;
  rules: MappingRule[];
  configuration?: RuleConfiguration;
  matchedPairs: MatchedPair[];
  unmatchedBank: TransactionRow[];
  unmatchedERP: TransactionRow[];
  matchPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryEvent {
  sessionId?: string;
  eventType: 'session_start' | 'session_save' | 'session_complete' | 'rule_save' | 'preference_update';
  eventData: Record<string, unknown>;
}
