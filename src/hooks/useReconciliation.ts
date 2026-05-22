import { useState, useEffect } from 'react';
import { ReconciliationState, ReconciliationResults, TransactionRow } from '../types';
import { getRowSignature } from '../utils/reconcile';

export const useReconciliation = (state: ReconciliationState | null) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [duplicateWarnings, setDuplicateWarnings] = useState<{ type: 'bank' | 'erp', count: number }[]>([]);
  const [results, setResults] = useState<ReconciliationResults>({ 
    matched: [], unmatchedBank: [], unmatchedERP: [], progress: 0 
  });

  useEffect(() => {
    if (!state) return;

    let isMounted = true;
    const bankItems = [...state.parsedData.bankData];
    const erpItems = [...state.parsedData.erpData];
    
    // ========== Phase 1: Duplicate Detection ==========
    const bankSignatures = new Map<string, number>();
    let bankDuplicatesCount = 0;
    for (const row of bankItems) {
      const sig = getRowSignature(row, state.rules, 'bank');
      const count = bankSignatures.get(sig) || 0;
      if (count >= 1) bankDuplicatesCount++;
      bankSignatures.set(sig, count + 1);
    }

    const erpSignatures = new Map<string, number>();
    let erpDuplicatesCount = 0;
    for (const row of erpItems) {
      const sig = getRowSignature(row, state.rules, 'erp');
      const count = erpSignatures.get(sig) || 0;
      if (count >= 1) erpDuplicatesCount++;
      erpSignatures.set(sig, count + 1);
    }

    const warnings: { type: 'bank' | 'erp', count: number }[] = [];
    if (bankDuplicatesCount > 0) warnings.push({ type: 'bank', count: bankDuplicatesCount });
    if (erpDuplicatesCount > 0) warnings.push({ type: 'erp', count: erpDuplicatesCount });
    setDuplicateWarnings(warnings);

    const totalRecords = bankItems.length;
    
    if (totalRecords === 0) {
       setResults({ matched: [], unmatchedBank: [], unmatchedERP: erpItems, progress: 0 });
       setIsProcessing(false);
       return;
    }

    // ========== Phase 2: Build ERP Lookup Map (O(m)) ==========
    // Group ERP rows by their signature for O(1) lookup during matching.
    // Each signature maps to an array of rows to handle duplicates correctly —
    // when a bank row matches, we consume (shift) one ERP row from that bucket.
    const erpBuckets = new Map<string, TransactionRow[]>();
    for (const row of erpItems) {
      const sig = getRowSignature(row, state.rules, 'erp');
      if (!erpBuckets.has(sig)) {
        erpBuckets.set(sig, []);
      }
      erpBuckets.get(sig)!.push(row);
    }

    // ========== Phase 3: Match Bank Rows via Map Lookup (O(n)) ==========
    const matchedItems: ReconciliationResults['matched'] = [];
    const unmatchedBankItems: ReconciliationResults['unmatchedBank'] = [];

    let currentIndex = 0;

    const processChunk = () => {
      const chunkSize = 200; // Larger chunks are fine now — no inner loop
      const end = Math.min(currentIndex + chunkSize, totalRecords);

      for (let i = currentIndex; i < end; i++) {
        const bankRow = bankItems[i];
        const sig = getRowSignature(bankRow, state.rules, 'bank');
        const bucket = erpBuckets.get(sig);

        if (bucket && bucket.length > 0) {
          // O(1) match: consume first available ERP row from this signature bucket
          const erpRow = bucket.shift()!;
          matchedItems.push({ bank: bankRow, erp: erpRow });

          // Clean up empty buckets
          if (bucket.length === 0) {
            erpBuckets.delete(sig);
          }
        } else {
          unmatchedBankItems.push(bankRow);
        }
      }

      currentIndex = end;

      if (!isMounted) return;

      if (currentIndex < totalRecords) {
        setProcessingProgress(Math.round((currentIndex / totalRecords) * 100));
        setTimeout(processChunk, 5);
      } else {
        setProcessingProgress(100);
        setTimeout(() => {
          if (!isMounted) return;

          // Collect remaining unmatched ERP rows from all non-empty buckets
          const unmatchedERPItems: TransactionRow[] = [];
          for (const bucket of erpBuckets.values()) {
            unmatchedERPItems.push(...bucket);
          }

          const finalMatchProgress = Math.round((matchedItems.length / totalRecords) * 100);
          setResults({
            matched: matchedItems,
            unmatchedBank: unmatchedBankItems,
            unmatchedERP: unmatchedERPItems,
            progress: finalMatchProgress
          });
          setIsProcessing(false);
        }, 500);
      }
    };

    setTimeout(() => {
      if (isMounted) processChunk();
    }, 300);

    return () => { isMounted = false; };
  }, [state]);

  return { isProcessing, processingProgress, results, duplicateWarnings };
};
