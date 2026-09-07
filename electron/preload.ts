import { ipcRenderer, contextBridge } from 'electron'
import type { MappingRule, ReconciliationSession, HistoryEvent } from '../src/types'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// --------- Database API Bridge ---------
const db = {
  // Rule Management
  saveRule: (rules: MappingRule[], name: string, description?: string) =>
    ipcRenderer.invoke('db:saveRule', rules, name, description),
  loadRules: () =>
    ipcRenderer.invoke('db:loadRules'),
  getRuleById: (ruleId: string) =>
    ipcRenderer.invoke('db:getRuleById', ruleId),
  updateRule: (ruleId: string, name: string, description?: string, rules?: MappingRule[]) =>
    ipcRenderer.invoke('db:updateRule', ruleId, name, description, rules),
  deleteRule: (ruleId: string) =>
    ipcRenderer.invoke('db:deleteRule', ruleId),
  duplicateRule: (sourceRuleId: string, newName: string) =>
    ipcRenderer.invoke('db:duplicateRule', sourceRuleId, newName),

  // Session Management
  saveSession: (sessionData: Partial<ReconciliationSession>) =>
    ipcRenderer.invoke('db:saveSession', sessionData),
  updateSession: (sessionId: string, updates: Partial<ReconciliationSession>) =>
    ipcRenderer.invoke('db:updateSession', sessionId, updates),
  getActiveSessions: () =>
    ipcRenderer.invoke('db:getActiveSessions'),
  getSessionById: (sessionId: string) =>
    ipcRenderer.invoke('db:getSessionById', sessionId),
  getAllSessions: () =>
    ipcRenderer.invoke('db:getAllSessions'),
  closeSession: (sessionId: string) =>
    ipcRenderer.invoke('db:closeSession', sessionId),
  deleteSession: (sessionId: string) =>
    ipcRenderer.invoke('db:deleteSession', sessionId),

  // Preferences Management
  savePreference: (key: string, value: unknown) =>
    ipcRenderer.invoke('db:savePreference', key, value),
  getPreference: (key: string) =>
    ipcRenderer.invoke('db:getPreference', key),
  getAllPreferences: () =>
    ipcRenderer.invoke('db:getAllPreferences'),
  deletePreference: (key: string) =>
    ipcRenderer.invoke('db:deletePreference', key),

  // History Logging
  logHistory: (event: HistoryEvent) =>
    ipcRenderer.invoke('db:logHistory', event),
  getSessionHistory: (sessionId: string) =>
    ipcRenderer.invoke('db:getSessionHistory', sessionId),
  getAllHistory: (limit?: number) =>
    ipcRenderer.invoke('db:getAllHistory', limit),

  // Database Maintenance
  vacuum: () =>
    ipcRenderer.invoke('db:vacuum'),
  optimize: () =>
    ipcRenderer.invoke('db:optimize'),
  clearHistory: () =>
    ipcRenderer.invoke('db:clearHistory'),
  resetDatabase: () =>
    ipcRenderer.invoke('db:resetDatabase'),
}

contextBridge.exposeInMainWorld('db', db)

