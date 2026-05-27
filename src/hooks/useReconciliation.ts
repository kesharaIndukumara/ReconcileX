import { useState, useEffect } from 'react';
import { ReconciliationState, ReconciliationResults, TransactionRow, RuleConfiguration } from '../types';
import { getRowSignature, splitRules, evaluateMatch, evaluateConfiguration, flattenConfiguration, hasOrConnectors } from '../utils/reconcile';

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

    // Determine if we have a full configuration or legacy flat rules
    const config: RuleConfiguration | null = state.configuration || null;
    const useConfigMode = config && config.sections.length > 0;
    const hasOr = config ? hasOrConnectors(config) : false;

    // For backward compat and AND-only fast path, get flat rules
    const flatRules = useConfigMode ? flattenConfiguration(config!) : state.rules;
    const { exactRules, fuzzyRules } = splitRules(flatRules);

    // ========== Phase 1: Duplicate Detection (Exact Rules Only) ==========
    const bankSignatures = new Map<string, number>();
    let bankDuplicatesCount = 0;
    if (exactRules.length > 0 && !hasOr) {
      for (const row of bankItems) {
        const sig = getRowSignature(row, exactRules, 'bank');
        const count = bankSignatures.get(sig) || 0;
        if (count >= 1) bankDuplicatesCount++;
        bankSignatures.set(sig, count + 1);
      }
    }

    const erpSignatures = new Map<string, number>();
    let erpDuplicatesCount = 0;
    if (exactRules.length > 0 && !hasOr) {
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
    // When OR connectors exist, we can't bucket — all ERP rows go into one bucket
    const erpBuckets = new Map<string, TransactionRow[]>();
    if (hasOr) {
      // Brute-force mode: single bucket
      erpBuckets.set('', [...erpItems]);
    } else {
      for (const row of erpItems) {
        const sig = exactRules.length > 0 ? getRowSignature(row, exactRules, 'erp') : "";
        if (!erpBuckets.has(sig)) {
          erpBuckets.set(sig, []);
        }
        erpBuckets.get(sig)!.push(row);
      }
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
        let matchedIndex = -1;
        let matchBucket: TransactionRow[] | undefined;

        if (hasOr && useConfigMode) {
          // OR mode: search the single bucket using full configuration evaluation
          const bucket = erpBuckets.get('');
          if (bucket && bucket.length > 0) {
            for (let j = 0; j < bucket.length; j++) {
              if (evaluateConfiguration(bankRow, bucket[j], config!)) {
                matchedIndex = j;
                matchBucket = bucket;
                break;
              }
            }
          }
        } else if (useConfigMode && !hasOr) {
          // AND-only config mode: use bucketing + per-section evaluation
          const sig = exactRules.length > 0 ? getRowSignature(bankRow, exactRules, 'bank') : "";
          const bucket = erpBuckets.get(sig);

          if (bucket && bucket.length > 0) {
            if (fuzzyRules.length === 0) {
              // All rules are exact, and config is AND-only — bucket match is sufficient
              // But we still need to verify section-level evaluation for correctness
              for (let j = 0; j < bucket.length; j++) {
                if (evaluateConfiguration(bankRow, bucket[j], config!)) {
                  matchedIndex = j;
                  matchBucket = bucket;
                  break;
                }
              }
            } else {
              for (let j = 0; j < bucket.length; j++) {
                if (evaluateConfiguration(bankRow, bucket[j], config!)) {
                  matchedIndex = j;
                  matchBucket = bucket;
                  break;
                }
              }
            }
          }
        } else {
          // Legacy flat rules mode (backward compat)
          const sig = exactRules.length > 0 ? getRowSignature(bankRow, exactRules, 'bank') : "";
          const bucket = erpBuckets.get(sig);

          if (bucket && bucket.length > 0) {
            if (fuzzyRules.length === 0) {
              matchedIndex = 0;
              matchBucket = bucket;
            } else {
              for (let j = 0; j < bucket.length; j++) {
                if (evaluateMatch(bankRow, bucket[j], fuzzyRules)) {
                  matchedIndex = j;
                  matchBucket = bucket;
                  break;
                }
              }
            }
          }
        }

        if (matchedIndex !== -1 && matchBucket) {
          const erpRow = matchBucket.splice(matchedIndex, 1)[0];
          matchedItems.push({ bank: bankRow, erp: erpRow });

          // Clean up empty buckets
          if (matchBucket.length === 0) {
            // Find and remove the empty bucket
            for (const [key, val] of erpBuckets.entries()) {
              if (val === matchBucket) {
                erpBuckets.delete(key);
                break;
              }
            }
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


