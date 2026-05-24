import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import { createRequire } from "module";
import path from "path";
const require$1 = createRequire(import.meta.url);
const Database = require$1("better-sqlite3");
let db = null;
function getDatabase() {
  if (!db) {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "rec-app.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initializeSchema();
  }
  return db;
}
function initializeSchema() {
  const database = db;
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
  database.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
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
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
    CREATE INDEX IF NOT EXISTS idx_rules_name ON rules(name);
    CREATE INDEX IF NOT EXISTS idx_history_session_id ON history(session_id);
  `);
  const sessionColumns = database.prepare("PRAGMA table_info(sessions)").all().map((col) => col.name);
  if (!sessionColumns.includes("rules_json")) {
    database.exec("ALTER TABLE sessions ADD COLUMN rules_json TEXT");
  }
}
function saveRule(mappingRules, name, description) {
  const database = getDatabase();
  const id = crypto.randomUUID();
  const rulesJson = JSON.stringify(mappingRules);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = database.prepare(`
    INSERT INTO rules (id, name, description, rules_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, description || null, rulesJson, now, now);
  return id;
}
function loadRules() {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM rules ORDER BY updated_at DESC");
  const rows = stmt.all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    rules: JSON.parse(row.rules_json),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }));
}
function getRuleById(ruleId) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM rules WHERE id = ?");
  const row = stmt.get(ruleId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rules: JSON.parse(row.rules_json),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}
