import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { MappingRule, ReconciliationResults, TransactionRow } from '../types';
import { TabType } from './StatsCards';

interface ResultsTableProps {
  activeTab: TabType;
  results: ReconciliationResults;
  rules: MappingRule[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ activeTab, results, rules }) => {
  if (activeTab === 'matched') {
    if (results.matched.length === 0) {
      return <div className="text-center py-20 text-slate-500">No records found in this category.</div>;
    }
    
    // Extract keys based on the actual mapping rules the user created
    const bankKeys = Array.from(new Set(rules.map(r => r.bankColumn).filter(Boolean)));
    const erpKeys = Array.from(new Set(rules.map(r => r.erpColumn).filter(Boolean)));

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th colSpan={bankKeys.length} className="px-6 py-3 text-center bg-blue-50/50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 font-bold uppercase tracking-wider">Bank Data</th>
              <th className="w-12 bg-slate-100 border-x border-slate-300 dark:bg-slate-800 dark:border-slate-600"></th>
              <th colSpan={erpKeys.length} className="px-6 py-3 text-center bg-purple-50/50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400 font-bold uppercase tracking-wider">ERP Data</th>
            </tr>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              {bankKeys.map((k) => (
                <th key={`b-${k}`} className="px-6 py-4 font-semibold">{k}</th>
              ))}
              <th className="px-2 text-center text-slate-400 text-[10px] uppercase tracking-widest border-x border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50">Match</th>
              {erpKeys.map(k => (
                <th key={`e-${k}`} className="px-6 py-4 font-semibold">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {results.matched.slice(0, 100).map((row, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  key={i} 
                  className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {bankKeys.map((k) => (
                    <td key={`b-${k}`} className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[200px]">
                      {String(row.bank[k] ?? '')}
                    </td>
                  ))}
                  
                  <td className="px-2 align-middle bg-slate-50/50 dark:bg-slate-900/50 border-x border-slate-200 dark:border-slate-700">
                     <div className="flex justify-center w-full">
                       <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-md text-green-600 dark:text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.1)] border border-green-200 dark:border-green-800/50">
                         <CheckCircle className="w-4 h-4" />
                       </div>
                     </div>
                  </td>

                  {erpKeys.map(k => (
                    <td key={`e-${k}`} className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[200px]">
                      {String(row.erp[k] ?? '')}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {results.matched.length > 100 && (
          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Showing first 100 rows. Export report to view all {results.matched.length} records.
          </div>
        )}
      </div>
    );
  }

  // Unmatched Rendering
  let dataToRender: TransactionRow[] = [];
  let keys: string[] = [];

  if (activeTab === 'unmatchedBank') {
    dataToRender = results.unmatchedBank;
    keys = Array.from(new Set(rules.map(r => r.bankColumn).filter(Boolean)));
  }
  
  if (activeTab === 'unmatchedERP') {
    dataToRender = results.unmatchedERP;
    keys = Array.from(new Set(rules.map(r => r.erpColumn).filter(Boolean)));
  }

  if (dataToRender.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        No records found in this category.
      </div>
    );
  }

  // Fallback if rules are somehow missing
  if (keys.length === 0) {
    keys = Object.keys(dataToRender[0] || {}).slice(0, 5);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
          <tr>
            {keys.map(k => (
              <th key={k} className="px-6 py-4 font-semibold">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {dataToRender.slice(0, 100).map((row, i) => (
              <motion.tr 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                key={i} 
                className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {keys.map(k => (
                  <td key={k} className="px-6 py-4 text-slate-700 dark:text-slate-300">
                    {String(row[k] ?? '')}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
      {dataToRender.length > 100 && (
        <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Showing first 100 rows. Export report to view all {dataToRender.length} records.
        </div>
      )}
    </div>
  );
};
