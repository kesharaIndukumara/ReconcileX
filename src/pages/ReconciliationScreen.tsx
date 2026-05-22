import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import * as XLSX from 'xlsx';
import { ArrowLeft, Activity, Download, AlertTriangle, Save } from 'lucide-react';
import { ReconciliationState, TransactionRow } from '../types';
import { useReconciliation } from '../hooks/useReconciliation';
import { useSessions } from '../hooks/useDatabase';
import { ProcessingOverlay } from '../components/ProcessingOverlay';
import { StatsCards, TabType } from '../components/StatsCards';
import { MatchRateBadge } from '../components/MatchRateBadge';
import { ResultsTable } from '../components/ResultsTable';
import { StepIndicator } from '../components/StepIndicator';
import { Toast } from '../components/Toast';

export const ReconciliationScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { width, height } = useWindowSize();

  const state = location.state as ReconciliationState | null;

  const [activeTab, setActiveTab] = useState<TabType>('matched');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'error' | 'success' }>({ show: false, msg: '', type: 'error' });
  
  const { isProcessing, processingProgress, results, duplicateWarnings } = useReconciliation(state);
  const { createSession, updateSession } = useSessions();

  // Create and auto-save session
  useEffect(() => {
    const createAndSaveSession = async () => {
      if (!state || sessionId) return;

      try {
        const newSessionId = await createSession({
          bankFileName: state.bankFileName || 'bank-data',
          erpFileName: state.erpFileName || 'erp-data',
          rules: state.rules,
          matchedPairs: [],
          unmatchedBank: state.parsedData.bankData,
          unmatchedERP: state.parsedData.erpData,
          matchPercentage: 0,
          isActive: true,
        });

        if (newSessionId) {
          setSessionId(newSessionId);
        }
      } catch (err) {
        console.error('Failed to create session:', err);
      }
    };

    createAndSaveSession();
  }, [state, sessionId, createSession]);

  // Auto-save session progress once after reconciliation completes
  const hasSavedRef = useRef(false);
  useEffect(() => {
    if (!sessionId || isProcessing || hasSavedRef.current) return;
    // Only save once when processing finishes and we have a session
    hasSavedRef.current = true;

    const saveProgress = async () => {
      try {
        await updateSession(sessionId, {
          matchedPairs: results.matched,
          unmatchedBank: results.unmatchedBank,
          unmatchedERP: results.unmatchedERP,
          matchPercentage: results.progress,
          isActive: false,
        });
      } catch (err) {
        console.error('Failed to save session progress:', err);
      }
    };

    saveProgress();
  }, [sessionId, isProcessing, results, updateSession]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    const flatMatched = results.matched.map(m => ({ ...m.bank, ...m.erp, Match_Status: 'MATCHED' }));
    const flatBank = results.unmatchedBank.map(b => ({ ...b, Match_Status: 'UNMATCHED - ONLY IN BANK' }));
    const flatErp = results.unmatchedERP.map(e => ({ ...e, Match_Status: 'UNMATCHED - ONLY IN ERP' }));

    const wsMatched = XLSX.utils.json_to_sheet(flatMatched as TransactionRow[]);
    const wsBank = XLSX.utils.json_to_sheet(flatBank as TransactionRow[]);
    const wsErp = XLSX.utils.json_to_sheet(flatErp as TransactionRow[]);

    XLSX.utils.book_append_sheet(wb, wsMatched, "Matched");
    XLSX.utils.book_append_sheet(wb, wsBank, "Unmatched Bank");
    XLSX.utils.book_append_sheet(wb, wsErp, "Unmatched ERP");

    XLSX.writeFile(wb, "Reconciliation_Report.xlsx");
  };

  const handleSaveSession = async () => {
    if (!sessionId) return;
    setIsSavingSession(true);
    try {
      const success = await updateSession(sessionId, {
        matchPercentage: results.progress,
        isActive: false,
      });
      if (success) {
        setToast({ show: true, msg: 'Session saved successfully!', type: 'success' });
      } else {
        setToast({ show: true, msg: 'Failed to save session', type: 'error' });
      }
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

  if (isProcessing) {
    return <ProcessingOverlay progress={processingProgress} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden flex flex-col items-center">
      <StepIndicator currentStep={3} />
      <Toast 
        message={toast.msg} 
        type={toast.type} 
        isVisible={toast.show} 
        onClose={() => setToast({ ...toast, show: false })} 
      />
      
      {results.progress > 80 && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      {/* Top Header & Progress Context */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 shadow-sm z-10 w-full">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Adjust Rules
            </button>
            <div className="flex gap-4">
              <button 
                onClick={handleSaveSession}
                disabled={isSavingSession}
                className="flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSavingSession ? 'Saving...' : 'Save Session'}
              </button>
              <button 
                onClick={handleExport} 
                className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center">
                <Activity className="w-8 h-8 mr-3 text-blue-600" />
                Reconciliation Complete
              </h1>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Processed {results.matched.length + results.unmatchedBank.length + results.unmatchedERP.length} items using your custom rules.
              </p>
            </div>
            
            <MatchRateBadge progress={results.progress} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl w-full p-6 mt-6">
        
        {duplicateWarnings.length > 0 && (
           <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 rounded-2xl p-6 flex flex-col items-start shadow-sm">
             <div className="flex items-center text-yellow-800 dark:text-yellow-400 font-bold text-lg mb-2">
               <AlertTriangle className="w-6 h-6 mr-3" />
               Potential Duplications Detected
             </div>
             <p className="text-yellow-700 dark:text-yellow-500/80 mb-2 font-medium">
               We detected rows with identical mapping properties. Because 1-to-1 matching is strictly enforced, excess duplicates may be pushed to the Unmatched lists.
             </p>
             <ul className="list-disc list-inside text-yellow-800 dark:text-yellow-500 font-bold space-y-1 ml-2">
               {duplicateWarnings.map((w, idx) => (
                 <li key={idx}>
                    {w.type === 'bank' ? 'Bank Statement' : 'ERP Data'} has {w.count} duplicated transaction(s).
                 </li>
               ))}
             </ul>
           </div>
        )}

        <StatsCards 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          matchedCount={results.matched.length}
          unmatchedBankCount={results.unmatchedBank.length}
          unmatchedERPCount={results.unmatchedERP.length}
        />

        <ResultsTable 
          activeTab={activeTab} 
          results={results} 
          rules={state.rules}
        />
      </div>
    </div>
  );
};
