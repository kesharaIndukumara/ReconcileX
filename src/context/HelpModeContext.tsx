import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface HelpModeValue {
  /** When true, explainable controls show a "?" marker that reveals a tip on click. */
  helpMode: boolean;
  toggleHelpMode: () => void;
  setHelpMode: (on: boolean) => void;
}

const HelpModeContext = createContext<HelpModeValue | undefined>(undefined);

/**
 * Holds the app-wide "guided help" toggle. Kept out of the preferences store on
 * purpose — it's a transient inspection mode, not a saved setting.
 */
export const HelpModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [helpMode, setHelpMode] = useState(false);
  const toggleHelpMode = useCallback(() => setHelpMode(v => !v), []);

  // Esc leaves help mode, matching the modal dismiss pattern used elsewhere.
  useEffect(() => {
    if (!helpMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHelpMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpMode]);

  return (
    <HelpModeContext.Provider value={{ helpMode, toggleHelpMode, setHelpMode }}>
      {children}
    </HelpModeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useHelpMode = (): HelpModeValue => {
  const ctx = useContext(HelpModeContext);
  if (!ctx) throw new Error('useHelpMode must be used within a HelpModeProvider');
  return ctx;
};
