import { createRequire } from 'module';
import path from 'path';
import { app } from 'electron';
import type BetterSqlite3 from 'better-sqlite3';
import { MappingRule, TransactionRow, MatchedPair } from '../src/types';

// ESM-compatible shims for __filename and __dirname
// better-sqlite3 (native addon) requires these CJS globals to locate its .node binary
// Use createRequire so better-sqlite3 loads via CommonJS resolution (required for native addons)
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3') as typeof BetterSqlite3;

// Types for database operations
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

// Initialize database connection
let db: BetterSqlite3.Database | null = null;

function getDatabase(): BetterSqlite3.Database {
  if (!db) {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'rec-app.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  const database = db!;

  // Rules table
  database.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      rules_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      bank_file_name TEXT NOT NULL,
      erp_file_name TEXT NOT NULL,
      rules_id TEXT,
      rules_json TEXT,
      matched_pairs_json TEXT,
      unmatched_bank_json TEXT,
      unmatched_erp_json TEXT,
      match_percentage REAL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rules_id) REFERENCES rules(id)
    );
  `);

  // Preferences table
  database.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // History table
  database.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      event_type TEXT NOT NULL,
      event_data TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
    CREATE INDEX IF NOT EXISTS idx_rules_name ON rules(name);
    CREATE INDEX IF NOT EXISTS idx_history_session_id ON history(session_id);
  `);

  const sessionColumns = (
    database.prepare('PRAGMA table_info(sessions)').all() as Array<Record<string, unknown>>
  ).map(col => col.name as string);

  if (!sessionColumns.includes('rules_json')) {
    database.exec('ALTER TABLE sessions ADD COLUMN rules_json TEXT');
  }
}

// ============ RULE MANAGEMENT ============

export function saveRule(mappingRules: MappingRule[], name: string, description?: string): string {
  const database = getDatabase();
  const id = crypto.randomUUID();
  const rulesJson = JSON.stringify(mappingRules);
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO rules (id, name, description, rules_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, name, description || null, rulesJson, now, now);
  return id;
}

export function loadRules(): SavedRule[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM rules ORDER BY updated_at DESC');
  const rows = stmt.all() as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    rules: JSON.parse(row.rules_json as string),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }));
}

export function getRuleById(ruleId: string): SavedRule | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM rules WHERE id = ?');
  const row = stmt.get(ruleId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    rules: JSON.parse(row.rules_json as string),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export function updateRule(ruleId: string, name: string, description?: string, mappingRules?: MappingRule[]): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  if (mappingRules) {
    const rulesJson = JSON.stringify(mappingRules);
    const stmt = database.prepare(`
      UPDATE rules SET name = ?, description = ?, rules_json = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(name, description || null, rulesJson, now, ruleId);
  } else {
    const stmt = database.prepare(`
      UPDATE rules SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(name, description || null, now, ruleId);
  }
}

export function deleteRule(ruleId: string): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM rules WHERE id = ?');
  stmt.run(ruleId);
}

export function duplicateRule(sourceRuleId: string, newName: string): string {
  const sourceRule = getRuleById(sourceRuleId);
  if (!sourceRule) {
    throw new Error(`Rule ${sourceRuleId} not found`);
  }

  return saveRule(sourceRule.rules, newName, `Copy of ${sourceRule.name}`);
}

// ============ SESSION MANAGEMENT ============

export function saveSession(sessionData: Partial<ReconciliationSession>): string {
  const database = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO sessions (
      id, name, bank_file_name, erp_file_name, rules_id, rules_json,
      matched_pairs_json, unmatched_bank_json, unmatched_erp_json,
      match_percentage, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const matchedPairsJson = sessionData.matchedPairs ? JSON.stringify(sessionData.matchedPairs) : null;
  const unmatchedBankJson = sessionData.unmatchedBank ? JSON.stringify(sessionData.unmatchedBank) : null;
  const unmatchedErpJson = sessionData.unmatchedERP ? JSON.stringify(sessionData.unmatchedERP) : null;
  const isActive = sessionData.isActive !== undefined ? (sessionData.isActive ? 1 : 0) : 1;
  const rulesJson = sessionData.rules ? JSON.stringify(sessionData.rules) : null;

  stmt.run(
    id,
    sessionData.name || null,
    sessionData.bankFileName || '',
    sessionData.erpFileName || '',
    null,
    rulesJson,
    matchedPairsJson,
    unmatchedBankJson,
    unmatchedErpJson,
    sessionData.matchPercentage || 0,
    isActive,
    now,
    now
  );

  return id;
}

export function updateSession(sessionId: string, updates: Partial<ReconciliationSession>): void {
  const database = getDatabase();
  const now = new Date().toISOString();

  const matchedPairsJson = updates.matchedPairs ? JSON.stringify(updates.matchedPairs) : undefined;
  const unmatchedBankJson = updates.unmatchedBank ? JSON.stringify(updates.unmatchedBank) : undefined;
  const unmatchedErpJson = updates.unmatchedERP ? JSON.stringify(updates.unmatchedERP) : undefined;
  const rulesJson = updates.rules ? JSON.stringify(updates.rules) : undefined;

  const setParts: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    setParts.push('name = ?');
    params.push(updates.name);
  }
  if (matchedPairsJson !== undefined) {
    setParts.push('matched_pairs_json = ?');
    params.push(matchedPairsJson);
  }
  if (unmatchedBankJson !== undefined) {
    setParts.push('unmatched_bank_json = ?');
    params.push(unmatchedBankJson);
  }
  if (unmatchedErpJson !== undefined) {
    setParts.push('unmatched_erp_json = ?');
    params.push(unmatchedErpJson);
  }
  if (rulesJson !== undefined) {
    setParts.push('rules_json = ?');
    params.push(rulesJson);
  }
  if (updates.matchPercentage !== undefined) {
    setParts.push('match_percentage = ?');
    params.push(updates.matchPercentage);
  }
  if (updates.isActive !== undefined) {
    setParts.push('is_active = ?');
    params.push(updates.isActive ? 1 : 0);
  }

  if (setParts.length === 0) return;

  setParts.push('updated_at = ?');
  params.push(now);
  params.push(sessionId);

  const query = `UPDATE sessions SET ${setParts.join(', ')} WHERE id = ?`;
  const stmt = database.prepare(query);
  stmt.run(...params);
}

