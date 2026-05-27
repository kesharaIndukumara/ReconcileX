import { useCallback, useEffect, useState } from 'react';
import { useDatabase as useDbContext } from '../context/DatabaseContext';
import { ReconciliationSession, MappingRule, RuleSection, SavedSection, RuleConfiguration } from '../types';

export const useDatabase = useDbContext;

/**
 * Hook for managing saved rule templates with convenient operations
 */
export const useSavedRules = () => {
  const { savedRules, loadingSavedRules, refreshRules, saveNewRule, deleteRuleAsync, duplicateRuleAsync } = useDatabase();

  return {
    rules: savedRules,
    loading: loadingSavedRules,
    refresh: refreshRules,
    saveRule: saveNewRule,
    deleteRule: deleteRuleAsync,
    duplicateRule: duplicateRuleAsync,
  };
};

/**
 * Hook for managing user preferences with convenient get/set operations
 */
export const usePreferences = () => {
  const { preferences, savePreferenceAsync, deletePreferenceAsync } = useDatabase();

  const getPreference = useCallback(<T,>(key: string, defaultValue?: T): T => {
    const value = preferences[key];
    return value !== undefined ? (value as T) : (defaultValue as T);
  }, [preferences]);

  const setPreference = useCallback((key: string, value: unknown) => {
    return savePreferenceAsync(key, value);
  }, [savePreferenceAsync]);

  const deletePreference = useCallback((key: string) => {
    return deletePreferenceAsync(key);
  }, [deletePreferenceAsync]);

  return {
    preferences,
    getPreference,
    setPreference,
    deletePreference,
  };
};

/**
 * Hook for managing theme preference
 */
export const useThemePreference = () => {
  const { getPreference, setPreference } = usePreferences();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = getPreference('theme', 'light');
    setTheme(savedTheme);
  }, [getPreference]);

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await setPreference('theme', newTheme);
  }, [theme, setPreference]);

  return { theme, toggleTheme };
};

/**
 * Hook for managing reconciliation sessions
 */
export const useSessions = () => {
  const {
    activeSessions,
    allSessions,
    loadingSessions,
    refreshSessions,
    saveNewSession,
    updateSessionAsync,
    closeSessionAsync,
    deleteSessionAsync,
  } = useDatabase();

  const createSession = useCallback(
    async (sessionData: Partial<ReconciliationSession>) => {
      return saveNewSession(sessionData);
    },
    [saveNewSession]
  );

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<ReconciliationSession>) => {
      return updateSessionAsync(sessionId, updates);
    },
    [updateSessionAsync]
  );

  const closeSession = useCallback(
    async (sessionId: string) => {
      return closeSessionAsync(sessionId);
    },
    [closeSessionAsync]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      return deleteSessionAsync(sessionId);
    },
    [deleteSessionAsync]
  );

  return {
    activeSessions,
    allSessions,
    loading: loadingSessions,
    refresh: refreshSessions,
    createSession,
    updateSession,
    closeSession,
    deleteSession,
  };
};

/**
 * Hook for session recovery/resumption
 */
