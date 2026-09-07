import React from 'react';
import { motion } from 'framer-motion';
import { Activity, X } from 'lucide-react';

interface ProcessingOverlayProps {
  progress: number;
  elapsedMs?: number;
  onCancel?: () => void;
}

const fmtElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ progress, elapsedMs = 0, onCancel }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-8 text-center"
      >
        <Activity className="w-12 h-12 text-blue-600 mx-auto mb-6 animate-pulse" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Reconciling Data</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Matching rows against your rules…</p>

        <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {progress}% · {fmtElapsed(elapsedMs)}
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-8 inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <X className="w-4 h-4 mr-1.5" /> Cancel
          </button>
        )}
      </motion.div>
    </div>
  );
};
