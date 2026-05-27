import { motion } from 'framer-motion';
import { LogicOperator } from '../types';

interface LogicConnectorProps {
  logic: LogicOperator;
  onChange: (logic: LogicOperator) => void;
}

export const LogicConnector = ({ logic, onChange }: LogicConnectorProps) => {
  const isAnd = logic === 'AND';

  return (
    <div className="flex items-center justify-center py-2 relative">
      {/* Vertical connecting lines */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300 dark:from-slate-600 via-transparent to-slate-300 dark:to-slate-600" />

      {/* Connector Pill */}
      <motion.button
        onClick={() => onChange(isAnd ? 'OR' : 'AND')}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm shadow-lg transition-all duration-300 cursor-pointer border-2 ${
          isAnd
            ? 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40 shadow-purple-200/50 dark:shadow-purple-500/10'
            : 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 shadow-teal-200/50 dark:shadow-teal-500/10'
        }`}
        title={`Click to switch to ${isAnd ? 'OR' : 'AND'}`}
      >
        {/* Glow effect */}
        <div className={`absolute inset-0 rounded-full opacity-30 blur-md ${
          isAnd ? 'bg-purple-400' : 'bg-teal-400'
        }`} />
        
        <span className="relative flex items-center gap-2">
          {/* Toggle dots */}
          <span className="flex gap-1">
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isAnd ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
            }`} />
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
              !isAnd ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'
            }`} />
          </span>
          
          <span className="relative">{logic}</span>
          
          {/* Toggle hint */}
          <span className={`text-xs font-normal opacity-60`}>
            ↔ {isAnd ? 'OR' : 'AND'}
          </span>
        </span>
      </motion.button>
    </div>
  );
};