function updateRule(ruleId, name, description, mappingRules) {
  const database = getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
function deleteRule(ruleId) {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM rules WHERE id = ?");
  stmt.run(ruleId);
}
function duplicateRule(sourceRuleId, newName) {
  const sourceRule = getRuleById(sourceRuleId);
  if (!sourceRule) {
    throw new Error(`Rule ${sourceRuleId} not found`);
  }
  return saveRule(sourceRule.rules, newName, `Copy of ${sourceRule.name}`);
}
function saveSession(sessionData) {
  const database = getDatabase();
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
  const isActive = sessionData.isActive !== void 0 ? sessionData.isActive ? 1 : 0 : 1;
  const rulesJson = sessionData.rules ? JSON.stringify(sessionData.rules) : null;
  stmt.run(
    id,
    sessionData.name || null,
    sessionData.bankFileName || "",
    sessionData.erpFileName || "",
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
function updateSession(sessionId, updates) {
  const database = getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const matchedPairsJson = updates.matchedPairs ? JSON.stringify(updates.matchedPairs) : void 0;
  const unmatchedBankJson = updates.unmatchedBank ? JSON.stringify(updates.unmatchedBank) : void 0;
  const unmatchedErpJson = updates.unmatchedERP ? JSON.stringify(updates.unmatchedERP) : void 0;
  const rulesJson = updates.rules ? JSON.stringify(updates.rules) : void 0;
  const setParts = [];
  const params = [];
  if (updates.name !== void 0) {
    setParts.push("name = ?");
    params.push(updates.name);
  }
  if (matchedPairsJson !== void 0) {
    setParts.push("matched_pairs_json = ?");
    params.push(matchedPairsJson);
  }
  if (unmatchedBankJson !== void 0) {
    setParts.push("unmatched_bank_json = ?");
    params.push(unmatchedBankJson);
  }
  if (unmatchedErpJson !== void 0) {
    setParts.push("unmatched_erp_json = ?");
    params.push(unmatchedErpJson);
  }
  if (rulesJson !== void 0) {
    setParts.push("rules_json = ?");
    params.push(rulesJson);
  }
  if (updates.matchPercentage !== void 0) {
    setParts.push("match_percentage = ?");
    params.push(updates.matchPercentage);
  }
  if (updates.isActive !== void 0) {
    setParts.push("is_active = ?");
    params.push(updates.isActive ? 1 : 0);
  }
  if (setParts.length === 0) return;
  setParts.push("updated_at = ?");
  params.push(now);
  params.push(sessionId);
  const query = `UPDATE sessions SET ${setParts.join(", ")} WHERE id = ?`;
  const stmt = database.prepare(query);
  stmt.run(...params);
}
function getActiveSessions() {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM sessions WHERE is_active = 1 ORDER BY created_at DESC");
  const rows = stmt.all();
  return rows.map(parseSessionRow);
}
function getSessionById(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM sessions WHERE id = ?");
  const row = stmt.get(sessionId);
  return row ? parseSessionRow(row) : null;
}
function getAllSessions() {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM sessions ORDER BY created_at DESC");
  const rows = stmt.all();
  return rows.map(parseSessionRow);
}
function closeSession(sessionId) {
  const database = getDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = database.prepare("UPDATE sessions SET is_active = 0, updated_at = ? WHERE id = ?");
  stmt.run(now, sessionId);
}
function deleteSession(sessionId) {
  const database = getDatabase();
  const histStmt = database.prepare("DELETE FROM history WHERE session_id = ?");
  histStmt.run(sessionId);
  const sessStmt = database.prepare("DELETE FROM sessions WHERE id = ?");
  sessStmt.run(sessionId);
}
function parseSessionRow(row) {
  return {
    id: row.id,
    name: row.name,
    bankFileName: row.bank_file_name,
    erpFileName: row.erp_file_name,
    rules: row.rules_json ? JSON.parse(row.rules_json) : [],
    matchedPairs: row.matched_pairs_json ? JSON.parse(row.matched_pairs_json) : [],
    unmatchedBank: row.unmatched_bank_json ? JSON.parse(row.unmatched_bank_json) : [],
    unmatchedERP: row.unmatched_erp_json ? JSON.parse(row.unmatched_erp_json) : [],
    matchPercentage: row.match_percentage,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}
function savePreference(key, value) {
  const database = getDatabase();
  const valueJson = typeof value === "string" ? value : JSON.stringify(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updateStmt = database.prepare("UPDATE preferences SET value = ?, updated_at = ? WHERE key = ?");
  const result = updateStmt.run(valueJson, now, key);
  if (result.changes === 0) {
    const insertStmt = database.prepare("INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)");
    insertStmt.run(key, valueJson, now);
  }
}
function getPreference(key) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT value FROM preferences WHERE key = ?");
  const row = stmt.get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}
function getAllPreferences() {
  const database = getDatabase();
  const stmt = database.prepare("SELECT key, value FROM preferences");
  const rows = stmt.all();
  const preferences = {};
  for (const row of rows) {
    try {
      preferences[row.key] = JSON.parse(row.value);
    } catch {
      preferences[row.key] = row.value;
    }
  }
  return preferences;
}
function deletePreference(key) {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM preferences WHERE key = ?");
  stmt.run(key);
}
function logHistory(event) {
  const database = getDatabase();
  const eventDataJson = JSON.stringify(event.eventData);
  const stmt = database.prepare(`
    INSERT INTO history (session_id, event_type, event_data, timestamp)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(event.sessionId || null, event.eventType, eventDataJson);
}
function getSessionHistory(sessionId) {
  const database = getDatabase();
  const stmt = database.prepare("SELECT * FROM history WHERE session_id = ? ORDER BY timestamp");
  const rows = stmt.all(sessionId);
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    eventData: JSON.parse(row.event_data),
    timestamp: new Date(row.timestamp)
  }));
}
function getAllHistory(limit) {
  const database = getDatabase();
  const query = limit ? "SELECT * FROM history ORDER BY timestamp DESC LIMIT ?" : "SELECT * FROM history ORDER BY timestamp DESC";
  const stmt = database.prepare(query);
  const rows = limit ? stmt.all(limit) : stmt.all();
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    eventData: JSON.parse(row.event_data),
    timestamp: new Date(row.timestamp)
  }));
}
function vacuumDatabase() {
  const database = getDatabase();
  database.exec("VACUUM");
}
function optimizeDatabase() {
  const database = getDatabase();
  database.exec("ANALYZE");
}
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("db:saveRule", (_event, mappingRules, name, description) => {
  try {
    return saveRule(mappingRules, name, description);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:loadRules", () => {
  try {
    return loadRules();
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getRuleById", (_event, ruleId) => {
  try {
    return getRuleById(ruleId);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:updateRule", (_event, ruleId, name, description, mappingRules) => {
  try {
    updateRule(ruleId, name, description, mappingRules);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:deleteRule", (_event, ruleId) => {
  try {
    deleteRule(ruleId);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:duplicateRule", (_event, sourceRuleId, newName) => {
  try {
    return duplicateRule(sourceRuleId, newName);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:saveSession", (_event, sessionData) => {
  try {
    return saveSession(sessionData);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:updateSession", (_event, sessionId, updates) => {
  try {
    updateSession(sessionId, updates);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getActiveSessions", () => {
  try {
    return getActiveSessions();
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getSessionById", (_event, sessionId) => {
  try {
    return getSessionById(sessionId);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getAllSessions", () => {
  try {
    return getAllSessions();
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:closeSession", (_event, sessionId) => {
  try {
    closeSession(sessionId);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:deleteSession", (_event, sessionId) => {
  try {
    deleteSession(sessionId);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:savePreference", (_event, key, value) => {
  try {
    savePreference(key, value);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getPreference", (_event, key) => {
  try {
    return getPreference(key);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getAllPreferences", () => {
  try {
    return getAllPreferences();
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:deletePreference", (_event, key) => {
  try {
    deletePreference(key);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:logHistory", (_event, event) => {
  try {
    logHistory(event);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getSessionHistory", (_event, sessionId) => {
  try {
    return getSessionHistory(sessionId);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:getAllHistory", (_event, limit) => {
  try {
    return getAllHistory(limit);
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:vacuum", () => {
  try {
    vacuumDatabase();
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle("db:optimize", () => {
  try {
    optimizeDatabase();
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
app.on("before-quit", () => {
  closeDatabase();
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
