import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Library, Trash2, Import, ChevronLeft, Layers, X } from 'lucide-react';
import { SavedSection } from '../types';

interface SavedSectionsPanelProps {
  savedSections: SavedSection[];
  isOpen: boolean;
  onToggle: () => void;
  onImport: (section: SavedSection) => void;
  onDelete: (sectionId: string) => void;
}

export const SavedSectionsPanel = ({
  savedSections,
  isOpen,
  onToggle,
  onImport,
  onDelete,
}: SavedSectionsPanelProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      onDelete(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      // Auto-cancel confirm after 3s
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  return (
    <>
      {/* Toggle Button (when closed) */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-r-0 rounded-l-xl px-2 py-4 shadow-lg hover:shadow-xl transition-shadow group"
          title="Open Saved Sections Library"
        >
          <div className="flex flex-col items-center gap-2">
            <Library className="w-5 h-5 text-purple-500" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 [writing-mode:vertical-lr] rotate-180">
              Library
            </span>
            {savedSections.length > 0 && (
              <span className="w-5 h-5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold flex items-center justify-center">
                {savedSections.length}
              </span>
            )}
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition-colors" />
          </div>
        </motion.button>
      )}

      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-80 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                  <Library className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Saved Sections</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{savedSections.length} reusable section{savedSections.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={onToggle}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedSections.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No saved sections yet</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Click the bookmark icon on any section to save it here
                  </p>
                </div>
              ) : (
                savedSections.map((saved) => (
                  <motion.div
                    key={saved.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {saved.name}
                        </h4>
                        {saved.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {saved.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        {saved.section.rules.length} rule{saved.section.rules.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Rule preview */}
                    <div className="space-y-1 mb-3">
                      {saved.section.rules.slice(0, 2).map((rule) => (
                        <div key={rule.id} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                          <span className="font-medium text-slate-600 dark:text-slate-300">{rule.bankColumn || '—'}</span>
                          <span className="text-purple-500">{rule.operator || '='}</span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">{rule.erpColumn || '—'}</span>
                        </div>
                      ))}
                      {saved.section.rules.length > 2 && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          +{saved.section.rules.length - 2} more
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onImport(saved)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Import className="w-3 h-3" />
                        Import
                      </button>
                      <button
                        onClick={() => handleDelete(saved.id)}
                        className={`flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          deletingId === saved.id
                            ? 'text-white bg-red-500 hover:bg-red-600'
                            : 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingId === saved.id ? 'Confirm' : 'Delete'}
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
