import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronUp, ChevronDown, Bookmark, BookmarkCheck, GripVertical, Pencil, Check } from 'lucide-react';
import { RuleSection, MappingRule } from '../types';
import { RuleRow } from './RuleRow';

interface SectionCardProps {
  section: RuleSection;
  index: number;
  totalSections: number;
  bankColumns: string[];
  erpColumns: string[];
  isSaved: boolean;
  onUpdateSection: (section: RuleSection) => void;
  onDeleteSection: () => void;
  onSaveSection: () => void;
}

const ACCENT_COLORS = [
  { border: 'border-l-purple-500', bg: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', pill: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' },
  { border: 'border-l-teal-500', bg: 'bg-teal-500', text: 'text-teal-600 dark:text-teal-400', pill: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300' },
  { border: 'border-l-amber-500', bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', pill: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  { border: 'border-l-rose-500', bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', pill: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' },
  { border: 'border-l-blue-500', bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', pill: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', pill: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
];

export const SectionCard = ({
  section,
  index,
  totalSections,
  bankColumns,
  erpColumns,
  isSaved,
  onUpdateSection,
  onDeleteSection,
  onSaveSection,
}: SectionCardProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(section.name);

  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  const addRule = () => {
    const newRule: MappingRule = {
      id: crypto.randomUUID(),
      bankColumn: '',
      erpColumn: '',
      comparisonMode: 'text',
      operator: 'equals',
    };
    onUpdateSection({ ...section, rules: [...section.rules, newRule] });
  };

  const removeRule = (ruleId: string) => {
    if (section.rules.length <= 1) return;
    onUpdateSection({ ...section, rules: section.rules.filter(r => r.id !== ruleId) });
  };

  const updateRule = (ruleId: string, field: keyof MappingRule, value: string) => {
    onUpdateSection({
      ...section,
      rules: section.rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r),
    });
  };

  const handleNameSave = () => {
    onUpdateSection({ ...section, name: editName.trim() || section.name });
    setIsEditingName(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 border-l-4 ${accent.border} bg-white dark:bg-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none overflow-hidden`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 cursor-grab" />
          
          <div className={`w-2.5 h-2.5 rounded-full ${accent.bg}`} />

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                autoFocus
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-purple-400 rounded-lg px-2.5 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 w-48"
              />
              <button onClick={handleNameSave} className="p-1 text-green-500 hover:text-green-600 transition-colors">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditName(section.name); setIsEditingName(true); }}
              className="flex items-center gap-1.5 group"
            >
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{section.name}</span>
              <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accent.pill}`}>
            {section.rules.length} rule{section.rules.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Save/Bookmark */}
          <button
            onClick={onSaveSection}
            className={`p-2 rounded-lg transition-colors ${
              isSaved
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
            }`}
            title={isSaved ? 'Saved to library' : 'Save section to library'}
          >
            {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>

          {/* Collapse */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          {/* Delete */}
          <button
            onClick={onDeleteSection}
            disabled={totalSections <= 1}
            className={`p-2 rounded-lg transition-colors ${
              totalSections <= 1
                ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                : 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
            }`}
            title={totalSections <= 1 ? 'Cannot delete the only section' : 'Delete section'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rules Content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_1fr_minmax(110px,auto)_auto] gap-3 text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1">
                <div>Bank Column</div>
                <div className="w-36 text-center">Operator</div>
                <div>ERP Column</div>
                <div>Compare As</div>
                <div className="w-9"></div>
              </div>

              {section.rules.map((rule, ruleIdx) => (
                <div key={rule.id}>
                  <RuleRow
                    rule={rule}
                    bankColumns={bankColumns}
                    erpColumns={erpColumns}
                    canDelete={section.rules.length > 1}
                    onUpdate={(field, value) => updateRule(rule.id, field, value)}
                    onDelete={() => removeRule(rule.id)}
                  />

                  {/* AND connector between rules within section */}
                  {ruleIdx < section.rules.length - 1 && (
                    <div className="flex items-center justify-center my-2">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      <span className={`mx-3 text-xs font-bold px-3 py-1 rounded-full ${accent.pill}`}>
                        AND
                      </span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </div>
                  )}
                </div>
              ))}

              {/* Add Rule Button */}
              <button
                onClick={addRule}
                className={`flex items-center text-xs font-medium ${accent.text} hover:opacity-80 transition-opacity mt-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-current w-full justify-center`}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Mapping
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
