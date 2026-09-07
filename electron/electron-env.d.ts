/// <reference types="vite-plugin-electron/electron-env" />

import type { MappingRule, SavedRule, ReconciliationSession, HistoryEvent } from '../src/types';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * The built directory structure
       *
       * ```tree
       * ├─┬─┬ dist
       * │ │ └── index.html
       * │ │
       * │ ├─┬ dist-electron
       * │ │ ├── main.js
       * │ │ └── preload.js
       * │
       * ```
       */
      APP_ROOT: string
      /** /dist/ or /public/ */
      VITE_PUBLIC: string
    }
  }

  // Database API Types
  interface DatabaseAPI {
    // Rule Management
    saveRule(rules: MappingRule[], name: string, description?: string): Promise<string | { error: string }>
    loadRules(): Promise<SavedRule[] | { error: string }>
    getRuleById(ruleId: string): Promise<SavedRule | null | { error: string }>
    updateRule(ruleId: string, name: string, description?: string, rules?: MappingRule[]): Promise<unknown>
    deleteRule(ruleId: string): Promise<unknown>
    duplicateRule(sourceRuleId: string, newName: string): Promise<string | { error: string }>

    // Session Management
    saveSession(sessionData: Partial<ReconciliationSession>): Promise<string | { error: string }>
    updateSession(sessionId: string, updates: Partial<ReconciliationSession>): Promise<unknown>
    getActiveSessions(): Promise<ReconciliationSession[] | { error: string }>
    getSessionById(sessionId: string): Promise<ReconciliationSession | null | { error: string }>
    getAllSessions(): Promise<ReconciliationSession[] | { error: string }>
    closeSession(sessionId: string): Promise<unknown>
    deleteSession(sessionId: string): Promise<unknown>

    // Preferences Management
    savePreference(key: string, value: unknown): Promise<unknown>
    getPreference(key: string): Promise<unknown>
    getAllPreferences(): Promise<Record<string, unknown> | { error: string }>
    deletePreference(key: string): Promise<unknown>

    // History Logging
    logHistory(event: HistoryEvent): Promise<unknown>
    getSessionHistory(sessionId: string): Promise<Array<unknown> | { error: string }>
    getAllHistory(limit?: number): Promise<Array<unknown> | { error: string }>

    // Database Maintenance
    vacuum(): Promise<unknown>
    optimize(): Promise<unknown>
  }

  // Used in Renderer process, exposed in `preload.ts`
  interface Window {
    ipcRenderer: import('electron').IpcRenderer
    db: DatabaseAPI
  }
}

export {}
