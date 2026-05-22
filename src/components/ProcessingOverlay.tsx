import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

interface ProcessingOverlayProps {
  progress: number;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ progress }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
       <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-8 text-center"
       >
         <Activity className="w-12 h-12 text-blue-600 mx-auto mb-6 animate-pulse" />
         <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Reconciling Data</h2>
         <p className="text-slate-500 dark:text-slate-400 mb-8">Applying your magic rules to find matches...</p>

         <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
           <motion.div 
             className="h-full bg-blue-600"
             initial={{ width: 0 }}
             animate={{ width: `${progress}%` }}
             transition={{ duration: 0.1 }}
           />
         </div>
         <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{progress}% Complete</div>
       </motion.div>
    </div>
  );
};
