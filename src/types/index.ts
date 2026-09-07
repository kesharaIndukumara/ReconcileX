export type ComparisonMode = 'numeric' | 'text' | 'date';

/**
 * Optional per-rule slack. When absent, the rule is exact (v0.1 behaviour).
 * - numeric: `amount` (± absolute) or `percent` (± % of the larger value)
 * - date: `days` (± N calendar days)
 * - text: `normalized` (case/space-insensitive), `contains` (either side contains the
 *   other) or `alnum` (compare only letters and digits)
 */
export type RuleTolerance =
  | { kind: 'exact' }
  | { kind: 'amount'; value: number }
  | { kind: 'percent'; value: number }
  | { kind: 'days'; value: number }
  | { kind: 'normalized' }
  | { kind: 'contains' }
  | { kind: 'alnum' };

export interface MappingRule {
  id: string;
  bankColumn: string;
  erpColumn: string;
  comparisonMode?: ComparisonMode;
  tolerance?: RuleTolerance;
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

export type MatchKind = 'exact' | 'fuzzy' | 'manual' | 'group';

export interface MatchedPair {
  bank: TransactionRow;
  erp: TransactionRow;
  /** How the pair was formed. Absent on rows loaded from pre-v0.3 sessions (treat as 'exact'). */
  kind?: MatchKind;
}

/** One row on one side reconciled against several rows on the other (split payment / batch). */
export interface GroupMatch {
  anchorSide: 'bank' | 'erp';
  anchor: TransactionRow;
  /** Rows on the opposite side whose primary numeric value sums to the anchor's. */
  group: TransactionRow[];
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
  /** Count of pairs formed by the tolerant second pass. */
  fuzzyCount: number;
  /** True when the fuzzy pass was skipped because the leftover set was too large. */
  fuzzySkipped: boolean;
  /** One-to-many reconciliations found by the third pass. */
  groupMatched: GroupMatch[];
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
