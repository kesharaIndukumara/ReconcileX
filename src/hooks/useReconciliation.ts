import { useState, useEffect } from 'react';
import {
  ReconciliationState,
  ReconciliationResults,
  TransactionRow,
  DuplicateGroup,
  DuplicateSummary,
  DuplicateStrategy,
} from '../types';
import { getRowSignature, describeRow } from '../utils/reconcile';

interface UseReconciliationOptions {
  /** How to treat rows that share a signature within one side. Default: 'first-wins'. */
  duplicateStrategy?: DuplicateStrategy;
}

const emptyResults: ReconciliationResults = {
  matched: [], unmatchedBank: [], unmatchedERP: [], progress: 0, bankMatchRate: 0, erpMatchRate: 0,
};

const emptyDupSummary: DuplicateSummary = { groups: 0, extras: 0 };

export const useReconciliation = (
  state: ReconciliationState | null,
  options: UseReconciliationOptions = {}
) => {
  const { duplicateStrategy = 'first-wins' } = options;

  const [isProcessing, setIsProcessing] = useState(true);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateSummary, setDuplicateSummary] = useState<{ bank: DuplicateSummary; erp: DuplicateSummary }>({
    bank: emptyDupSummary,
    erp: emptyDupSummary,
  });
  const [results, setResults] = useState<ReconciliationResults>(emptyResults);

  useEffect(() => {
    if (!state) return;

    let isMounted = true;
    const bankItems = [...state.parsedData.bankData];
    const erpItems = [...state.parsedData.erpData];
    const { rules } = state;

    // ========== Phase 1: Group each side by signature ==========
    const groupBySignature = (rows: TransactionRow[], side: 'bank' | 'erp') => {
      const bySig = new Map<string, TransactionRow[]>();
      for (const row of rows) {
        const sig = getRowSignature(row, rules, side);
        const bucket = bySig.get(sig);
        if (bucket) bucket.push(row);
        else bySig.set(sig, [row]);
      }
      return bySig;
    };

    const bankBySig = groupBySignature(bankItems, 'bank');
    const erpBySig = groupBySignature(erpItems, 'erp');

    const summarise = (bySig: Map<string, TransactionRow[]>): DuplicateSummary => {
      let groups = 0;
      let extras = 0;
      for (const bucket of bySig.values()) {
        if (bucket.length > 1) {
          groups += 1;
          extras += bucket.length - 1;
        }
      }
      return { groups, extras };
    };

    setDuplicateSummary({ bank: summarise(bankBySig), erp: summarise(erpBySig) });

    const collectGroups = (bySig: Map<string, TransactionRow[]>, side: 'bank' | 'erp'): DuplicateGroup[] => {
      const out: DuplicateGroup[] = [];
      for (const bucket of bySig.values()) {
        if (bucket.length > 1) {
          out.push({ side, label: describeRow(bucket[0], rules, side), rows: bucket });
        }
      }
      return out;
    };

    setDuplicateGroups([...collectGroups(bankBySig, 'bank'), ...collectGroups(erpBySig, 'erp')]);

    const totalRecords = bankItems.length;
    const erpTotalRecords = erpItems.length;

    if (totalRecords === 0) {
      setResults({ ...emptyResults, unmatchedERP: erpItems });
      setIsProcessing(false);
      return;
    }

    // ========== Phase 2: Build the ERP lookup ==========
    // Under 'all-unmatched', a signature that repeats on either side is "poisoned":
    // none of its rows may match, they all fall through to the unmatched lists.
    const poisoned = new Set<string>();
    if (duplicateStrategy === 'all-unmatched') {
      for (const [sig, bucket] of bankBySig) if (bucket.length > 1) poisoned.add(sig);
      for (const [sig, bucket] of erpBySig) if (bucket.length > 1) poisoned.add(sig);
    }

    const erpBuckets = new Map<string, TransactionRow[]>();
    for (const [sig, bucket] of erpBySig) {
      erpBuckets.set(sig, poisoned.has(sig) ? [] : [...bucket]);
    }
    // Rows held out of matching by the poison rule still need to reach unmatchedERP.
    const heldOutErp: TransactionRow[] = [];
    if (poisoned.size > 0) {
      for (const [sig, bucket] of erpBySig) if (poisoned.has(sig)) heldOutErp.push(...bucket);
    }

    // ========== Phase 3: Match bank rows via map lookup (O(n)) ==========
    const matchedItems: ReconciliationResults['matched'] = [];
    const unmatchedBankItems: ReconciliationResults['unmatchedBank'] = [];

    let currentIndex = 0;

    const processChunk = () => {
      const chunkSize = 500;
      const end = Math.min(currentIndex + chunkSize, totalRecords);

      for (let i = currentIndex; i < end; i++) {
        const bankRow = bankItems[i];
        const sig = getRowSignature(bankRow, rules, 'bank');
        const bucket = poisoned.has(sig) ? undefined : erpBuckets.get(sig);

        if (bucket && bucket.length > 0) {
          matchedItems.push({ bank: bankRow, erp: bucket.shift()! });
          if (bucket.length === 0) erpBuckets.delete(sig);
        } else {
          unmatchedBankItems.push(bankRow);
        }
      }

      currentIndex = end;
      if (!isMounted) return;

      if (currentIndex < totalRecords) {
        setProcessingProgress(Math.round((currentIndex / totalRecords) * 100));
        setTimeout(processChunk, 0);
      } else {
        setProcessingProgress(100);

        const unmatchedERPItems: TransactionRow[] = [...heldOutErp];
        for (const bucket of erpBuckets.values()) unmatchedERPItems.push(...bucket);

        const matchedCount = matchedItems.length;
        const combinedTotal = totalRecords + erpTotalRecords;
        setResults({
          matched: matchedItems,
          unmatchedBank: unmatchedBankItems,
          unmatchedERP: unmatchedERPItems,
          // Combined rate counts each match once against both sides, so an ERP-heavy
          // file can no longer read as "100%" while ERP rows go unmatched.
          progress: combinedTotal > 0 ? Math.round((matchedCount * 2 * 100) / combinedTotal) : 0,
          bankMatchRate: Math.round((matchedCount / totalRecords) * 100),
          erpMatchRate: erpTotalRecords > 0 ? Math.round((matchedCount / erpTotalRecords) * 100) : 0,
        });
        // Keep the completion state visible for a beat so the bar reads 100%.
        setTimeout(() => { if (isMounted) setIsProcessing(false); }, 400);
      }
    };

    setIsProcessing(true);
    setProcessingProgress(0);
    const startTimer = setTimeout(processChunk, 150);

    return () => {
      isMounted = false;
      clearTimeout(startTimer);
    };
  }, [state, duplicateStrategy]);

  return { isProcessing, processingProgress, results, duplicateGroups, duplicateSummary };
};
