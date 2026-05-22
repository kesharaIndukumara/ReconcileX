import React from 'react';
import { CheckCircle, XCircle, ListFilter } from 'lucide-react';

export type TabType = 'matched' | 'unmatchedBank' | 'unmatchedERP';

interface StatsCardsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  matchedCount: number;
  unmatchedBankCount: number;
  unmatchedERPCount: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  activeTab,
  setActiveTab,
  matchedCount,
  unmatchedBankCount,
  unmatchedERPCount
}) => {
  return (
    <div className="grid grid-cols-3 gap-6 mb-8">
      <button onClick={() => setActiveTab('matched')} className={`p-6 rounded-2xl border text-left transition-all ${activeTab === 'matched' ? 'bg-green-500 text-white shadow-lg border-green-500 scale-105' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-green-300'}`}>
        <div className="flex items-center justify-between">
          <CheckCircle className={`w-8 h-8 ${activeTab === 'matched' ? 'text-white' : 'text-green-500'}`} />
          <span className="text-2xl font-bold">{matchedCount}</span>
        </div>
        <div className={`mt-4 font-semibold ${activeTab === 'matched' ? 'text-green-50' : ''}`}>Matched Records</div>
      </button>

      <button onClick={() => setActiveTab('unmatchedBank')} className={`p-6 rounded-2xl border text-left transition-all ${activeTab === 'unmatchedBank' ? 'bg-red-500 text-white shadow-lg border-red-500 scale-105' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-300'}`}>
        <div className="flex items-center justify-between">
          <XCircle className={`w-8 h-8 ${activeTab === 'unmatchedBank' ? 'text-white' : 'text-red-500'}`} />
          <span className="text-2xl font-bold">{unmatchedBankCount}</span>
        </div>
        <div className={`mt-4 font-semibold ${activeTab === 'unmatchedBank' ? 'text-red-50' : ''}`}>Unmatched in Bank</div>
      </button>

      <button onClick={() => setActiveTab('unmatchedERP')} className={`p-6 rounded-2xl border text-left transition-all ${activeTab === 'unmatchedERP' ? 'bg-red-500 text-white shadow-lg border-red-500 scale-105' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-300'}`}>
        <div className="flex items-center justify-between">
          <ListFilter className={`w-8 h-8 ${activeTab === 'unmatchedERP' ? 'text-white' : 'text-red-500'}`} />
          <span className="text-2xl font-bold">{unmatchedERPCount}</span>
        </div>
        <div className={`mt-4 font-semibold ${activeTab === 'unmatchedERP' ? 'text-red-50' : ''}`}>Unmatched in ERP</div>
      </button>
    </div>
  );
};