export function getActiveSessions(): ReconciliationSession[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions WHERE is_active = 1 ORDER BY created_at DESC');
  const rows = stmt.all() as Array<Record<string, unknown>>;

  return rows.map(parseSessionRow);
}

export function getSessionById(sessionId: string): ReconciliationSession | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions WHERE id = ?');
  const row = stmt.get(sessionId) as Record<string, unknown> | undefined;

  return row ? parseSessionRow(row) : null;
}

export function getAllSessions(): ReconciliationSession[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
  const rows = stmt.all() as Array<Record<string, unknown>>;

  return rows.map(parseSessionRow);
}

export function closeSession(sessionId: string): void {
  const database = getDatabase();
  const now = new Date().toISOString();
  const stmt = database.prepare('UPDATE sessions SET is_active = 0, updated_at = ? WHERE id = ?');
  stmt.run(now, sessionId);
}

export function deleteSession(sessionId: string): void {
  const database = getDatabase();
  // Also delete associated history
  const histStmt = database.prepare('DELETE FROM history WHERE session_id = ?');
  histStmt.run(sessionId);
  const sessStmt = database.prepare('DELETE FROM sessions WHERE id = ?');
  sessStmt.run(sessionId);
}

function parseSessionRow(row: Record<string, unknown>): ReconciliationSession {
  return {
    id: row.id as string,
    name: row.name as string | undefined,
    bankFileName: row.bank_file_name as string,
    erpFileName: row.erp_file_name as string,
    rules: row.rules_json ? JSON.parse(row.rules_json as string) : [],
    matchedPairs: row.matched_pairs_json ? JSON.parse(row.matched_pairs_json as string) : [],
    unmatchedBank: row.unmatched_bank_json ? JSON.parse(row.unmatched_bank_json as string) : [],
    unmatchedERP: row.unmatched_erp_json ? JSON.parse(row.unmatched_erp_json as string) : [],
    matchPercentage: row.match_percentage as number,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============ PREFERENCES MANAGEMENT ============

export function savePreference(key: string, value: unknown): void {
  const database = getDatabase();
  const valueJson = typeof value === 'string' ? value : JSON.stringify(value);
  const now = new Date().toISOString();

  // Try update first, then insert if not exists
  const updateStmt = database.prepare('UPDATE preferences SET value = ?, updated_at = ? WHERE key = ?');
  const result = updateStmt.run(valueJson, now, key);

  if (result.changes === 0) {
    const insertStmt = database.prepare('INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)');
    insertStmt.run(key, valueJson, now);
  }
}

export function getPreference(key: string): unknown {
  const database = getDatabase();
  const stmt = database.prepare('SELECT value FROM preferences WHERE key = ?');
  const row = stmt.get(key) as Record<string, unknown> | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.value as string);
  } catch {
    return row.value;
  }
}

export function getAllPreferences(): Record<string, unknown> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT key, value FROM preferences');
  const rows = stmt.all() as Array<Record<string, unknown>>;

  const preferences: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      preferences[row.key as string] = JSON.parse(row.value as string);
    } catch {
      preferences[row.key as string] = row.value;
    }
  }

  return preferences;
}

export function deletePreference(key: string): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM preferences WHERE key = ?');
  stmt.run(key);
}

// ============ HISTORY LOGGING ============

export function logHistory(event: HistoryEvent): void {
  const database = getDatabase();
  const eventDataJson = JSON.stringify(event.eventData);

  const stmt = database.prepare(`
    INSERT INTO history (session_id, event_type, event_data, timestamp)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);

  stmt.run(event.sessionId || null, event.eventType, eventDataJson);
}

export function getSessionHistory(sessionId: string): Array<unknown> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM history WHERE session_id = ? ORDER BY timestamp');
  const rows = stmt.all(sessionId) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    eventData: JSON.parse(row.event_data as string),
    timestamp: new Date(row.timestamp as string),
  }));
}

export function getAllHistory(limit?: number): Array<unknown> {
  const database = getDatabase();
  const query = limit
    ? 'SELECT * FROM history ORDER BY timestamp DESC LIMIT ?'
    : 'SELECT * FROM history ORDER BY timestamp DESC';

  const stmt = database.prepare(query);
  const rows = limit ? (stmt.all(limit) as Array<Record<string, unknown>>) : (stmt.all() as Array<Record<string, unknown>>);

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    eventData: JSON.parse(row.event_data as string),
    timestamp: new Date(row.timestamp as string),
  }));
}

// ============ DATABASE MAINTENANCE ============

export function vacuumDatabase(): void {
  const database = getDatabase();
  database.exec('VACUUM');
}

export function optimizeDatabase(): void {
  const database = getDatabase();
  database.exec('ANALYZE');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function clearHistory(): void {
  const database = getDatabase();
  database.exec('DELETE FROM history');
}

export function resetDatabase(): void {
  const database = getDatabase();
  database.exec('DELETE FROM rules');
  database.exec('DELETE FROM sessions');
  database.exec('DELETE FROM preferences');
  database.exec('DELETE FROM history');
}

export default getDatabase;
