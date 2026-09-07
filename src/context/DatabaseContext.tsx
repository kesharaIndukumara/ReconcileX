import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SavedRule, ReconciliationSession, MappingRule, HistoryEvent, HistoryRecord } from '../types';

// Safely access window.db (the DatabaseAPI type is declared in electron/electron-env.d.ts).
function getDb(): DatabaseAPI | null {
  if (typeof window === 'undefined') return null;
  return window.db || null;
}

interface DatabaseContextType {
  // Rules
  savedRules: SavedRule[];
  loadingSavedRules: boolean;
  refreshRules: () => Promise<void>;
  saveNewRule: (rules: MappingRule[], name: string, description?: string) => Promise<string | null>;
  updateRuleAsync: (ruleId: string, name: string, description?: string, rules?: MappingRule[]) => Promise<boolean>;
  deleteRuleAsync: (ruleId: string) => Promise<boolean>;
  duplicateRuleAsync: (sourceRuleId: string, newName: string) => Promise<string | null>;

  // Sessions
  activeSessions: ReconciliationSession[];
  allSessions: ReconciliationSession[];
  loadingSessions: boolean;
  refreshSessions: () => Promise<void>;
  saveNewSession: (sessionData: Partial<ReconciliationSession>) => Promise<string | null>;
  updateSessionAsync: (sessionId: string, updates: Partial<ReconciliationSession>) => Promise<boolean>;
  closeSessionAsync: (sessionId: string) => Promise<boolean>;
  deleteSessionAsync: (sessionId: string) => Promise<boolean>;

  // Preferences
  preferences: Record<string, unknown>;
  savePreferenceAsync: (key: string, value: unknown) => Promise<boolean>;
  deletePreferenceAsync: (key: string) => Promise<boolean>;

  // History log
  logEvent: (event: HistoryEvent) => Promise<void>;
  getSessionHistoryAsync: (sessionId: string) => Promise<HistoryRecord[]>;

  // Maintenance
  vacuumAsync: () => Promise<boolean>;
  optimizeAsync: () => Promise<boolean>;
  clearHistoryAsync: () => Promise<boolean>;
  factoryResetAsync: () => Promise<boolean>;

  // Error handling
  error: string | null;
  clearError: () => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [loadingSavedRules, setLoadingSavedRules] = useState(false);

