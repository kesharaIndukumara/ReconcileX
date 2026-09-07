import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Trash2, FolderOpen, TrendingUp } from 'lucide-react';
import { ReconciliationResults, ReconciliationSession } from '../types';
import { useSessions, usePreferences } from '../hooks/useDatabase';
import { ThemeToggle } from '../components/ThemeToggle';

const rate = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);

const toResults = (s: ReconciliationSession): ReconciliationResults => {
  const matched = s.matchedPairs ?? [];
  const unmatchedBank = s.unmatchedBank ?? [];
  const unmatchedERP = s.unmatchedERP ?? [];
  const bankTotal = matched.length + unmatchedBank.length;
  const erpTotal = matched.length + unmatchedERP.length;
  return {
    matched,
    unmatchedBank,
    unmatchedERP,
    progress: s.matchPercentage ?? 0,
    bankMatchRate: rate(matched.length, bankTotal),
    erpMatchRate: rate(matched.length, erpTotal),
    fuzzyCount: matched.filter(m => m.kind === 'fuzzy').length,
    fuzzySkipped: false,
  };
};

const Sparkline = ({ points }: { points: number[] }) => {
  if (points.length < 2) return null;
  const w = 220;
  const h = 44;
  const max = 100;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - (p / max) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500" />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - (p / max) * h} r="2.5" className="fill-blue-500" />
      ))}
    </svg>
  );
};

export const HistoryScreen = () => {
  const navigate = useNavigate();
  const { allSessions, loading, deleteSession } = useSessions();
  const { getPreference } = usePreferences();
  const historyCap = getPreference<number>('historyCap', 100);

  const sessions = useMemo(
    () => [...allSessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allSessions]
  );

  // Prune sessions beyond the configured cap (oldest first), once per load.
  const prunedRef = useRef(false);
  useEffect(() => {
    if (prunedRef.current || loading || sessions.length <= historyCap) return;
    prunedRef.current = true;
    sessions.slice(historyCap).forEach(s => { void deleteSession(s.id); });
  }, [loading, sessions, historyCap, deleteSession]);

  const trend = useMemo(
    () =>
      [...allSessions]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(s => s.matchPercentage ?? 0),
    [allSessions]
  );

  const reopen = (s: ReconciliationSession) => {
    navigate('/reconciliation', {
      state: {
        mode: 'review',
        parsedData: { bankData: [], erpData: [] },
        rules: s.rules ?? [],
        bankFileName: s.bankFileName,
        erpFileName: s.erpFileName,
        sessionLabel: `${s.bankFileName} ↔ ${s.erpFileName}`,
        savedResults: toResults(s),
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center">
      <div className="relative w-full flex justify-center py-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center">
          <Clock className="w-4 h-4 mr-2" /> Reconciliation History
        </h2>
        <ThemeToggle className="absolute right-4 top-1/2 -translate-y-1/2" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl pt-10 px-4 pb-16"
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </button>

        {trend.length >= 2 && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" /> Match rate over time
            </h3>
            <Sparkline points={trend} />
          </div>
        )}

        {loading && <p className="text-slate-500">Loading…</p>}
        {!loading && sessions.length === 0 && (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            No saved reconciliations yet. Run one and it will show up here.
          </div>
        )}

        <div className="space-y-4">
          {sessions.map(s => {
            const r = toResults(s);
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">
                    {s.bankFileName} <span className="text-slate-400">↔</span> {s.erpFileName}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(s.createdAt).toLocaleString()} · {r.matched.length} matched ·
                    {' '}{r.unmatchedBank.length + r.unmatchedERP.length} unmatched
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span
                    className={`text-lg font-bold ${
                      r.progress >= 90 ? 'text-green-600' : r.progress >= 50 ? 'text-blue-600' : 'text-orange-500'
                    }`}
                  >
                    {r.progress}%
                  </span>
                  <button
                    onClick={() => reopen(s)}
                    className="flex items-center px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 mr-1.5" /> Reopen
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    aria-label="Delete session"
                    className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
