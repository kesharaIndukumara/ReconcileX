import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Settings2 } from 'lucide-react';

import { ParsedDataState, RuleConfiguration, RuleSection } from '../types';
import { StepIndicator } from '../components/StepIndicator';
import { useRuleTemplates, useSavedSections } from '../hooks/useDatabase';
import { Toast } from '../components/Toast';
import { RuleBuilderCanvas } from '../components/RuleBuilderCanvas';
import { flattenConfiguration } from '../utils/reconcile';

interface MappingLocationState {
  parsedData: ParsedDataState;
  bankFileName?: string;
  erpFileName?: string;
}

const isMappingLocationState = (
  state: MappingLocationState | ParsedDataState | null
): state is MappingLocationState => {
  if (!state || !('parsedData' in state)) return false;
  const parsedData = (state as MappingLocationState).parsedData;
  return Array.isArray(parsedData.bankData) && Array.isArray(parsedData.erpData);
};

/** Creates an initial blank configuration with one empty section */
const createInitialConfiguration = (): RuleConfiguration => ({
  sections: [
    {
      id: crypto.randomUUID(),
      name: 'Section 1',
      rules: [
        { id: crypto.randomUUID(), bankColumn: '', erpColumn: '', comparisonMode: 'text', operator: 'equals' },
      ],
    },
  ],
  connectors: [],
});

export const MappingScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as MappingLocationState | ParsedDataState | null;
  const parsedData = isMappingLocationState(state) ? state.parsedData : state;
  const bankFileName = isMappingLocationState(state) ? state.bankFileName : undefined;
  const erpFileName = isMappingLocationState(state) ? state.erpFileName : undefined;

  const { templates, loading: templatesLoading, saveConfigurationAsTemplate, getTemplateConfiguration } = useRuleTemplates();
  const { savedSections, saveSection, deleteSection } = useSavedSections();

  const [bankColumns, setBankColumns] = useState<string[]>([]);
  const [erpColumns, setErpColumns] = useState<string[]>([]);
  const [configuration, setConfiguration] = useState<RuleConfiguration>(createInitialConfiguration());

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'error' | 'success' }>({ show: false, msg: '', type: 'error' });

  useEffect(() => {
    if (!parsedData) {
      navigate('/');
      return;
    }

    if (parsedData.bankData.length > 0) {
      setBankColumns(Object.keys(parsedData.bankData[0]).filter(k => !k.startsWith('__EMPTY')));
    }
    if (parsedData.erpData.length > 0) {
      setErpColumns(Object.keys(parsedData.erpData[0]).filter(k => !k.startsWith('__EMPTY')));
    }
  }, [parsedData, navigate]);

  const loadTemplate = (templateId: string) => {
    const config = getTemplateConfiguration(templateId);
    if (config) {
      setConfiguration(config);
      const template = templates.find(t => t.id === templateId);
      setToast({ show: true, msg: `Loaded template: ${template?.name || 'Template'}`, type: 'success' });
    }
  };

  const handleSaveTemplate = async () => {
    // Validate: at least one section with at least one configured rule
    const validSections = configuration.sections.filter(
      s => s.rules.some(r => r.bankColumn && r.erpColumn)
    );
    if (validSections.length === 0) {
      setToast({ show: true, msg: 'Please configure at least one rule before saving', type: 'error' });
      return;
    }

    if (!templateName.trim()) {
      setToast({ show: true, msg: 'Please enter a template name', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const ruleId = await saveConfigurationAsTemplate(configuration, templateName, templateDescription || undefined);
      if (ruleId) {
        setToast({ show: true, msg: `Template "${templateName}" saved successfully!`, type: 'success' });
        setShowSaveModal(false);
        setTemplateName('');
        setTemplateDescription('');
      } else {
        setToast({ show: true, msg: 'Failed to save template', type: 'error' });
      }
    } catch (err) {
      setToast({ show: true, msg: `Error: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartReconciliation = () => {
    // Validate: at least one rule is fully configured
    const allRules = flattenConfiguration(configuration);
    const validRules = allRules.filter(r => r.bankColumn && r.erpColumn);

    if (validRules.length === 0) {
      setToast({ show: true, msg: 'Please map at least one pair of columns before continuing.', type: 'error' });
      return;
    }

    navigate('/reconciliation', {
      state: {
        parsedData,
        rules: validRules,
        configuration,
        bankFileName,
        erpFileName,
      },
    });
  };

  const handleSaveSection = async (section: RuleSection, name: string, description?: string) => {
    const validRules = section.rules.filter(r => r.bankColumn && r.erpColumn);
    if (validRules.length === 0) {
      setToast({ show: true, msg: 'Section must have at least one configured rule', type: 'error' });
      return;
    }
    await saveSection(section, name, description);
    setToast({ show: true, msg: `Section "${name}" saved to library!`, type: 'success' });
  };

  const handleDeleteSavedSection = async (sectionId: string) => {
    await deleteSection(sectionId);
    setToast({ show: true, msg: 'Section removed from library', type: 'success' });
  };

  if (!parsedData) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center">
      <StepIndicator currentStep={2} />
      <Toast
        message={toast.msg}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl pt-10 px-4"
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </button>

        <div className="mb-10 text-center md:text-left flex items-center gap-4">
          <div className="p-3 bg-purple-600 rounded-2xl shadow-lg shadow-purple-500/30">
            <Settings2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Rule Configuration Builder</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Build modular matching rules by grouping conditions into sections connected with AND / OR logic.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 border border-slate-100 dark:border-slate-700">
          <RuleBuilderCanvas
            configuration={configuration}
            bankColumns={bankColumns}
            erpColumns={erpColumns}
            savedSections={savedSections}
            onConfigurationChange={setConfiguration}
            onSaveSection={handleSaveSection}
            onDeleteSavedSection={handleDeleteSavedSection}
            onSaveTemplate={() => setShowSaveModal(true)}
            templateLoaderElement={
              templates.length > 0 ? (
                <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                    Load Saved Template
                  </h3>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        loadTemplate(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
                    disabled={templatesLoading}
                  >
                    <option value="">Select a template to load...</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.description ? `- ${template.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : undefined
            }
          />
        </div>

        <div className="mt-10 flex justify-end pb-10">
          <button
            onClick={handleStartReconciliation}
            className="flex items-center px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-bold shadow-xl hover:scale-105 hover:shadow-2xl transition-all active:scale-95"
          >
            Start Magic Reconciliation
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </motion.div>

      {/* Save Template Modal */}
      {showSaveModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowSaveModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Save Global Template</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Save all sections, rules, and logic connections as a reusable template.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Template Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Reconciliation Rules"
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description (Optional)</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Add a description to help you remember when to use this template..."
                  className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 resize-none h-24"
                />
              </div>

              {/* Configuration summary */}
              <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-3.5 text-sm">
                <span className="font-semibold text-purple-700 dark:text-purple-300">
                  {configuration.sections.length} section{configuration.sections.length !== 1 ? 's' : ''}
                </span>
                <span className="text-purple-500 dark:text-purple-400"> with </span>
                <span className="font-semibold text-purple-700 dark:text-purple-300">
                  {configuration.sections.reduce((n, s) => n + s.rules.length, 0)} total rule{configuration.sections.reduce((n, s) => n + s.rules.length, 0) !== 1 ? 's' : ''}
                </span>
                {configuration.connectors.length > 0 && (
                  <>
                    <span className="text-purple-500 dark:text-purple-400"> connected by </span>
                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      {configuration.connectors.map(c => c.logic).join(', ')}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={isSaving || !templateName.trim()}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
