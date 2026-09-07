import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Settings2, Plus, Trash2, Save, FolderCog, Pencil, Copy, AlertTriangle, Wand2, Table } from 'lucide-react';

import { ParsedDataState, MappingRule, RuleTolerance, ComparisonMode, TransactionRow } from '../types';
import { StepIndicator } from '../components/StepIndicator';
import { InfoTip } from '../components/InfoTip';
import { useRuleTemplates } from '../hooks/useDatabase';
import { suggestMappings } from '../utils/mapping';
import { Toast } from '../components/Toast';

const TOLERANCE_OPTIONS: Record<ComparisonMode, { value: RuleTolerance['kind']; label: string; needsValue?: boolean }[]> = {
  text: [
    { value: 'exact', label: 'Exact' },
    { value: 'normalized', label: 'Ignore case & spacing' },
    { value: 'contains', label: 'One contains the other' },
    { value: 'alnum', label: 'Letters & digits only' },
  ],
  numeric: [
    { value: 'exact', label: 'Exact' },
    { value: 'amount', label: 'Within ± amount', needsValue: true },
    { value: 'percent', label: 'Within ± %', needsValue: true },
  ],
  date: [
    { value: 'exact', label: 'Exact' },
    { value: 'days', label: 'Within ± days', needsValue: true },
  ],
};

const toleranceFor = (kind: RuleTolerance['kind'], value: number): RuleTolerance => {
  if (kind === 'amount' || kind === 'percent' || kind === 'days') return { kind, value };
  if (kind === 'exact') return { kind: 'exact' };
  return { kind };
};

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

const INITIAL_RULE_ID = 'rule-init';

const newRule = (): MappingRule => ({ id: crypto.randomUUID(), bankColumn: '', erpColumn: '', comparisonMode: 'text' });