export const useSessionRecovery = () => {
  const { activeSessions } = useSessions();
  const [lastSession, setLastSession] = useState<ReconciliationSession | null>(null);

  useEffect(() => {
    if (activeSessions.length > 0) {
      // Get the most recently updated active session
      const sorted = [...activeSessions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setLastSession(sorted[0]);
    } else {
      setLastSession(null);
    }
  }, [activeSessions]);

  return { lastSession, hasRecoverySession: lastSession !== null };
};

/**
 * Hook for auto-saving session progress during reconciliation
 */
export const useAutoSaveSession = (sessionId: string | null, enabled: boolean = true) => {
  const { updateSession } = useSessions();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const autoSave = useCallback(
    async (updates: Partial<ReconciliationSession>) => {
      if (!sessionId || !enabled) return;

      try {
        const success = await updateSession(sessionId, updates);
        if (success) {
          setLastSaved(new Date());
        }
        return success;
      } catch (err) {
        console.error('Auto-save failed:', err);
        return false;
      }
    },
    [sessionId, enabled, updateSession]
  );

  return { autoSave, lastSaved };
};

/**
 * Hook for managing rule templates with convenience methods.
 * Supports both legacy flat MappingRule[] and new RuleConfiguration format.
 */
export const useRuleTemplates = () => {
  const { rules, loading, refresh, saveRule, deleteRule, duplicateRule } = useSavedRules();
  const { getPreference, setPreference } = usePreferences();

  const saveAsTemplate = useCallback(
    async (mappingRules: MappingRule[], name: string, description?: string) => {
      const ruleId = await saveRule(mappingRules, name, description);
      if (ruleId) {
        await setPreference('lastUsedRuleId', ruleId);
      }
      return ruleId;
    },
    [saveRule, setPreference]
  );

  /**
   * Save a full RuleConfiguration as a template.
   * We flatten the rules for backward compat storage, and store the full config in preferences.
   */
  const saveConfigurationAsTemplate = useCallback(
    async (config: RuleConfiguration, name: string, description?: string) => {
      // Flatten all section rules for the legacy rules array
      const flatRules = config.sections.flatMap(s => s.rules);
      const ruleId = await saveRule(flatRules, name, description);
      if (ruleId) {
        // Store the full configuration alongside the saved rule
        await setPreference(`template_config_${ruleId}`, config);
        await setPreference('lastUsedRuleId', ruleId);
      }
      return ruleId;
    },
    [saveRule, setPreference]
  );

  /**
   * Load a configuration for a template. Falls back to wrapping legacy rules in a single section.
   */
  const getTemplateConfiguration = useCallback(
    (templateId: string): RuleConfiguration | null => {
      const template = rules.find(r => r.id === templateId);
      if (!template) return null;

      // Check if a full configuration was stored
      const storedConfig = getPreference<RuleConfiguration>(`template_config_${templateId}`);
      if (storedConfig && storedConfig.sections && storedConfig.sections.length > 0) {
        // Deep clone with new IDs
        return {
          sections: storedConfig.sections.map(s => ({
            ...s,
            id: crypto.randomUUID(),
            rules: s.rules.map(r => ({ ...r, id: crypto.randomUUID() })),
          })),
          connectors: storedConfig.connectors.map(c => ({ ...c })),
        };
      }

      // Backward compat: wrap legacy flat rules in a single section
      return {
        sections: [
          {
            id: crypto.randomUUID(),
            name: template.name || 'Section 1',
            rules: template.rules.map(r => ({ ...r, id: crypto.randomUUID() })),
          },
        ],
        connectors: [],
      };
    },
    [rules, getPreference]
  );

  const getLastUsedTemplate = useCallback(() => {
    const lastId = getPreference<string>('lastUsedRuleId');
    if (lastId) {
      return rules.find(rule => rule.id === lastId);
    }
    return null;
  }, [rules, getPreference]);

  const setLastUsedTemplate = useCallback(
    (ruleId: string) => {
      return setPreference('lastUsedRuleId', ruleId);
    },
    [setPreference]
  );

  return {
    templates: rules,
    loading,
    refresh,
    saveAsTemplate,
    saveConfigurationAsTemplate,
    getTemplateConfiguration,
    deleteTemplate: deleteRule,
    duplicateTemplate: duplicateRule,
    getLastUsedTemplate,
    setLastUsedTemplate,
  };
};

/**
 * Hook for managing saved sections (reuse library).
 * Uses preferences storage to persist saved sections as a JSON array.
 */
export const useSavedSections = () => {
  const { getPreference, setPreference } = usePreferences();
  const [savedSections, setSavedSections] = useState<SavedSection[]>([]);

  // Load saved sections from preferences
  useEffect(() => {
    const stored = getPreference<SavedSection[]>('savedSections', []);
    if (Array.isArray(stored)) {
      setSavedSections(stored);
    }
  }, [getPreference]);

  const saveSection = useCallback(
    async (section: RuleSection, name: string, description?: string) => {
      const newSaved: SavedSection = {
        id: crypto.randomUUID(),
        name,
        description,
        section: {
          ...section,
          id: crypto.randomUUID(),
          rules: section.rules.map(r => ({ ...r, id: crypto.randomUUID() })),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updated = [...savedSections, newSaved];
      setSavedSections(updated);
      await setPreference('savedSections', updated);
      return newSaved.id;
    },
    [savedSections, setPreference]
  );

  const deleteSection = useCallback(
    async (sectionId: string) => {
      const updated = savedSections.filter(s => s.id !== sectionId);
      setSavedSections(updated);
      await setPreference('savedSections', updated);
    },
    [savedSections, setPreference]
  );

  return {
    savedSections,
    saveSection,
    deleteSection,
  };
};

/**
 * Hook for managing default column preferences
 */
export const useColumnDefaults = () => {
  const { getPreference, setPreference } = usePreferences();

  const getDefaultBankColumn = useCallback(
    (index?: number) => {
      return getPreference(`defaultBankColumn_${index || 0}`, null);
    },
    [getPreference]
  );

  const getDefaultErpColumn = useCallback(
    (index?: number) => {
      return getPreference(`defaultErpColumn_${index || 0}`, null);
    },
    [getPreference]
  );

  const setDefaultBankColumn = useCallback(
    (column: string, index?: number) => {
      return setPreference(`defaultBankColumn_${index || 0}`, column);
    },
    [setPreference]
  );

  const setDefaultErpColumn = useCallback(
    (column: string, index?: number) => {
      return setPreference(`defaultErpColumn_${index || 0}`, column);
    },
    [setPreference]
  );

  return {
    getDefaultBankColumn,
    getDefaultErpColumn,
    setDefaultBankColumn,
    setDefaultErpColumn,
  };
};

/**
 * Hook for managing auto-save settings
 */
export const useAutoSaveSettings = () => {
  const { getPreference, setPreference } = usePreferences();
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(10000); // 10 seconds default

  useEffect(() => {
    const saved = getPreference<number>('autoSaveInterval', 10000);
    setAutoSaveInterval(saved);
  }, [getPreference]);

  const updateAutoSaveInterval = useCallback(
    async (interval: number) => {
      setAutoSaveInterval(interval);
      return setPreference('autoSaveInterval', interval);
    },
    [setPreference]
  );

  const toggleAutoSave = useCallback(
    async (enabled: boolean) => {
      return setPreference('autoSaveEnabled', enabled);
    },
    [setPreference]
  );

  const isAutoSaveEnabled = useCallback(() => {
    return getPreference<boolean>('autoSaveEnabled', true);
  }, [getPreference]);

  return {
    autoSaveInterval,
    updateAutoSaveInterval,
    toggleAutoSave,
    isAutoSaveEnabled,
  };
};

