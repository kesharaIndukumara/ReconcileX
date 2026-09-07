import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Sparkles, Search, Check, X, Layers, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { MappingRule, ReconciliationResults, TransactionRow, DuplicateGroup, GroupMatch } from '../types';
import { nearestCandidate } from '../utils/reconcile';
import { TabType } from './StatsCards';

interface ResultsTableProps {
  activeTab: TabType;
  results: ReconciliationResults;
  rules: MappingRule[];
  duplicateGroups?: DuplicateGroup[];
}

const PAGE_SIZE = 50;

const uniqueCols = (rules: MappingRule[], side: 'bank' | 'erp') =>
  Array.from(new Set(rules.map(r => (side === 'bank' ? r.bankColumn : r.erpColumn)).filter(Boolean)));

const EmptyState = () => (
  <div className="text-center py-20 text-slate-500 dark:text-slate-400">No records in this category.</div>
);

const fmtCell = (v: unknown) => {
  if (typeof v === 'number') return v.toLocaleString();
  return String(v ?? '');
};

const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; count: number }> = ({ value, onChange, count }) => (
  <div className="mb-3 flex items-center gap-3">
    <div className="relative flex-1 max-w-xs">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Filter rows…"
        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 outline-none focus:border-blue-500"
      />
    </div>
    <span className="text-xs text-slate-500 dark:text-slate-400">{count.toLocaleString()} rows</span>
  </div>
);

