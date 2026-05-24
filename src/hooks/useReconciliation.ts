import { useState, useEffect } from 'react';
import { ReconciliationState, ReconciliationResults, TransactionRow } from '../types';
import { getRowSignature, splitRules, evaluateMatch } from '../utils/reconcile';

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
    
    const { exactRules, fuzzyRules } = splitRules(state.rules);

    // ========== Phase 1: Duplicate Detection (Exact Rules Only) ==========
    const bankSignatures = new Map<string, number>();
    let bankDuplicatesCount = 0;
    if (exactRules.length > 0) {
      for (const row of bankItems) {
        const sig = getRowSignature(row, exactRules, 'bank');
        const count = bankSignatures.get(sig) || 0;
        if (count >= 1) bankDuplicatesCount++;
        bankSignatures.set(sig, count + 1);
      }
    }

    const erpSignatures = new Map<string, number>();
    let erpDuplicatesCount = 0;
    if (exactRules.length > 0) {
      for (const row of erpItems) {
        const sig = getRowSignature(row, exactRules, 'erp');
        const count = erpSignatures.get(sig) || 0;
        if (count >= 1) erpDuplicatesCount++;
        erpSignatures.set(sig, count + 1);
      }
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

    // ========== Phase 2: Build ERP Lookup Map ==========
    const erpBuckets = new Map<string, TransactionRow[]>();
    // If we have exact rules, build buckets by exact signature.
    // If NO exact rules exist, we put everything into a single bucket under `""`.
    for (const row of erpItems) {
      const sig = exactRules.length > 0 ? getRowSignature(row, exactRules, 'erp') : "";
      if (!erpBuckets.has(sig)) {
        erpBuckets.set(sig, []);
      }
      erpBuckets.get(sig)!.push(row);
    }

    // ========== Phase 3: Match Bank Rows ==========
    const matchedItems: ReconciliationResults['matched'] = [];
    const unmatchedBankItems: ReconciliationResults['unmatchedBank'] = [];

    let currentIndex = 0;

    const processChunk = () => {
      const chunkSize = 200;
      const end = Math.min(currentIndex + chunkSize, totalRecords);

      for (let i = currentIndex; i < end; i++) {
        const bankRow = bankItems[i];
        const sig = exactRules.length > 0 ? getRowSignature(bankRow, exactRules, 'bank') : "";
        const bucket = erpBuckets.get(sig);

        let matchedIndex = -1;

        if (bucket && bucket.length > 0) {
          if (fuzzyRules.length === 0) {
            // No fuzzy rules, so exact match is sufficient
            matchedIndex = 0;
          } else {
            // We have fuzzy rules, we need to find the first ERP row in the bucket that satisfies them
            for (let j = 0; j < bucket.length; j++) {
              if (evaluateMatch(bankRow, bucket[j], fuzzyRules)) {
                matchedIndex = j;
                break;
              }
            }
          }
        }

        if (matchedIndex !== -1 && bucket) {
          // Remove the matched ERP row from the bucket and record it
          const erpRow = bucket.splice(matchedIndex, 1)[0];
          matchedItems.push({ bank: bankRow, erp: erpRow });

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

