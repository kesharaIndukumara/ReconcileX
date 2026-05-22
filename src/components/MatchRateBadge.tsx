import React from 'react';
import { motion } from 'framer-motion';

interface MatchRateBadgeProps {
  progress: number;
}

export const MatchRateBadge: React.FC<MatchRateBadgeProps> = ({ progress }) => {
  const getBadgeStyle = () => {
    if (progress >= 90) return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300';
    if (progress >= 50) return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300';
    return 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300';
  };

  const getProgressBarStyle = () => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    return 'bg-orange-500';
  };

  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex items-center rounded-2xl px-6 py-4 shadow-inner border ${getBadgeStyle()}`}
    >
      <div className="mr-4">
        <div className="text-sm font-semibold uppercase tracking-wider opacity-80 mb-1">Match Rate</div>
        <div className="text-4xl font-extrabold">{progress}%</div>
      </div>
      <div className="flex flex-col gap-1 w-32">
        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`h-full rounded-full ${getProgressBarStyle()}`}
          />
        </div>
      </div>
    </motion.div>
  );
};
