import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { MappingRule } from '../types';

interface RuleRowProps {
  rule: MappingRule;
  bankColumns: string[];
  erpColumns: string[];
  canDelete: boolean;
  onUpdate: (field: keyof MappingRule, value: string) => void;
  onDelete: () => void;
}

export const RuleRow = ({ rule, bankColumns, erpColumns, canDelete, onUpdate, onDelete }: RuleRowProps) => {
  const [showRange, setShowRange] = useState(false);
  const hasCustomRange = rule.comparisonMode === 'numeric' && rule.operator !== 'equals';

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr_minmax(110px,auto)_auto] items-center gap-3 w-full">
        {/* Bank Column */}
        <select
          value={rule.bankColumn}
          onChange={(e) => onUpdate('bankColumn', e.target.value)}
          className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm"
        >
          <option value="">Select Bank Column...</option>
          {bankColumns.map(col => (
            <option key={`bank-${col}`} value={col}>{col}</option>
          ))}
        </select>

        {/* Operator */}
        <select
          value={rule.operator || 'equals'}
          onChange={(e) => onUpdate('operator', e.target.value)}
          className="w-36 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-xs font-semibold"
        >
          <option value="equals">Equals</option>
          <option value="contains">Contains</option>
          <option value="less-than">Less Than</option>
          <option value="greater-than">Greater Than</option>
          <option value="less-than-or-equal">Less Than or Eq</option>
          <option value="greater-than-or-equal">Greater Than or Eq</option>
        </select>

        {/* ERP Column */}
        <select
          value={rule.erpColumn}
          onChange={(e) => onUpdate('erpColumn', e.target.value)}
          className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm"
        >
          <option value="">Select ERP Column...</option>
          {erpColumns.map(col => (
            <option key={`erp-${col}`} value={col}>{col}</option>
          ))}
        </select>

        {/* Comparison Mode */}
        <select
          value={rule.comparisonMode || 'text'}
          onChange={(e) => onUpdate('comparisonMode', e.target.value)}
          className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-xs"
        >
          <option value="text">Text (Exact)</option>
          <option value="numeric">Numeric</option>
        </select>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={!canDelete}
          className={`p-2.5 rounded-xl transition-colors ${
            !canDelete
              ? 'text-slate-300 cursor-not-allowed dark:text-slate-700'
              : 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expandable range for numeric non-equals */}
      <AnimatePresence>
        {hasCustomRange && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-4 border-l-2 border-purple-200 dark:border-purple-900/50 overflow-hidden"
          >
            <button
              onClick={() => setShowRange(!showRange)}
              className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center mb-1"
            >
              {showRange
                ? <><ChevronDown className="w-3 h-3 mr-1" /> Hide Custom Range</>
                : <><ChevronRight className="w-3 h-3 mr-1" /> Set Custom Range / Limits</>
              }
            </button>

            <AnimatePresence>
              {showRange && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 mt-2 overflow-hidden"
                >
                  <input
                    type="number"
                    placeholder="Min Value"
                    value={rule.customValue1 || ''}
                    onChange={(e) => onUpdate('customValue1', e.target.value)}
                    className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-xs w-28"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input
                    type="number"
                    placeholder="Max Value"
                    value={rule.customValue2 || ''}
                    onChange={(e) => onUpdate('customValue2', e.target.value)}
                    className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-xs w-28"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
