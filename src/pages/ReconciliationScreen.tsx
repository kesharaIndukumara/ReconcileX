import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useWindowSize } from 'react-use';
import { ArrowLeft, Activity, AlertTriangle, Save, FileSpreadsheet, FileText } from 'lucide-react';

const Confetti = lazy(() => import('react-confetti'));
import { ReconciliationState, ReconciliationResults, TransactionRow, DuplicateStrategy } from '../types';
import { CONFETTI_THRESHOLD } from '../utils/constants';
import { useReconciliation } from '../hooks/useReconciliation';
import { useDatabase, useSessions, usePreferences } from '../hooks/useDatabase';
import { ProcessingOverlay } from '../components/ProcessingOverlay';
import { StatsCards, TabType } from '../components/StatsCards';
import { MatchRateBadge } from '../components/MatchRateBadge';
import { ResultsTable } from '../components/ResultsTable';
import { StepIndicator } from '../components/StepIndicator';
import { Toast } from '../components/Toast';

type ReconLocationState = ReconciliationState & {
  /** 'review' opens a saved session read-only from the history browser. */
  mode?: 'live' | 'review';
  savedResults?: ReconciliationResults;
  sessionLabel?: string;
  /** Matches carried over when resuming an interrupted session. */
  seedMatched?: import('../types').MatchedPair[];
};

const rateOf = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);

const EMPTY_PARSED = { bankData: [], erpData: [] };

const timestampName = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Reconciliation_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

