export interface MappingRule {
  id: string;
  bankColumn: string;
  erpColumn: string;
  comparisonMode?: 'numeric' | 'text';
}

export type TransactionRow = Record<string, string | number | undefined>;

export interface ParsedDataState {
  bankData: TransactionRow[];
  erpData: TransactionRow[];
}

export interface ReconciliationState {
  parsedData: ParsedDataState;
  rules: MappingRule[];
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
  /** Combined match rate: matched rows as a share of all bank + ERP rows (0–100). */
  progress: number;
  /** Share of bank rows that found a match (0–100). */
  bankMatchRate: number;
  /** Share of ERP rows that found a match (0–100). */
  erpMatchRate: number;
}

// ============ DATABASE TYPES ============

export interface SavedRule {
  id: string;
  name: string;
  description?: string;
  rules: MappingRule[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationSession {
  id: string;
  name?: string;
  bankFileName: string;
  erpFileName: string;
  rules: MappingRule[];
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
