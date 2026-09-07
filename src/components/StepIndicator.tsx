import React from 'react';
import { ThemeToggle } from './ThemeToggle';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Map' },
    { num: 3, label: 'Reconcile' }
  ];

  return (
    <div className="relative w-full flex justify-center py-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center space-x-4 max-w-xl w-full px-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.num}>
            <div className={`flex flex-col items-center flex-1 ${currentStep >= step.num ? 'opacity-100' : 'opacity-40'}`}>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300
                 ${currentStep === step.num ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' :
                   currentStep > step.num ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}
               `}>
                 {currentStep > step.num ? '✓' : step.num}
               </div>
               <span className={`mt-2 text-xs font-semibold tracking-wider uppercase ${currentStep === step.num ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                 {step.label}
               </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${currentStep > step.num ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
      <ThemeToggle className="absolute right-4 top-1/2 -translate-y-1/2" />
    </div>
  );
};
