import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Settings2, Plus, Trash2, Save } from 'lucide-react';

import { ParsedDataState, MappingRule } from '../types';
import { StepIndicator } from '../components/StepIndicator';
import { useRuleTemplates } from '../hooks/useDatabase';
import { Toast } from '../components/Toast';

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

export const MappingScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const state = location.state as MappingLocationState | ParsedDataState | null;
  const parsedData = isMappingLocationState(state) ? state.parsedData : state;
  const bankFileName = isMappingLocationState(state) ? state.bankFileName : undefined;
  const erpFileName = isMappingLocationState(state) ? state.erpFileName : undefined;
  const { templates, loading: templatesLoading, saveAsTemplate } = useRuleTemplates();

  const [bankColumns, setBankColumns] = useState<string[]>([]);
  const [erpColumns, setErpColumns] = useState<string[]>([]);
  const [rules, setRules] = useState<MappingRule[]>([
    { id: 'date-rule-init', bankColumn: '', erpColumn: '', comparisonMode: 'text', operator: 'equals' },
  ]);
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'error' | 'success' }>({ show: false, msg: '', type: 'error' });
  const [expandedRules, setExpandedRules] = useState<string[]>([]);

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

  const addRule = () => {
    setRules([...rules, { id: crypto.randomUUID(), bankColumn: '', erpColumn: '', comparisonMode: 'text', operator: 'equals' }]);
  };

  const toggleExpanded = (id: string) => {
    setExpandedRules(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const updateRule = (id: string, field: keyof MappingRule, value: string) => {
    setRules(rules.map(rule => rule.id === id ? { ...rule, [field]: value } : rule));
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setRules(template.rules.map(r => ({ ...r, id: crypto.randomUUID() })));
      setToast({ show: true, msg: `Loaded template: ${template.name}`, type: 'success' });
    }
  };

  const handleSaveTemplate = async () => {
    const validRules = rules.filter(r => r.bankColumn && r.erpColumn);
    if (validRules.length === 0) {
      setToast({ show: true, msg: 'Please configure at least one rule before saving', type: 'error' });
      return;
    }

    if (!templateName.trim()) {
      setToast({ show: true, msg: 'Please enter a template name', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const ruleId = await saveAsTemplate(validRules, templateName, templateDescription || undefined);
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
    const validRules = rules.filter(r => r.bankColumn && r.erpColumn);
    if (validRules.length === 0) {
      alert("Please map at least one pair of columns before continuing.");
      return;
    }

    navigate('/reconciliation', { state: { parsedData, rules: validRules, bankFileName, erpFileName } });
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
        className="w-full max-w-4xl pt-10"
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Configure Processing Rules</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">Map your Bank columns to your ERP columns to tell the system how to match them.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 border border-slate-100 dark:border-slate-700">
          
          {/* Template Loader */}
          {templates.length > 0 && (
            <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Load Saved Template</h3>
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
          )}
          
          {/* Rules Header */}
          <div className="grid grid-cols-[1fr_auto_1fr_minmax(120px,auto)_auto] gap-4 mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wider px-2">
            <div>Bank Statement Column</div>
            <div className="w-8"></div>
            <div>ERP Statement Column</div>
            <div>Compare As</div>
            <div className="w-10"></div>
          </div>

          {/* Rules List */}
          <div className="space-y-4 mb-8">
            {rules.map((rule) => (
              <motion.div 
                key={rule.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 transition-colors"
              >
                <div className="grid grid-cols-[1fr_auto_1fr_minmax(120px,auto)_auto] items-center gap-4 w-full">
                  <select 
                    value={rule.bankColumn}
                    onChange={(e) => updateRule(rule.id, 'bankColumn', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
                  >
                    <option value="" >Select Bank Column...</option>
                    {bankColumns.map(col => (
                      <option key={`bank-${col}`} value={col}>{col}</option>
                    ))}
                  </select>

                  <select
                    value={rule.operator || 'equals'}
                    onChange={(e) => updateRule(rule.id, 'operator', e.target.value)}
                    className="w-40 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm font-semibold"
                  >
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="less-than">Less Than</option>
                    <option value="greater-than">Greater Than</option>
                    <option value="less-than-or-equal">Less Than or Eq</option>
                    <option value="greater-than-or-equal">Greater Than or Eq</option>
                  </select>

                  <select 
                    value={rule.erpColumn}
                    onChange={(e) => updateRule(rule.id, 'erpColumn', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
                  >
                    <option value="">Select ERP Column...</option>
                    {erpColumns.map(col => (
                      <option key={`erp-${col}`} value={col}>{col}</option>
                    ))}
                  </select>

                  <select
                    value={rule.comparisonMode || 'text'}
                    onChange={(e) => updateRule(rule.id, 'comparisonMode', e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm"
                  >
                    <option value="text">Text (Exact)</option>
                    <option value="numeric">Numeric</option>
                  </select>

                  <button 
                    onClick={() => removeRule(rule.id)}
                    disabled={rules.length === 1}
                    className={`p-3 rounded-xl transition-colors ${
                      rules.length === 1 
                        ? 'text-slate-300 cursor-not-allowed dark:text-slate-700' 
                        : 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                    }`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {rule.comparisonMode === 'numeric' && rule.operator !== 'equals' && (
                  <div className="pl-4 border-l-2 border-purple-200 dark:border-purple-900/50 mt-2">
                    <button 
                      onClick={() => toggleExpanded(rule.id)}
                      className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center mb-1"
                    >
                      {expandedRules.includes(rule.id) ? '▼ Hide Custom Range' : '▶ Set Custom Range / Limits'}
                    </button>
                    
                    {expandedRules.includes(rule.id) && (
                      <div className="flex items-center gap-4 mt-3">
                        <input 
                          type="number" 
                          placeholder="Min Value" 
                          value={rule.customValue1 || ''}
                          onChange={(e) => updateRule(rule.id, 'customValue1', e.target.value)}
                          className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm w-32"
                        />
                        <input 
                          type="number" 
                          placeholder="Max Value" 
                          value={rule.customValue2 || ''}
                          onChange={(e) => updateRule(rule.id, 'customValue2', e.target.value)}
                          className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm w-32"
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="flex gap-4 mb-8">
            <button 
              onClick={addRule}
              className="flex items-center text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 transition-colors bg-purple-50 dark:bg-purple-500/10 px-5 py-3 rounded-full"
            >
              <Plus className="w-5 h-5 mr-1" />
              Add Matching Condition (AND)
            </button>

            <button 
              onClick={() => setShowSaveModal(true)}
              className="flex items-center text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 transition-colors bg-blue-50 dark:bg-blue-500/10 px-5 py-3 rounded-full"
            >
              <Save className="w-5 h-5 mr-1" />
              Save as Template
            </button>
          </div>
        </div>

        <div className="mt-10 flex justify-end">
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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Save Rule Template</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Template Name *</label>
                <input 
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Jan 2026 Standard Rules"
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
