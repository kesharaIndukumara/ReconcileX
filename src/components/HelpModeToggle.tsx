import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useHelpMode } from '../context/HelpModeContext';

/** The "?" button that lives beside the Settings gear in the top bar. */
export const HelpModeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { helpMode, toggleHelpMode } = useHelpMode();

  return (
    <button
      type="button"
      onClick={toggleHelpMode}
      aria-pressed={helpMode}
      aria-label={helpMode ? 'Turn off guided help' : 'Turn on guided help'}
      title={helpMode ? 'Turn off guided help' : 'What do these controls do?'}
      className={`p-2 rounded-lg transition-colors ${
        helpMode
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
      } ${className}`}
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
};

/** Full-width strip shown under the step bar while guided help is on. */
export const HelpModeBanner: React.FC = () => {
  const { helpMode, setHelpMode } = useHelpMode();
  if (!helpMode) return null;

  return (
    <div className="w-full bg-amber-500 text-white text-xs sm:text-sm text-center py-2 px-4 flex items-center justify-center gap-3">
      <span>
        Guided help is on — click any <strong>?</strong> marker to see what a control does.
      </span>
      <button
        type="button"
        onClick={() => setHelpMode(false)}
        className="rounded-full bg-white/20 hover:bg-white/30 px-3 py-0.5 font-medium transition-colors"
      >
        Done
      </button>
    </div>
  );
};
