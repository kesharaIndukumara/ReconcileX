import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReconciliationState,
  ReconciliationResults,
  DuplicateGroup,
  DuplicateSummary,
  DuplicateStrategy,
} from '../types';
import { runReconciliation, EngineInput, EngineOutput } from '../utils/engine';
import type { WorkerRequest, WorkerResponse } from '../workers/reconcile.worker';

interface UseReconciliationOptions {
  duplicateStrategy?: DuplicateStrategy;
}

const emptyResults: ReconciliationResults = {
  matched: [], unmatchedBank: [], unmatchedERP: [],
  progress: 0, bankMatchRate: 0, erpMatchRate: 0, fuzzyCount: 0, fuzzySkipped: false, groupMatched: [],
};
const emptyDup: DuplicateSummary = { groups: 0, extras: 0 };

export const useReconciliation = (
  state: ReconciliationState | null,
  options: UseReconciliationOptions = {}
) => {
  const { duplicateStrategy = 'first-wins' } = options;

  const [isProcessing, setIsProcessing] = useState(true);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateSummary, setDuplicateSummary] = useState<{ bank: DuplicateSummary; erp: DuplicateSummary }>({
    bank: emptyDup, erp: emptyDup,
  });
  const [results, setResults] = useState<ReconciliationResults>(emptyResults);

  const workerRef = useRef<Worker | null>(null);

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setCancelled(true);
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    if (!state) return;

    let active = true;
    setIsProcessing(true);
    setProcessingProgress(0);
    setCancelled(false);
    setElapsedMs(0);

    const started = Date.now();
    const tick = setInterval(() => { if (active) setElapsedMs(Date.now() - started); }, 200);

    const input: EngineInput = {
      bankData: state.parsedData.bankData,
      erpData: state.parsedData.erpData,
      rules: state.rules,
      duplicateStrategy,
    };

    const finish = (out: EngineOutput) => {
      if (!active) return;
      setDuplicateGroups(out.duplicateGroups);
      setDuplicateSummary(out.duplicateSummary);
      setResults({
        matched: out.matched,
        unmatchedBank: out.unmatchedBank,
        unmatchedERP: out.unmatchedERP,
        progress: out.progress,
        bankMatchRate: out.bankMatchRate,
        erpMatchRate: out.erpMatchRate,
        fuzzyCount: out.fuzzyCount,
        fuzzySkipped: out.fuzzySkipped,
        groupMatched: out.groupMatched,
      });
      setProcessingProgress(100);
      setTimeout(() => { if (active) setIsProcessing(false); }, 300);
    };

    const runInline = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          finish(runReconciliation(input, p => { if (active) setProcessingProgress(p); }));
        } catch (err) {
          console.error('Reconciliation failed:', err);
          if (active) setIsProcessing(false);
        }
      }, 50);
    };

    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/reconcile.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          if (active) setProcessingProgress(msg.value);
        } else if (msg.type === 'done') {
          finish(msg.output);
          worker?.terminate();
          workerRef.current = null;
        } else {
          console.error('Worker error:', msg.message);
          worker?.terminate();
          workerRef.current = null;
          runInline();
        }
      };
      worker.onerror = () => {
        worker?.terminate();
        workerRef.current = null;
        runInline();
      };
      worker.postMessage({ type: 'run', input } satisfies WorkerRequest);
    } catch {
      runInline();
    }

    return () => {
      active = false;
      clearInterval(tick);
      worker?.terminate();
      workerRef.current = null;
    };
  }, [state, duplicateStrategy]);

  return {
    isProcessing,
    processingProgress,
    elapsedMs,
    cancelled,
    cancel,
    results,
    duplicateGroups,
    duplicateSummary,
  };
};