export const MappingScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as MappingLocationState | ParsedDataState | null;
  const parsedData = isMappingLocationState(state) ? state.parsedData : state;
  const bankFileName = isMappingLocationState(state) ? state.bankFileName : undefined;
  const erpFileName = isMappingLocationState(state) ? state.erpFileName : undefined;

  const {
    templates, loading: templatesLoading,
    saveAsTemplate, updateTemplate, deleteTemplate, duplicateTemplate,
    getLastUsedTemplate, setLastUsedTemplate,
  } = useRuleTemplates();

  const [bankColumns, setBankColumns] = useState<string[]>([]);
  const [erpColumns, setErpColumns] = useState<string[]>([]);
  const [rules, setRules] = useState<MappingRule[]>([
    { id: INITIAL_RULE_ID, bankColumn: '', erpColumn: '', comparisonMode: 'text' },
  ]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManager, setShowManager] = useState(false);
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

  // Auto-load the last used template, once, while the rule list is still untouched.
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current || templatesLoading || templates.length === 0) return;
    const pristine = rules.length === 1 && rules[0].id === INITIAL_RULE_ID && !rules[0].bankColumn && !rules[0].erpColumn;
    if (!pristine) return;
    const last = getLastUsedTemplate();
    if (last) {
      autoLoadedRef.current = true;
      setRules(last.rules.map(r => ({ ...r, id: crypto.randomUUID() })));
      setToast({ show: true, msg: `Loaded your last template: ${last.name}`, type: 'success' });
    }
  }, [templatesLoading, templates, rules, getLastUsedTemplate]);

  const addRule = () => setRules(prev => [...prev, newRule()]);
  const removeRule = (id: string) => setRules(prev => prev.filter(r => r.id !== id));
  const updateRule = (id: string, field: keyof MappingRule, value: string) =>
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: value };
      // Reset tolerance when the comparison mode changes — the kinds differ per mode.
      if (field === 'comparisonMode') next.tolerance = { kind: 'exact' };
      return next;
    }));

  const setTolerance = (id: string, tolerance: RuleTolerance) =>
    setRules(prev => prev.map(r => (r.id === id ? { ...r, tolerance } : r)));

  const previewRows = useMemo(() => ({
    bank: (parsedData?.bankData ?? []).slice(0, 4),
    erp: (parsedData?.erpData ?? []).slice(0, 4),
  }), [parsedData]);

  const handleSuggest = () => {
    if (bankColumns.length === 0 || erpColumns.length === 0) return;
    const suggested = suggestMappings(bankColumns, erpColumns);
    if (suggested.length === 0) {
      setToast({ show: true, msg: 'No confident column matches — map them manually.', type: 'error' });
      return;
    }
    setRules(suggested);
    setToast({ show: true, msg: `Suggested ${suggested.length} rule${suggested.length === 1 ? '' : 's'} — review before running.`, type: 'success' });
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    setRules(template.rules.map(r => ({ ...r, id: crypto.randomUUID() })));
    void setLastUsedTemplate(template.id);
    setToast({ show: true, msg: `Loaded template: ${template.name}`, type: 'success' });
  };

  // ---- validation --------------------------------------------------------
  const validRules = useMemo(() => rules.filter(r => r.bankColumn && r.erpColumn), [rules]);
  const ruleIssues = useMemo(() => {
    const issues: string[] = [];
    if (rules.some(r => (r.bankColumn && !r.erpColumn) || (!r.bankColumn && r.erpColumn))) {
      issues.push('One or more rows have only one side filled in — pick both a Bank and an ERP column.');
    }
    const dupBank = new Set<string>();
    const seenBank = new Set<string>();
    for (const r of validRules) {
      if (seenBank.has(r.bankColumn)) dupBank.add(r.bankColumn);
      seenBank.add(r.bankColumn);
    }
    if (dupBank.size > 0) issues.push(`Bank column used more than once: ${[...dupBank].join(', ')}.`);
    const dupErp = new Set<string>();
    const seenErp = new Set<string>();
    for (const r of validRules) {
      if (seenErp.has(r.erpColumn)) dupErp.add(r.erpColumn);
      seenErp.add(r.erpColumn);
    }
    if (dupErp.size > 0) issues.push(`ERP column used more than once: ${[...dupErp].join(', ')}.`);
    return issues;
  }, [rules, validRules]);

  const handleSaveTemplate = async () => {
    if (validRules.length === 0) {
      setToast({ show: true, msg: 'Configure at least one complete rule before saving.', type: 'error' });
      return;
    }
    if (!templateName.trim()) {
      setToast({ show: true, msg: 'Please enter a template name.', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const ruleId = await saveAsTemplate(validRules, templateName.trim(), templateDescription.trim() || undefined);
      if (ruleId) {
        setToast({ show: true, msg: `Template "${templateName.trim()}" saved.`, type: 'success' });
        setShowSaveModal(false);
        setTemplateName('');
        setTemplateDescription('');
      } else {
        setToast({ show: true, msg: 'Failed to save template.', type: 'error' });
      }
    } catch (err) {
      setToast({ show: true, msg: `Error: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenameTemplate = async (id: string, currentName: string, description?: string) => {
    const next = window.prompt('Rename template', currentName);
    if (next === null) return;
    const name = next.trim();
    if (!name || name === currentName) return;
    const ok = await updateTemplate(id, name, description);
    setToast({ show: true, msg: ok ? 'Template renamed.' : 'Rename failed.', type: ok ? 'success' : 'error' });
  };

  const handleDuplicateTemplate = async (id: string, currentName: string) => {
    const ruleId = await duplicateTemplate(id, `${currentName} (copy)`);
    setToast({ show: true, msg: ruleId ? 'Template duplicated.' : 'Duplicate failed.', type: ruleId ? 'success' : 'error' });
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    const ok = await deleteTemplate(id);
    setToast({ show: true, msg: ok ? 'Template deleted.' : 'Delete failed.', type: ok ? 'success' : 'error' });
  };

  const handleStartReconciliation = () => {
    if (validRules.length === 0) {
      setToast({ show: true, msg: 'Map at least one pair of columns before continuing.', type: 'error' });
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl pt-10 pb-16 px-4">
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
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Map your Bank columns to your ERP columns. A row is matched only when <em>every</em> rule agrees (AND).
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 border border-slate-100 dark:border-slate-700">

          {templates.length > 0 && (
            <div className="mb-8 pb-8 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Load Saved Template</h3>
                <button
                  onClick={() => setShowManager(true)}
                  className="flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <FolderCog className="w-4 h-4 mr-1" /> Manage
                </button>
              </div>
              <select
                onChange={(e) => { if (e.target.value) { loadTemplate(e.target.value); e.target.value = ''; } }}
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
                disabled={templatesLoading}
              >
                <option value="">Select a template to load...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.description ? ` - ${t.description}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {(previewRows.bank.length > 0 || previewRows.erp.length > 0) && (
            <div className="mb-8 grid md:grid-cols-2 gap-4">
              {(['bank', 'erp'] as const).map(side => {
                const cols = side === 'bank' ? bankColumns : erpColumns;
                const rows = previewRows[side] as TransactionRow[];
                return (
                  <div key={side} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center">
                      <Table className="w-3.5 h-3.5 mr-1.5" /> {side === 'bank' ? 'Bank' : 'ERP'} preview
                    </div>
                    <div className="overflow-x-auto max-h-40">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <tr>{cols.slice(0, 6).map(c => <th key={c} className="px-3 py-1.5 font-medium whitespace-nowrap">{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.map((r, ri) => (
                            <tr key={ri} className="border-b border-slate-100 dark:border-slate-700/50">
                              {cols.slice(0, 6).map(c => (
                                <td key={c} className="px-3 py-1.5 text-slate-600 dark:text-slate-300 whitespace-nowrap truncate max-w-[140px]">{String(r[c] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Matching Rules</h3>
            <button
              onClick={handleSuggest}
              className="flex items-center text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 dark:bg-purple-500/10 px-3 py-1.5 rounded-full transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 mr-1" /> Suggest mappings
            </button>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr_minmax(120px,auto)_auto] gap-4 mb-4 text-sm font-semibold text-slate-500 uppercase tracking-wider px-2">
            <div>Bank Statement Column</div>
            <div className="w-8" />
            <div>ERP Statement Column</div>
            <div className="flex items-center gap-1">
              Compare As
              <InfoTip text="Text: case-insensitive match. Numeric: strips commas, compares the number. Date: parses both sides. Add slack with the Tolerance row." />
            </div>
            <div className="w-10" />
          </div>

          <div className="space-y-4 mb-6">
            {rules.map((rule) => {
              const halfFilled = (rule.bankColumn && !rule.erpColumn) || (!rule.bankColumn && rule.erpColumn);
              return (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex flex-col gap-3 p-4 rounded-2xl border transition-colors ${
                    halfFilled
                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-800'
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                  }`}
                >
                  <div className="grid grid-cols-[1fr_auto_1fr_minmax(120px,auto)_auto] items-center gap-4">
                    <select
                      value={rule.bankColumn}
                      onChange={(e) => updateRule(rule.id, 'bankColumn', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
                    >
                      <option value="">Select Bank Column...</option>
                      {bankColumns.map(col => <option key={`bank-${col}`} value={col}>{col}</option>)}
                    </select>

                    <div className="flex items-center gap-1 font-mono text-xs text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                      MUST EQUAL
                      <InfoTip text="The two columns must hold the same value for a row to be considered a match." />
                    </div>

                    <select
                      value={rule.erpColumn}
                      onChange={(e) => updateRule(rule.id, 'erpColumn', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900"
                    >
                      <option value="">Select ERP Column...</option>
                      {erpColumns.map(col => <option key={`erp-${col}`} value={col}>{col}</option>)}
                    </select>

                    <select
                      value={rule.comparisonMode || 'text'}
                      onChange={(e) => updateRule(rule.id, 'comparisonMode', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="numeric">Numeric</option>
                      <option value="date">Date</option>
                    </select>

                    <button
                      onClick={() => removeRule(rule.id)}
                      disabled={rules.length === 1}
                      aria-label="Remove rule"
                      className={`p-3 rounded-xl transition-colors ${
                        rules.length === 1
                          ? 'text-slate-300 cursor-not-allowed dark:text-slate-700'
                          : 'text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                      }`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {(() => {
                    const mode: ComparisonMode = rule.comparisonMode ?? 'text';
                    const opts = TOLERANCE_OPTIONS[mode];
                    const kind = rule.tolerance?.kind ?? 'exact';
                    const value = rule.tolerance && 'value' in rule.tolerance ? rule.tolerance.value : 1;
                    const needsValue = opts.find(o => o.value === kind)?.needsValue;
                    return (
                      <div className="flex items-center gap-2 pl-1 text-sm text-slate-500 dark:text-slate-400">
                        <span className="text-xs uppercase tracking-wider">Tolerance</span>
                        <select
                          value={kind}
                          onChange={(e) => setTolerance(rule.id, toleranceFor(e.target.value as RuleTolerance['kind'], value))}
                          className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                        >
                          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {needsValue && (
                          <input
                            type="number"
                            min={0}
                            step={mode === 'numeric' ? 0.01 : 1}
                            value={value}
                            onChange={(e) => setTolerance(rule.id, toleranceFor(kind, Math.max(0, Number(e.target.value) || 0)))}
                            className="w-24 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-purple-500"
                          />
                        )}
                      </div>
                    );
                  })()}
                </motion.div>
              );
            })}
          </div>

          {ruleIssues.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm text-amber-800 dark:text-amber-300">
              <div className="flex items-center font-semibold mb-1">
                <AlertTriangle className="w-4 h-4 mr-2" /> Check your rules
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {ruleIssues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
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
                  placeholder="When should you reach for this template?"
                  className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 resize-none h-24"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
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

      {showManager && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowManager(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Manage Templates</h2>
            {templates.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">No templates saved yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">{t.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {t.rules.length} rule{t.rules.length === 1 ? '' : 's'}{t.description ? ` · ${t.description}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => loadTemplate(t.id)} className="px-2.5 py-1.5 text-xs rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-colors">Load</button>
                      <button onClick={() => handleRenameTemplate(t.id, t.name, t.description)} aria-label="Rename" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDuplicateTemplate(t.id, t.name)} aria-label="Duplicate" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteTemplate(t.id, t.name)} aria-label="Delete" className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowManager(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