export const ReconciliationScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { width, height } = useWindowSize();

  const state = location.state as ReconLocationState | null;
  const isReview = state?.mode === 'review';

  const [activeTab, setActiveTab] = useState<TabType>('matched');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'error' | 'success' }>({ show: false, msg: '', type: 'error' });

  const { getPreference } = usePreferences();
  const duplicateStrategy = getPreference<DuplicateStrategy>('duplicateStrategy', 'first-wins');
  const confettiEnabled = getPreference<boolean>('confettiEnabled', true);

  // In review mode we feed the engine empty data (it finishes instantly) and show the
  // saved results instead.
  const engineState = useMemo<ReconciliationState | null>(() => {
    if (!state) return null;
    if (isReview) return { ...state, parsedData: EMPTY_PARSED };
    return state;
  }, [state, isReview]);

  const engine = useReconciliation(engineState, { duplicateStrategy });
  const { isProcessing, processingProgress, elapsedMs, cancelled, cancel, duplicateGroups, duplicateSummary } = engine;

  const results = useMemo<ReconciliationResults>(() => {
    if (isReview && state?.savedResults) return state.savedResults;
    const seed = state?.seedMatched ?? [];
    if (seed.length === 0) return engine.results;
    // Resuming: fold the carried-over matches back into this pass's numbers.
    const matched = [...seed.map(m => ({ ...m, kind: m.kind ?? ('exact' as const) })), ...engine.results.matched];
    const bankTotal = matched.length + engine.results.unmatchedBank.length;
    const erpTotal = matched.length + engine.results.unmatchedERP.length;
    return {
      ...engine.results,
      matched,
      progress: bankTotal + erpTotal > 0 ? Math.round((matched.length * 2 * 100) / (bankTotal + erpTotal)) : 0,
      bankMatchRate: rateOf(matched.length, bankTotal),
      erpMatchRate: rateOf(matched.length, erpTotal),
    };
  }, [isReview, state?.savedResults, state?.seedMatched, engine.results]);

  const { createSession, updateSession } = useSessions();
  const { logEvent } = useDatabase();

  // A user-cancelled run drops back to the mapping screen.
  useEffect(() => {
    if (cancelled) navigate(-1);
  }, [cancelled, navigate]);

  const duplicateCount = duplicateSummary.bank.extras + duplicateSummary.erp.extras;
  const duplicateGroupCount = duplicateSummary.bank.groups + duplicateSummary.erp.groups;

  // Create the session row as soon as a live run starts.
  useEffect(() => {
    if (isReview || !state || sessionId) return;
    let aborted = false;

    (async () => {
      try {
        const newId = await createSession({
          bankFileName: state.bankFileName || 'bank-data',
          erpFileName: state.erpFileName || 'erp-data',
          rules: state.rules,
          matchedPairs: [],
          unmatchedBank: state.parsedData.bankData,
          unmatchedERP: state.parsedData.erpData,
          matchPercentage: 0,
          isActive: true,
        });
        if (newId && !aborted) {
          setSessionId(newId);
          void logEvent({
            sessionId: newId,
            eventType: 'session_start',
            eventData: { bankFileName: state.bankFileName, erpFileName: state.erpFileName, rules: state.rules.length },
          });
        }
      } catch (err) {
        console.error('Failed to create session:', err);
      }
    })();

    return () => { aborted = true; };
  }, [isReview, state, sessionId, createSession, logEvent]);

  // Persist the outcome once, when a live run finishes.
  const hasSavedRef = useRef(false);
  useEffect(() => {
    if (isReview || cancelled || !sessionId || isProcessing || hasSavedRef.current) return;
    hasSavedRef.current = true;

    (async () => {
      try {
        await updateSession(sessionId, {
          matchedPairs: results.matched,
          unmatchedBank: results.unmatchedBank,
          unmatchedERP: results.unmatchedERP,
          matchPercentage: results.progress,
          isActive: false,
        });
        void logEvent({
          sessionId,
          eventType: 'session_complete',
          eventData: {
            matchPercentage: results.progress,
            matched: results.matched.length,
            unmatchedBank: results.unmatchedBank.length,
            unmatchedERP: results.unmatchedERP.length,
          },
        });
      } catch (err) {
        console.error('Failed to save session progress:', err);
      }
    })();
  }, [isReview, cancelled, sessionId, isProcessing, results, updateSession, logEvent]);

  const buildRows = () => {
    const flatMatched = results.matched.map(m => ({
      ...m.bank, ...m.erp, Match_Status: m.kind === 'fuzzy' ? 'MATCHED (FUZZY)' : m.kind === 'manual' ? 'MATCHED (MANUAL)' : 'MATCHED',
    }));
    const flatGroup = results.groupMatched.flatMap((g, gi) => {
      const tag = `GROUP ${gi + 1} (${g.anchorSide.toUpperCase()} 1 to ${g.anchorSide === 'bank' ? 'ERP' : 'BANK'} ${g.group.length})`;
      return [{ ...g.anchor, Match_Status: `${tag} - ANCHOR` }, ...g.group.map(r => ({ ...r, Match_Status: `${tag} - MEMBER` }))];
    });
    const flatBank = results.unmatchedBank.map(b => ({ ...b, Match_Status: 'UNMATCHED - ONLY IN BANK' }));
    const flatErp = results.unmatchedERP.map(e => ({ ...e, Match_Status: 'UNMATCHED - ONLY IN ERP' }));
    return { flatMatched, flatGroup, flatBank, flatErp };
  };

  const summaryRows = () => [
    { Metric: 'Bank file', Value: state?.bankFileName ?? '' },
    { Metric: 'ERP file', Value: state?.erpFileName ?? '' },
    { Metric: 'Run at', Value: new Date().toLocaleString() },
    { Metric: 'Rules', Value: state?.rules.length ?? 0 },
    { Metric: 'Matched (1-to-1)', Value: results.matched.length },
    { Metric: 'Fuzzy matches', Value: results.fuzzyCount },
    { Metric: 'Group matches', Value: results.groupMatched.length },
    { Metric: 'Unmatched (Bank)', Value: results.unmatchedBank.length },
    { Metric: 'Unmatched (ERP)', Value: results.unmatchedERP.length },
    { Metric: 'Combined match rate %', Value: results.progress },
    { Metric: 'Bank match rate %', Value: results.bankMatchRate },
    { Metric: 'ERP match rate %', Value: results.erpMatchRate },
    { Metric: 'Duplicate groups', Value: duplicateGroupCount },
    { Metric: 'Duplicate extra rows', Value: duplicateCount },
  ];

  const deliver = async (base64: string, ext: 'xlsx' | 'csv') => {
    const defaultName = `${timestampName()}.${ext}`;
    if (window.exporter) {
      const res = await window.exporter.save({ defaultName, base64, ext });
      if (res.saved) setToast({ show: true, msg: `Saved to ${res.path}`, type: 'success' });
      else if (res.error) setToast({ show: true, msg: res.error, type: 'error' });
      return;
    }
    // Browser fallback: trigger a download.
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes]));
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    const XLSX = await import('xlsx');
    const { flatMatched, flatGroup, flatBank, flatErp } = buildRows();

    if (format === 'csv') {
      const all = [...flatMatched, ...flatGroup, ...flatBank, ...flatErp];
      const ws = XLSX.utils.json_to_sheet(all as TransactionRow[]);
      await deliver(btoa(unescape(encodeURIComponent(XLSX.utils.sheet_to_csv(ws)))), 'csv');
      return;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows()), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatMatched as TransactionRow[]), 'Matched');
    if (flatGroup.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatGroup as TransactionRow[]), 'Group Matches');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatBank as TransactionRow[]), 'Unmatched Bank');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatErp as TransactionRow[]), 'Unmatched ERP');
    await deliver(XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }), 'xlsx');
  };

  const handleSaveSession = async () => {
    if (!sessionId) return;
    setIsSavingSession(true);
    try {
      const success = await updateSession(sessionId, {
        matchPercentage: results.progress,
        isActive: false,
      });
      setToast(
        success
          ? { show: true, msg: 'Session saved.', type: 'success' }
          : { show: true, msg: 'Failed to save session', type: 'error' }
      );
    } catch (err) {
      setToast({ show: true, msg: `Error: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsSavingSession(false);
    }
  };

  if (!state) {
    navigate('/');
    return null;
  }

  if (!isReview && (isProcessing || cancelled)) {
    return <ProcessingOverlay progress={processingProgress} elapsedMs={elapsedMs} onCancel={cancel} />;
  }

  const groupedRowCount = results.groupMatched.reduce((n, g) => n + 1 + g.group.length, 0);
  const processedCount =
    results.matched.length + groupedRowCount + results.unmatchedBank.length + results.unmatchedERP.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col items-center">
      <StepIndicator currentStep={3} />
      <Toast
        message={toast.msg}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
      />

      {!isReview && confettiEnabled && results.progress >= CONFETTI_THRESHOLD && (
        <Suspense fallback={null}>
          <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />
        </Suspense>
      )}

      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 shadow-sm z-10 w-full">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => (isReview ? navigate('/history') : navigate(-1))}
              className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isReview ? 'Back to History' : 'Adjust Rules'}
            </button>
            <div className="flex gap-4">
              {!isReview && (
                <button
                  onClick={handleSaveSession}
                  disabled={isSavingSession}
                  className="flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors font-medium text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSavingSession ? 'Saving...' : 'Save Session'}
                </button>
              )}
              <button
                onClick={() => handleExport('xlsx')}
                className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export .xlsx
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
              >
                <FileText className="w-4 h-4 mr-2" />
                .csv
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center">
                <Activity className="w-8 h-8 mr-3 text-blue-600" />
                {isReview ? (state.sessionLabel || 'Saved Reconciliation') : 'Reconciliation Complete'}
              </h1>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                {processedCount} rows · {results.matched.length} matched
                {results.fuzzyCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400"> ({results.fuzzyCount} fuzzy)</span>
                )}
                {results.groupMatched.length > 0 && (
                  <span className="text-indigo-600 dark:text-indigo-400"> +{results.groupMatched.length} grouped</span>
                )}
                , {results.unmatchedBank.length} bank-only, {results.unmatchedERP.length} ERP-only.
              </p>
              {results.fuzzySkipped && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  The tolerant pass was skipped — too many leftover rows to compare. Tighten your rules or split the file.
                </p>
              )}
            </div>

            <MatchRateBadge
              progress={results.progress}
              bankMatchRate={results.bankMatchRate}
              erpMatchRate={results.erpMatchRate}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl w-full p-6 mt-6">
        {!isReview && duplicateGroupCount > 0 && (
          <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center text-yellow-800 dark:text-yellow-400 font-bold text-lg mb-2">
              <AlertTriangle className="w-6 h-6 mr-3" />
              {duplicateGroupCount} group{duplicateGroupCount === 1 ? '' : 's'} of identical rows ({duplicateCount} extra cop{duplicateCount === 1 ? 'y' : 'ies'})
            </div>
            <p className="text-yellow-700 dark:text-yellow-500/80 font-medium">
              {duplicateStrategy === 'all-unmatched'
                ? 'Every copy in a duplicate group was sent to the Unmatched lists for manual review (set in Settings).'
                : 'Only the first row in each group can match 1-to-1; the rest moved to the Unmatched lists.'}
              {' '}Open the <span className="font-bold">Duplicate Rows</span> tab to see them.
            </p>
          </div>
        )}

        <StatsCards
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          matchedCount={results.matched.length}
          unmatchedBankCount={results.unmatchedBank.length}
          unmatchedERPCount={results.unmatchedERP.length}
          duplicateCount={isReview ? 0 : duplicateCount}
        />

        <ResultsTable
          activeTab={activeTab}
          results={results}
          rules={state.rules}
          duplicateGroups={duplicateGroups}
        />
      </div>
    </div>
  );
};
