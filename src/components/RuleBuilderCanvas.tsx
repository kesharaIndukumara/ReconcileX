import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Import, Save, FileDown } from 'lucide-react';
import {
  RuleConfiguration,
  RuleSection,
  SectionConnector,
  LogicOperator,
  SavedSection,
} from '../types';
import { SectionCard } from './SectionCard';
import { LogicConnector } from './LogicConnector';
import { SavedSectionsPanel } from './SavedSectionsPanel';

interface RuleBuilderCanvasProps {
  configuration: RuleConfiguration;
  bankColumns: string[];
  erpColumns: string[];
  savedSections: SavedSection[];
  onConfigurationChange: (config: RuleConfiguration) => void;
  onSaveSection: (section: RuleSection, name: string, description?: string) => void;
  onDeleteSavedSection: (sectionId: string) => void;
  onSaveTemplate: () => void;
  templateLoaderElement?: React.ReactNode;
}

/** Helper to create a default blank section */
const createBlankSection = (index: number): RuleSection => ({
  id: crypto.randomUUID(),
  name: `Section ${index}`,
  rules: [
    {
      id: crypto.randomUUID(),
      bankColumn: '',
      erpColumn: '',
      comparisonMode: 'text',
      operator: 'equals',
    },
  ],
});

export const RuleBuilderCanvas = ({
  configuration,
  bankColumns,
  erpColumns,
  savedSections,
  onConfigurationChange,
  onSaveSection,
  onDeleteSavedSection,
  onSaveTemplate,
  templateLoaderElement,
}: RuleBuilderCanvasProps) => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [saveSectionName, setSaveSectionName] = useState('');
  const [saveSectionDesc, setSaveSectionDesc] = useState('');

  const { sections, connectors } = configuration;

  // ============ SECTION OPERATIONS ============

  const updateSection = useCallback(
    (updatedSection: RuleSection) => {
      onConfigurationChange({
        ...configuration,
        sections: sections.map(s => (s.id === updatedSection.id ? updatedSection : s)),
      });
    },
    [configuration, sections, onConfigurationChange]
  );

  const addSection = useCallback(() => {
    const newSection = createBlankSection(sections.length + 1);
    const newConnector: SectionConnector = {
      afterSectionId: sections[sections.length - 1]?.id || '',
      logic: 'AND' as LogicOperator,
    };

    onConfigurationChange({
      sections: [...sections, newSection],
      connectors: sections.length > 0 ? [...connectors, newConnector] : connectors,
    });
  }, [sections, connectors, onConfigurationChange]);

  const deleteSection = useCallback(
    (sectionId: string) => {
      if (sections.length <= 1) return;
      const idx = sections.findIndex(s => s.id === sectionId);
      const newSections = sections.filter(s => s.id !== sectionId);

      // Rebuild connectors — remove the connector adjacent to the deleted section
      let newConnectors: SectionConnector[] = [];
      if (newSections.length > 1) {
        // We need connectors.length = newSections.length - 1
        // After removing section at `idx`, we rebuild
        for (let i = 0; i < newSections.length - 1; i++) {
          // Try to preserve existing connector logic where possible
          const originalIdx = i >= idx ? i + 1 : i;
          const existingConnector = connectors[originalIdx < connectors.length ? originalIdx : i];
          newConnectors.push({
            afterSectionId: newSections[i].id,
            logic: existingConnector?.logic || 'AND',
          });
        }
      }

      onConfigurationChange({ sections: newSections, connectors: newConnectors });
    },
    [sections, connectors, onConfigurationChange]
  );

  const updateConnectorLogic = useCallback(
    (index: number, logic: LogicOperator) => {
      const newConnectors = [...connectors];
      newConnectors[index] = { ...newConnectors[index], logic };
      onConfigurationChange({ ...configuration, connectors: newConnectors });
    },
    [configuration, connectors, onConfigurationChange]
  );

  const importSection = useCallback(
    (saved: SavedSection) => {
      // Deep clone the section with new IDs
      const importedSection: RuleSection = {
        ...saved.section,
        id: crypto.randomUUID(),
        name: `${saved.name} (imported)`,
        rules: saved.section.rules.map(r => ({ ...r, id: crypto.randomUUID() })),
      };

      const newConnector: SectionConnector = {
        afterSectionId: sections[sections.length - 1]?.id || '',
        logic: 'AND',
      };

      onConfigurationChange({
        sections: [...sections, importedSection],
        connectors: sections.length > 0 ? [...connectors, newConnector] : connectors,
      });
    },
    [sections, connectors, onConfigurationChange]
  );

  const handleSaveSectionSubmit = () => {
    const section = sections.find(s => s.id === savingSectionId);
    if (section && saveSectionName.trim()) {
      onSaveSection(section, saveSectionName.trim(), saveSectionDesc.trim() || undefined);
      setSavingSectionId(null);
      setSaveSectionName('');
      setSaveSectionDesc('');
    }
  };

  const isSectionSaved = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return false;
    // A section is "saved" if a saved section with the same rules structure exists
    return savedSections.some(saved =>
      saved.section.rules.length === section.rules.length &&
      saved.section.rules.every((r, i) =>
        r.bankColumn === section.rules[i]?.bankColumn &&
        r.erpColumn === section.rules[i]?.erpColumn
      )
    );
  };

  // ============ COMPUTED EXPRESSION ============

  const getExpressionPreview = (): string => {
    if (sections.length === 0) return '';
    let expr = `(${sections[0].name})`;
    for (let i = 1; i < sections.length; i++) {
      const logic = connectors[i - 1]?.logic || 'AND';
      expr += ` ${logic} (${sections[i].name})`;
    }
    return expr;
  };

  return (
    <div className="relative">
      {/* Template Loader (passed in from parent) */}
      {templateLoaderElement}

      {/* Expression Preview */}
      {sections.length > 1 && (
        <div className="mb-6 p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1.5">
            <FileDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Evaluation Expression
            </span>
          </div>
          <code className="text-sm font-mono text-purple-600 dark:text-purple-400 break-all">
            {getExpressionPreview()}
          </code>
        </div>
      )}

      {/* Sections + Connectors */}
      <div className="space-y-0">
        <AnimatePresence mode="popLayout">
          {sections.map((section, idx) => (
            <div key={section.id}>
              <SectionCard
                section={section}
                index={idx}
                totalSections={sections.length}
                bankColumns={bankColumns}
                erpColumns={erpColumns}
                isSaved={isSectionSaved(section.id)}
                onUpdateSection={updateSection}
                onDeleteSection={() => deleteSection(section.id)}
                onSaveSection={() => {
                  setSavingSectionId(section.id);
                  setSaveSectionName(section.name);
                  setSaveSectionDesc('');
                }}
              />

              {/* Logic Connector between sections */}
              {idx < sections.length - 1 && (
                <LogicConnector
                  logic={connectors[idx]?.logic || 'AND'}
                  onChange={(logic) => updateConnectorLogic(idx, logic)}
                />
              )}
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center gap-3 mt-8">
        <button
          onClick={addSection}
          className="flex items-center text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 transition-colors bg-purple-50 dark:bg-purple-500/10 px-5 py-3 rounded-full border-2 border-dashed border-purple-300 dark:border-purple-500/30 hover:border-purple-400"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add New Rule
        </button>

        <button
          onClick={() => setLibraryOpen(true)}
          className="flex items-center text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors bg-teal-50 dark:bg-teal-500/10 px-5 py-3 rounded-full"
        >
          <Import className="w-4 h-4 mr-1.5" />
          Import Saved Rule
        </button>

        <button
          onClick={onSaveTemplate}
          className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors bg-blue-50 dark:bg-blue-500/10 px-5 py-3 rounded-full"
        >
          <Save className="w-4 h-4 mr-1.5" />
          Save as Template
        </button>
      </div>

      {/* Saved Sections Sidebar */}
      <SavedSectionsPanel
        savedSections={savedSections}
        isOpen={libraryOpen}
        onToggle={() => setLibraryOpen(!libraryOpen)}
        onImport={(saved) => {
          importSection(saved);
          setLibraryOpen(false);
        }}
        onDelete={onDeleteSavedSection}
      />

      {/* Save Section Modal */}
      {savingSectionId && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSavingSectionId(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Save Section to Library</h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Section Name *
                </label>
                <input
                  type="text"
                  value={saveSectionName}
                  onChange={(e) => setSaveSectionName(e.target.value)}
                  placeholder="e.g., Amount Matching"
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  value={saveSectionDesc}
                  onChange={(e) => setSaveSectionDesc(e.target.value)}
                  placeholder="Add a description..."
                  className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm resize-none h-20"
                />
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => setSavingSectionId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSectionSubmit}
                disabled={!saveSectionName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