  const [activeSessions, setActiveSessions] = useState<ReconciliationSession[]>([]);
  const [allSessions, setAllSessions] = useState<ReconciliationSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [preferences, setPreferences] = useState<Record<string, unknown>>({});

  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const handleError = useCallback((message: string) => {
    setError(message);
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Database Error]', message);
    }
  }, []);

  // ============ RULES OPERATIONS ============

  const refreshRules = useCallback(async () => {
    const db = getDb();
    if (!db) return;
    setLoadingSavedRules(true);
    try {
      const result = await db.loadRules();
      if (Array.isArray(result)) {
        setSavedRules(result);
      } else if ('error' in result) {
        handleError(typeof result.error === 'string' ? result.error : String(result.error));
      }
    } catch (err) {
      handleError(`Failed to load rules: ${(err as Error).message}`);
    } finally {
      setLoadingSavedRules(false);
    }
  }, [handleError]);

  const saveNewRule = useCallback(async (rules: MappingRule[], name: string, description?: string) => {
    const db = getDb();
    if (!db) return null;
    try {
      const result = await db.saveRule(rules, name, description);
      if (typeof result === 'string') {
        await refreshRules();
        return result;
      } else if ('error' in result) {
        handleError(result.error);
      }
      return null;
    } catch (err) {
      const errorMsg = (err as Error)?.message || 'Unknown error saving rule';
      handleError(errorMsg);
      return null;
    }
  }, [refreshRules, handleError]);

  const updateRuleAsync = useCallback(async (
    ruleId: string, name: string, description?: string, rules?: MappingRule[]
  ) => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await db.updateRule(ruleId, name, description, rules) as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) {
        await refreshRules();
        return true;
      }
      handleError(result.error || 'Failed to update rule');
      return false;
    } catch (err) {
      handleError(`Failed to update rule: ${(err as Error).message}`);
      return false;
    }
  }, [refreshRules, handleError]);

  const deleteRuleAsync = useCallback(async (ruleId: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await db.deleteRule(ruleId) as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) {
        await refreshRules();
        return true;
      } else {
        handleError(result.error || 'Failed to delete rule');
      }
      return false;
    } catch (err) {
      handleError(`Failed to delete rule: ${(err as Error).message}`);
      return false;
    }
  }, [refreshRules, handleError]);

  const duplicateRuleAsync = useCallback(async (sourceRuleId: string, newName: string) => {
    const db = getDb();
    if (!db) return null;
    try {
      const result = await db.duplicateRule(sourceRuleId, newName);
      if (typeof result === 'string') {
        await refreshRules();
        return result;
      } else if ('error' in result) {
        handleError(result.error);
      }
      return null;
    } catch (err) {
      handleError(`Failed to duplicate rule: ${(err as Error).message}`);
      return null;
    }
  }, [refreshRules, handleError]);

  // ============ SESSIONS OPERATIONS ============

  const refreshSessions = useCallback(async () => {
    const db = getDb();
    if (!db) return;
    setLoadingSessions(true);
    try {
      const [activeResult, allResult] = await Promise.all([
        db.getActiveSessions(),
        db.getAllSessions(),
      ]);

      if (Array.isArray(activeResult)) {
        setActiveSessions(activeResult);
      } else if ('error' in activeResult) {
        handleError(activeResult.error);
      }

      if (Array.isArray(allResult)) {
        setAllSessions(allResult);
      } else if ('error' in allResult) {
        handleError(allResult.error);
      }
    } catch (err) {
      handleError(`Failed to load sessions: ${(err as Error).message}`);
    } finally {
      setLoadingSessions(false);
    }
  }, [handleError]);

  const saveNewSession = useCallback(async (sessionData: Partial<ReconciliationSession>) => {
    const db = getDb();
    if (!db) return null;
    try {
      const result = await db.saveSession(sessionData);
      if (typeof result === 'string') {
        await refreshSessions();
        return result;
      } else if ('error' in result) {
        handleError(result.error);
      }
      return null;
    } catch (err) {
      handleError(`Failed to save session: ${(err as Error).message}`);
      return null;
    }
  }, [refreshSessions, handleError]);

  const updateSessionAsync = useCallback(async (sessionId: string, updates: Partial<ReconciliationSession>) => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await db.updateSession(sessionId, updates) as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) {
        await refreshSessions();
        return true;
      } else {
        handleError(result.error || 'Failed to update session');
      }
      return false;
    } catch (err) {
      handleError(`Failed to update session: ${(err as Error).message}`);
      return false;
    }
  }, [refreshSessions, handleError]);

  const closeSessionAsync = useCallback(async (sessionId: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await db.closeSession(sessionId) as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) {
        await refreshSessions();
        return true;
      } else {
        handleError(result.error || 'Failed to close session');
      }
      return false;
    } catch (err) {
      handleError(`Failed to close session: ${(err as Error).message}`);
      return false;
    }
  }, [refreshSessions, handleError]);

  const deleteSessionAsync = useCallback(async (sessionId: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await db.deleteSession(sessionId) as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) {
        await refreshSessions();
        return true;
      } else {
        handleError(result.error || 'Failed to delete session');
      }
      return false;
    } catch (err) {
      handleError(`Failed to delete session: ${(err as Error).message}`);
      return false;
    }
  }, [refreshSessions, handleError]);

  // ============ PREFERENCES OPERATIONS ============

  const savePreferenceAsync = useCallback(async (key: string, value: unknown) => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await db.savePreference(key, value) as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) {
        setPreferences(prev => ({ ...prev, [key]: value }));
        return true;
      } else {
        handleError(result.error || 'Failed to save preference');
      }
      return false;
    } catch (err) {
      handleError(`Failed to save preference: ${(err as Error).message}`);
      return false;
    }
  }, [handleError]);

  const deletePreferenceAsync = useCallback(async (key: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await db.deletePreference(key) as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) {
        setPreferences(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        return true;
      } else {
        handleError(result.error || 'Failed to delete preference');
      }
      return false;
    } catch (err) {
      handleError(`Failed to delete preference: ${(err as Error).message}`);
      return false;
    }
  }, [handleError]);

  // ============ HISTORY LOG ============

  const logEvent = useCallback(async (event: HistoryEvent) => {
    const db = getDb();
    if (!db) return;
    try {
      await db.logHistory(event);
    } catch {
      // History logging is best-effort; never block the UI on it.
    }
  }, []);

  const getSessionHistoryAsync = useCallback(async (sessionId: string): Promise<HistoryRecord[]> => {
    const db = getDb();
    if (!db) return [];
    try {
      const result = await db.getSessionHistory(sessionId);
      return Array.isArray(result) ? (result as HistoryRecord[]) : [];
    } catch {
      return [];
    }
  }, []);

  // ============ MAINTENANCE ============

  const runMaintenance = useCallback(async (
    op: () => Promise<unknown>, label: string
  ): Promise<boolean> => {
    const db = getDb();
    if (!db) return false;
    try {
      const result = await op() as { success?: boolean; error?: string } | void;
      if (!result || !('error' in result)) return true;
      handleError(result.error || `Failed to ${label}`);
      return false;
    } catch (err) {
      handleError(`Failed to ${label}: ${(err as Error).message}`);
      return false;
    }
  }, [handleError]);

  const vacuumAsync = useCallback(() => {
    const db = getDb();
    return runMaintenance(() => db!.vacuum(), 'compact database');
  }, [runMaintenance]);

  const optimizeAsync = useCallback(() => {
    const db = getDb();
    return runMaintenance(() => db!.optimize(), 'optimize database');
  }, [runMaintenance]);

  const clearHistoryAsync = useCallback(async () => {
    const db = getDb();
    if (!db) return false;
    const ok = await runMaintenance(() => db.clearHistory(), 'clear history');
    if (ok) await refreshSessions();
    return ok;
  }, [runMaintenance, refreshSessions]);

  const factoryResetAsync = useCallback(async () => {
    const db = getDb();
    if (!db) return false;
    const ok = await runMaintenance(() => db.resetDatabase(), 'reset database');
    if (ok) {
      await refreshRules();
      await refreshSessions();
      setPreferences({});
    }
    return ok;
  }, [runMaintenance, refreshRules, refreshSessions]);

  // Load initial data - only when window.db is truly available
  useEffect(() => {
    const db = getDb();
    if (typeof window === 'undefined' || !db) {
      return; // Silently skip - expected in web/dev environment
    }

    const initializeData = async () => {
      try {
        await refreshRules();
        await refreshSessions();
        const prefs = await db.getAllPreferences();
        if (!('error' in prefs)) {
          setPreferences(prefs);
        }
      } catch {
        // Silently fail during startup - db might not be ready yet
      }
    };

    initializeData();
  }, [refreshRules, refreshSessions]);

  const value: DatabaseContextType = {
    // Rules
    savedRules,
    loadingSavedRules,
    refreshRules,
    saveNewRule,
    updateRuleAsync,
    deleteRuleAsync,
    duplicateRuleAsync,

    // Sessions
    activeSessions,
    allSessions,
    loadingSessions,
    refreshSessions,
    saveNewSession,
    updateSessionAsync,
    closeSessionAsync,
    deleteSessionAsync,

    // Preferences
    preferences,
    savePreferenceAsync,
    deletePreferenceAsync,

    // History log
    logEvent,
    getSessionHistoryAsync,

    // Maintenance
    vacuumAsync,
    optimizeAsync,
    clearHistoryAsync,
    factoryResetAsync,

    // Error handling
    error,
    clearError,
  };

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