const Pager: React.FC<{ page: number; pages: number; onPage: (p: number) => void }> = ({ page, pages, onPage }) => {
  if (pages <= 1) return null;
  return (
    <div className="p-3 flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
      <button onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} className="p-1.5 rounded disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span>Page {page + 1} of {pages}</span>
      <button onClick={() => onPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} className="p-1.5 rounded disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------- duplicates
const DuplicatesView: React.FC<{ groups: DuplicateGroup[]; rules: MappingRule[] }> = ({ groups, rules }) => {
  if (groups.length === 0) return <div className="text-center py-20 text-slate-500">No duplicate rows detected.</div>;
  return (
    <div className="space-y-4">
      {groups.slice(0, 50).map((group, gi) => {
        const keys = uniqueCols(rules, group.side);
        return (
          <div key={gi} className="rounded-xl border border-yellow-200 dark:border-yellow-800/50 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-yellow-50 dark:bg-yellow-900/20 text-sm">
              <span className="font-semibold text-yellow-800 dark:text-yellow-300">
                {group.side === 'bank' ? 'Bank' : 'ERP'} · {group.rows.length} identical rows
              </span>
              <span className="font-mono text-xs text-yellow-700/80 dark:text-yellow-400/70 truncate max-w-[60%]">{group.label}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold w-10">#</th>
                    {keys.map(k => <th key={k} className="px-4 py-2 font-semibold">{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, ri) => (
                    <tr key={ri} className={`border-b border-slate-100 dark:border-slate-700/50 ${ri === 0 ? '' : 'bg-yellow-50/40 dark:bg-yellow-900/10'}`}>
                      <td className="px-4 py-2 text-slate-400">{ri === 0 ? '1 ✓' : ri + 1}</td>
                      {keys.map(k => (
                        <td key={k} className="px-4 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[220px]">
                          {String(row[k] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {groups.length > 50 && (
        <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Showing the first 50 duplicate groups of {groups.length}.
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------- group matches
const GroupMatchesBlock: React.FC<{ groups: GroupMatch[]; rules: MappingRule[] }> = ({ groups, rules }) => {
  if (groups.length === 0) return null;
  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        <Layers className="w-4 h-4" /> {groups.length} one-to-many match{groups.length === 1 ? '' : 'es'}
      </div>
      {groups.slice(0, 30).map((g, gi) => {
        const anchorKeys = uniqueCols(rules, g.anchorSide);
        const manyKeys = uniqueCols(rules, g.anchorSide === 'bank' ? 'erp' : 'bank');
        return (
          <div key={gi} className="rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-slate-800 overflow-hidden text-sm">
            <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 font-mono text-xs text-indigo-800 dark:text-indigo-300">
              {g.anchorSide.toUpperCase()} 1 &nbsp;↔&nbsp; {g.anchorSide === 'bank' ? 'ERP' : 'BANK'} {g.group.length}
            </div>
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300">
              {anchorKeys.map(k => <span key={k} className="mr-4"><span className="text-slate-400">{k}:</span> {String(g.anchor[k] ?? '')}</span>)}
            </div>
            {g.group.map((row, ri) => (
              <div key={ri} className="px-4 py-1.5 text-slate-600 dark:text-slate-400 pl-8">
                {manyKeys.map(k => <span key={k} className="mr-4"><span className="text-slate-400">{k}:</span> {String(row[k] ?? '')}</span>)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------- matched
const MatchedView: React.FC<{ results: ReconciliationResults; rules: MappingRule[] }> = ({ results, rules }) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const bankKeys = uniqueCols(rules, 'bank');
  const erpKeys = uniqueCols(rules, 'erp');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results.matched;
    return results.matched.filter(m =>
      bankKeys.some(k => String(m.bank[k] ?? '').toLowerCase().includes(q)) ||
      erpKeys.some(k => String(m.erp[k] ?? '').toLowerCase().includes(q))
    );
  }, [results.matched, bankKeys, erpKeys, query]);

  if (results.matched.length === 0 && results.groupMatched.length === 0) return <EmptyState />;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <GroupMatchesBlock groups={results.groupMatched} rules={rules} />
      {results.matched.length > 0 && (
        <SearchBox value={query} onChange={v => { setQuery(v); setPage(0); }} count={filtered.length} />
      )}
      {results.fuzzyCount > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5">
            <Sparkles className="w-3 h-3" /> fuzzy
          </span>
          matched by the tolerant pass — worth a review.
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th colSpan={bankKeys.length} className="px-6 py-3 text-center bg-blue-50/50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 font-bold uppercase tracking-wider">Bank Data</th>
              <th className="w-12 bg-slate-100 border-x border-slate-300 dark:bg-slate-800 dark:border-slate-600" />
              <th colSpan={erpKeys.length} className="px-6 py-3 text-center bg-purple-50/50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400 font-bold uppercase tracking-wider">ERP Data</th>
            </tr>
            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              {bankKeys.map(k => <th key={`b-${k}`} className="px-6 py-4 font-semibold">{k}</th>)}
              <th className="px-2 text-center text-slate-400 text-[10px] uppercase tracking-widest border-x border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50">Match</th>
              {erpKeys.map(k => <th key={`e-${k}`} className="px-6 py-4 font-semibold">{k}</th>)}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {slice.map((row, i) => {
                const fuzzy = row.kind === 'fuzzy';
                return (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    key={i}
                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {bankKeys.map(k => (
                      <td key={`b-${k}`} className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[200px]">
                        {fmtCell(row.bank[k])}
                      </td>
                    ))}
                    <td className="px-2 align-middle bg-slate-50/50 dark:bg-slate-900/50 border-x border-slate-200 dark:border-slate-700">
                      <div className="flex justify-center w-full">
                        <div
                          title={fuzzy ? 'Matched by the tolerant pass' : 'Exact match'}
                          className={`p-1.5 rounded-md border ${
                            fuzzy
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/50'
                          }`}
                        >
                          {fuzzy ? <Sparkles className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </div>
                      </div>
                    </td>
                    {erpKeys.map(k => (
                      <td key={`e-${k}`} className="px-6 py-4 text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[200px]">
                        {fmtCell(row.erp[k])}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        <Pager page={safePage} pages={pages} onPage={setPage} />
      </div>
    </>
  );
};

// ----------------------------------------------------------------- unmatched
const UnmatchedView: React.FC<{
  side: 'bank' | 'erp';
  rows: TransactionRow[];
  others: TransactionRow[];
  rules: MappingRule[];
}> = ({ side, rows, others, rules }) => {
  const [expanded, setExpanded] = useState<TransactionRow | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  let keys = uniqueCols(rules, side);
  if (keys.length === 0 && rows.length > 0) keys = Object.keys(rows[0]).slice(0, 5);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q
      ? rows.filter(r => keys.some(k => String(r[k] ?? '').toLowerCase().includes(q)))
      : rows.slice();
    if (sortKey) {
      out = out.slice().sort((a, b) => {
        const av = String(a[sortKey] ?? '');
        const bv = String(b[sortKey] ?? '');
        const na = Number(av.replace(/,/g, ''));
        const nb = Number(bv.replace(/,/g, ''));
        const cmp = !Number.isNaN(na) && !Number.isNaN(nb) ? na - nb : av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, keys, query, sortKey, sortDir]);

  if (rows.length === 0) return <EmptyState />;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
    setPage(0);
  };

  return (
    <div>
      <SearchBox value={query} onChange={v => { setQuery(v); setPage(0); }} count={filtered.length} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
            <tr>
              {keys.map(k => (
                <th key={k} className="px-6 py-4 font-semibold">
                  <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                    {k}
                    {sortKey === k && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-4 font-semibold w-24" />
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => {
              const isOpen = expanded === row;
              const near = isOpen ? nearestCandidate(row, side, others, rules) : null;
              return (
                <React.Fragment key={i}>
                  <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    {keys.map(k => (
                      <td key={k} className="px-6 py-4 text-slate-700 dark:text-slate-300">{fmtCell(row[k])}</td>
                    ))}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setExpanded(isOpen ? null : row)}
                        className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Search className="w-3.5 h-3.5 mr-1" /> {isOpen ? 'Hide' : 'Why?'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td colSpan={keys.length + 1} className="px-6 py-4">
                        {!near ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            No comparable row found on the other side — nothing shares even one rule value.
                          </p>
                        ) : (
                          <div className="text-sm">
                            <p className="mb-2 text-slate-600 dark:text-slate-300">
                              Closest {side === 'bank' ? 'ERP' : 'Bank'} row agrees on {near.score} of {rules.length} rules:
                            </p>
                            <ul className="space-y-1">
                              {near.outcomes.map((o, oi) => (
                                <li key={oi} className="flex items-center gap-2">
                                  {o.ok
                                    ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                                    : <X className="w-4 h-4 text-red-500 shrink-0" />}
                                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                                    {o.rule.bankColumn}/{o.rule.erpColumn}: “{o.bankValue || '∅'}” vs “{o.erpValue || '∅'}”
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        <Pager page={safePage} pages={pages} onPage={setPage} />
      </div>
    </div>
  );
};

export const ResultsTable: React.FC<ResultsTableProps> = ({ activeTab, results, rules, duplicateGroups = [] }) => {
  if (activeTab === 'duplicates') return <DuplicatesView groups={duplicateGroups} rules={rules} />;
  if (activeTab === 'matched') return <MatchedView results={results} rules={rules} />;
  if (activeTab === 'unmatchedBank') {
    return <UnmatchedView side="bank" rows={results.unmatchedBank} others={results.unmatchedERP} rules={rules} />;
  }
  return <UnmatchedView side="erp" rows={results.unmatchedERP} others={results.unmatchedBank} rules={rules} />;
};
