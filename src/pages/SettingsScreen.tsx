import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings as SettingsIcon, Moon, Sun, Database, Trash2, RotateCcw } from 'lucide-react';
import { DuplicateStrategy } from '../types';
import { usePreferences, useThemePreference } from '../hooks/useDatabase';
import { useDatabase } from '../context/DatabaseContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { Toast } from '../components/Toast';

const Row = ({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-6 py-4 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
    <div>
      <div className="font-medium text-slate-900 dark:text-white">{label}</div>
      {help && <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{help}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Card = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm mb-6">
    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center">
      {icon}
      <span className="ml-2">{title}</span>
    </h3>
    {children}
  </div>
);

export const SettingsScreen = () => {
  const navigate = useNavigate();
  const { getPreference, setPreference } = usePreferences();
  const { theme, toggleTheme } = useThemePreference();
  const { vacuumAsync, optimizeAsync, clearHistoryAsync, factoryResetAsync } = useDatabase();

  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'error' | 'success' }>({ show: false, msg: '', type: 'success' });
  const [busy, setBusy] = useState(false);

  const duplicateStrategy = getPreference<DuplicateStrategy>('duplicateStrategy', 'first-wins');
  const confettiEnabled = getPreference<boolean>('confettiEnabled', true);
  const autoSaveEnabled = getPreference<boolean>('autoSaveEnabled', true);
  const historyCap = getPreference<number>('historyCap', 100);

  const run = async (fn: () => Promise<boolean>, okMsg: string) => {
    setBusy(true);
    try {
      const ok = await fn();
      setToast(
        ok
          ? { show: true, msg: okMsg, type: 'success' }
          : { show: true, msg: 'Nothing happened — the desktop database may be unavailable.', type: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center">
      <div className="relative w-full flex justify-center py-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center">
          <SettingsIcon className="w-4 h-4 mr-2" /> Settings
        </h2>
        <ThemeToggle className="absolute right-4 top-1/2 -translate-y-1/2" />
      </div>

      <Toast message={toast.msg} type={toast.type} isVisible={toast.show} onClose={() => setToast({ ...toast, show: false })} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl pt-10 px-4 pb-16">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </button>

        <Card title="Appearance" icon={theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}>
          <Row label="Theme" help="Light or dark. Also available from the button in the top bar.">
            <button
              onClick={toggleTheme}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </Row>
          <Row label="Celebrate high match rates" help="Confetti when the combined match rate is great.">
            <input
              type="checkbox"
              checked={confettiEnabled}
              onChange={e => setPreference('confettiEnabled', e.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
          </Row>
        </Card>

        <Card title="Reconciliation" icon={<SettingsIcon className="w-4 h-4" />}>
          <Row label="Duplicate handling" help="What to do with rows that share a mapping signature on one side.">
            <select
              value={duplicateStrategy}
              onChange={e => setPreference('duplicateStrategy', e.target.value as DuplicateStrategy)}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="first-wins">First copy can match, rest unmatched</option>
              <option value="all-unmatched">All copies unmatched (manual review)</option>
            </select>
          </Row>
          <Row label="Auto-save sessions" help="Persist each run to the local database automatically.">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={e => setPreference('autoSaveEnabled', e.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
          </Row>
          <Row label="Keep at most" help="Older sessions beyond this count are pruned from History.">
            <input
              type="number"
              min={10}
              max={1000}
              step={10}
              value={historyCap}
              onChange={e => setPreference('historyCap', Math.max(10, Number(e.target.value) || 100))}
              className="w-24 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </Row>
        </Card>

        <Card title="Data" icon={<Database className="w-4 h-4" />}>
          <Row label="Compact database" help="Reclaim space and refresh query planning (VACUUM + ANALYZE).">
            <button
              disabled={busy}
              onClick={() => run(async () => (await vacuumAsync()) && (await optimizeAsync()), 'Database compacted.')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              Run
            </button>
          </Row>
          <Row label="Clear history" help="Delete the event log. Saved sessions are kept.">
            <button
              disabled={busy}
              onClick={() => {
                if (confirm('Clear the history event log?')) void run(clearHistoryAsync, 'History cleared.');
              }}
              className="flex items-center px-4 py-2 rounded-lg text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Clear
            </button>
          </Row>
          <Row label="Factory reset" help="Erase all templates, sessions, preferences and history.">
            <button
              disabled={busy}
              onClick={() => {
                if (confirm('Erase ALL local data? This cannot be undone.')) void run(factoryResetAsync, 'All local data erased.');
              }}
              className="flex items-center px-4 py-2 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
            </button>
          </Row>
        </Card>
      </motion.div>
    </div>
  );
};
