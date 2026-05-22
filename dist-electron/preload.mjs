"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
const db = {
  // Rule Management
  saveRule: (rules, name, description) => electron.ipcRenderer.invoke("db:saveRule", rules, name, description),
  loadRules: () => electron.ipcRenderer.invoke("db:loadRules"),
  getRuleById: (ruleId) => electron.ipcRenderer.invoke("db:getRuleById", ruleId),
  updateRule: (ruleId, name, description, rules) => electron.ipcRenderer.invoke("db:updateRule", ruleId, name, description, rules),
  deleteRule: (ruleId) => electron.ipcRenderer.invoke("db:deleteRule", ruleId),
  duplicateRule: (sourceRuleId, newName) => electron.ipcRenderer.invoke("db:duplicateRule", sourceRuleId, newName),
  // Session Management
  saveSession: (sessionData) => electron.ipcRenderer.invoke("db:saveSession", sessionData),
  updateSession: (sessionId, updates) => electron.ipcRenderer.invoke("db:updateSession", sessionId, updates),
  getActiveSessions: () => electron.ipcRenderer.invoke("db:getActiveSessions"),
  getSessionById: (sessionId) => electron.ipcRenderer.invoke("db:getSessionById", sessionId),
  getAllSessions: () => electron.ipcRenderer.invoke("db:getAllSessions"),
  closeSession: (sessionId) => electron.ipcRenderer.invoke("db:closeSession", sessionId),
  deleteSession: (sessionId) => electron.ipcRenderer.invoke("db:deleteSession", sessionId),
  // Preferences Management
  savePreference: (key, value) => electron.ipcRenderer.invoke("db:savePreference", key, value),
  getPreference: (key) => electron.ipcRenderer.invoke("db:getPreference", key),
  getAllPreferences: () => electron.ipcRenderer.invoke("db:getAllPreferences"),
  deletePreference: (key) => electron.ipcRenderer.invoke("db:deletePreference", key),
  // History Logging
  logHistory: (event) => electron.ipcRenderer.invoke("db:logHistory", event),
  getSessionHistory: (sessionId) => electron.ipcRenderer.invoke("db:getSessionHistory", sessionId),
  getAllHistory: (limit) => electron.ipcRenderer.invoke("db:getAllHistory", limit),
  // Database Maintenance
  vacuum: () => electron.ipcRenderer.invoke("db:vacuum"),
  optimize: () => electron.ipcRenderer.invoke("db:optimize")
};
electron.contextBridge.exposeInMainWorld("db", db);
