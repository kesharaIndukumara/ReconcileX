import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import { fileURLToPath as r } from "node:url";
import i from "node:path";
import { createRequire as a } from "module";
import o from "path";
//#region electron/db.ts
var s = a(import.meta.url)("better-sqlite3"), c = null;
function l() {
	if (!c) {
		let e = t.getPath("userData");
		c = new s(o.join(e, "rec-app.db")), c.pragma("journal_mode = WAL"), u();
	}
	return c;
}
function u() {
	let e = c;
	e.exec("\n    CREATE TABLE IF NOT EXISTS rules (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL UNIQUE,\n      description TEXT,\n      rules_json TEXT NOT NULL,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n  "), e.exec("\n    CREATE TABLE IF NOT EXISTS sessions (\n      id TEXT PRIMARY KEY,\n      name TEXT,\n      bank_file_name TEXT NOT NULL,\n      erp_file_name TEXT NOT NULL,\n      rules_id TEXT,\n      rules_json TEXT,\n      matched_pairs_json TEXT,\n      unmatched_bank_json TEXT,\n      unmatched_erp_json TEXT,\n      match_percentage REAL,\n      is_active BOOLEAN DEFAULT 1,\n      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,\n      FOREIGN KEY (rules_id) REFERENCES rules(id)\n    );\n  "), e.exec("\n    CREATE TABLE IF NOT EXISTS preferences (\n      key TEXT PRIMARY KEY,\n      value TEXT NOT NULL,\n      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP\n    );\n  "), e.exec("\n    CREATE TABLE IF NOT EXISTS history (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      session_id TEXT,\n      event_type TEXT NOT NULL,\n      event_data TEXT,\n      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,\n      FOREIGN KEY (session_id) REFERENCES sessions(id)\n    );\n  "), e.exec("\n    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);\n    CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);\n    CREATE INDEX IF NOT EXISTS idx_rules_name ON rules(name);\n    CREATE INDEX IF NOT EXISTS idx_history_session_id ON history(session_id);\n  "), e.prepare("PRAGMA table_info(sessions)").all().map((e) => e.name).includes("rules_json") || e.exec("ALTER TABLE sessions ADD COLUMN rules_json TEXT");
}
function d(e, t, n) {
	let r = l(), i = crypto.randomUUID(), a = JSON.stringify(e), o = (/* @__PURE__ */ new Date()).toISOString();
	return r.prepare("\n    INSERT INTO rules (id, name, description, rules_json, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?)\n  ").run(i, t, n || null, a, o, o), i;
}
function f() {
	return l().prepare("SELECT * FROM rules ORDER BY updated_at DESC").all().map((e) => ({
		id: e.id,
		name: e.name,
		description: e.description,
		rules: JSON.parse(e.rules_json),
		createdAt: new Date(e.created_at),
		updatedAt: new Date(e.updated_at)
	}));
}
function p(e) {
	let t = l().prepare("SELECT * FROM rules WHERE id = ?").get(e);
	return t ? {
		id: t.id,
		name: t.name,
		description: t.description,
		rules: JSON.parse(t.rules_json),
		createdAt: new Date(t.created_at),
		updatedAt: new Date(t.updated_at)
	} : null;
}
function m(e, t, n, r) {
	let i = l(), a = (/* @__PURE__ */ new Date()).toISOString();
	if (r) {
		let o = JSON.stringify(r);
		i.prepare("\n      UPDATE rules SET name = ?, description = ?, rules_json = ?, updated_at = ?\n      WHERE id = ?\n    ").run(t, n || null, o, a, e);
	} else i.prepare("\n      UPDATE rules SET name = ?, description = ?, updated_at = ?\n      WHERE id = ?\n    ").run(t, n || null, a, e);
}
function h(e) {
	l().prepare("DELETE FROM rules WHERE id = ?").run(e);
}
function g(e, t) {
	let n = p(e);
	if (!n) throw Error(`Rule ${e} not found`);
	return d(n.rules, t, `Copy of ${n.name}`);
}
function _(e) {
	let t = l(), n = crypto.randomUUID(), r = (/* @__PURE__ */ new Date()).toISOString(), i = t.prepare("\n    INSERT INTO sessions (\n      id, name, bank_file_name, erp_file_name, rules_id, rules_json,\n      matched_pairs_json, unmatched_bank_json, unmatched_erp_json,\n      match_percentage, is_active, created_at, updated_at\n    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  "), a = e.matchedPairs ? JSON.stringify(e.matchedPairs) : null, o = e.unmatchedBank ? JSON.stringify(e.unmatchedBank) : null, s = e.unmatchedERP ? JSON.stringify(e.unmatchedERP) : null, c = e.isActive === void 0 ? 1 : +!!e.isActive, u = e.rules ? JSON.stringify(e.rules) : null;
	return i.run(n, e.name || null, e.bankFileName || "", e.erpFileName || "", null, u, a, o, s, e.matchPercentage || 0, c, r, r), n;
}
function v(e, t) {
	let n = l(), r = (/* @__PURE__ */ new Date()).toISOString(), i = t.matchedPairs ? JSON.stringify(t.matchedPairs) : void 0, a = t.unmatchedBank ? JSON.stringify(t.unmatchedBank) : void 0, o = t.unmatchedERP ? JSON.stringify(t.unmatchedERP) : void 0, s = t.rules ? JSON.stringify(t.rules) : void 0, c = [], u = [];
	if (t.name !== void 0 && (c.push("name = ?"), u.push(t.name)), i !== void 0 && (c.push("matched_pairs_json = ?"), u.push(i)), a !== void 0 && (c.push("unmatched_bank_json = ?"), u.push(a)), o !== void 0 && (c.push("unmatched_erp_json = ?"), u.push(o)), s !== void 0 && (c.push("rules_json = ?"), u.push(s)), t.matchPercentage !== void 0 && (c.push("match_percentage = ?"), u.push(t.matchPercentage)), t.isActive !== void 0 && (c.push("is_active = ?"), u.push(+!!t.isActive)), c.length === 0) return;
	c.push("updated_at = ?"), u.push(r), u.push(e);
	let d = `UPDATE sessions SET ${c.join(", ")} WHERE id = ?`;
	n.prepare(d).run(...u);
}
function y() {
	return l().prepare("SELECT * FROM sessions WHERE is_active = 1 ORDER BY created_at DESC").all().map(w);
}
function b(e) {
	let t = l().prepare("SELECT * FROM sessions WHERE id = ?").get(e);
	return t ? w(t) : null;
}
function x() {
	return l().prepare("SELECT * FROM sessions ORDER BY created_at DESC").all().map(w);
}
function S(e) {
	let t = l(), n = (/* @__PURE__ */ new Date()).toISOString();
	t.prepare("UPDATE sessions SET is_active = 0, updated_at = ? WHERE id = ?").run(n, e);
}
function C(e) {
	let t = l();
	t.prepare("DELETE FROM history WHERE session_id = ?").run(e), t.prepare("DELETE FROM sessions WHERE id = ?").run(e);
}
function w(e) {
	return {
		id: e.id,
		name: e.name,
		bankFileName: e.bank_file_name,
		erpFileName: e.erp_file_name,
		rules: e.rules_json ? JSON.parse(e.rules_json) : [],
		matchedPairs: e.matched_pairs_json ? JSON.parse(e.matched_pairs_json) : [],
		unmatchedBank: e.unmatched_bank_json ? JSON.parse(e.unmatched_bank_json) : [],
		unmatchedERP: e.unmatched_erp_json ? JSON.parse(e.unmatched_erp_json) : [],
		matchPercentage: e.match_percentage,
		isActive: !!e.is_active,
		createdAt: new Date(e.created_at),
		updatedAt: new Date(e.updated_at)
	};
}
function T(e, t) {
	let n = l(), r = typeof t == "string" ? t : JSON.stringify(t), i = (/* @__PURE__ */ new Date()).toISOString();
	n.prepare("UPDATE preferences SET value = ?, updated_at = ? WHERE key = ?").run(r, i, e).changes === 0 && n.prepare("INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)").run(e, r, i);
}
function E(e) {
	let t = l().prepare("SELECT value FROM preferences WHERE key = ?").get(e);
	if (!t) return null;
	try {
		return JSON.parse(t.value);
	} catch {
		return t.value;
	}
}
function D() {
	let e = l().prepare("SELECT key, value FROM preferences").all(), t = {};
	for (let n of e) try {
		t[n.key] = JSON.parse(n.value);
	} catch {
		t[n.key] = n.value;
	}
	return t;
}
function O(e) {
	l().prepare("DELETE FROM preferences WHERE key = ?").run(e);
}
function k(e) {
	let t = l(), n = JSON.stringify(e.eventData);
	t.prepare("\n    INSERT INTO history (session_id, event_type, event_data, timestamp)\n    VALUES (?, ?, ?, CURRENT_TIMESTAMP)\n  ").run(e.sessionId || null, e.eventType, n);
}
function A(e) {
	return l().prepare("SELECT * FROM history WHERE session_id = ? ORDER BY timestamp").all(e).map((e) => ({
		id: e.id,
		sessionId: e.session_id,
		eventType: e.event_type,
		eventData: JSON.parse(e.event_data),
		timestamp: new Date(e.timestamp)
	}));
}
function j(e) {
	let t = l(), n = e ? "SELECT * FROM history ORDER BY timestamp DESC LIMIT ?" : "SELECT * FROM history ORDER BY timestamp DESC", r = t.prepare(n);
	return (e ? r.all(e) : r.all()).map((e) => ({
		id: e.id,
		sessionId: e.session_id,
		eventType: e.event_type,
		eventData: JSON.parse(e.event_data),
		timestamp: new Date(e.timestamp)
	}));
}
function M() {
	l().exec("VACUUM");
}
function N() {
	l().exec("ANALYZE");
}
function P() {
	c &&= (c.close(), null);
}
//#endregion
//#region electron/main.ts
var F = i.dirname(r(import.meta.url));
process.env.APP_ROOT = i.join(F, "..");
var I = process.env.VITE_DEV_SERVER_URL, L = i.join(process.env.APP_ROOT, "dist-electron"), R = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = I ? i.join(process.env.APP_ROOT, "public") : R;
var z;
function B() {
	z = new e({
		icon: i.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
		webPreferences: { preload: i.join(F, "preload.mjs") }
	}), z.webContents.on("did-finish-load", () => {
		z?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	}), I ? z.loadURL(I) : z.loadFile(i.join(R, "index.html"));
}
t.on("window-all-closed", () => {
	process.platform !== "darwin" && (t.quit(), z = null);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && B();
}), n.handle("db:saveRule", (e, t, n, r) => {
	try {
		return d(t, n, r);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:loadRules", () => {
	try {
		return f();
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getRuleById", (e, t) => {
	try {
		return p(t);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:updateRule", (e, t, n, r, i) => {
	try {
		return m(t, n, r, i), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:deleteRule", (e, t) => {
	try {
		return h(t), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:duplicateRule", (e, t, n) => {
	try {
		return g(t, n);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:saveSession", (e, t) => {
	try {
		return _(t);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:updateSession", (e, t, n) => {
	try {
		return v(t, n), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getActiveSessions", () => {
	try {
		return y();
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getSessionById", (e, t) => {
	try {
		return b(t);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getAllSessions", () => {
	try {
		return x();
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:closeSession", (e, t) => {
	try {
		return S(t), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:deleteSession", (e, t) => {
	try {
		return C(t), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:savePreference", (e, t, n) => {
	try {
		return T(t, n), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getPreference", (e, t) => {
	try {
		return E(t);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getAllPreferences", () => {
	try {
		return D();
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:deletePreference", (e, t) => {
	try {
		return O(t), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:logHistory", (e, t) => {
	try {
		return k(t), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getSessionHistory", (e, t) => {
	try {
		return A(t);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:getAllHistory", (e, t) => {
	try {
		return j(t);
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:vacuum", () => {
	try {
		return M(), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), n.handle("db:optimize", () => {
	try {
		return N(), { success: !0 };
	} catch (e) {
		return { error: e.message };
	}
}), t.on("before-quit", () => {
	P();
}), t.whenReady().then(B);
//#endregion
export { L as MAIN_DIST, R as RENDERER_DIST, I as VITE_DEV_SERVER_URL };
