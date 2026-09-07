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

/** How to treat rows that share a mapping signature within one side. */
export type DuplicateStrategy = 'first-wins' | 'all-unmatched';

/** A set of rows on one side that share the same mapping signature. */
export interface DuplicateGroup {
  side: 'bank' | 'erp';
  /** Human-readable rendering of the shared key values. */
  label: string;
  rows: TransactionRow[];
}

export interface DuplicateSummary {
  /** Number of signatures that occur more than once. */
  groups: number;
  /** Rows beyond the first in each group (the "extra copies"). */
  extras: number;
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

export type HistoryEventType =
  | 'session_start'
  | 'session_save'
  | 'session_complete'
  | 'rule_save'
  | 'preference_update';

export interface HistoryEvent {
  sessionId?: string;
  eventType: HistoryEventType;
  eventData: Record<string, unknown>;
}

/** A persisted history row as returned by the database. */
export interface HistoryRecord {
  id: number;
  sessionId?: string;
  eventType: HistoryEventType;
  eventData: Record<string, unknown>;
  timestamp: string | Date;
}
