import { describe, it, expect } from 'vitest'
import { MappingRule, TransactionRow } from '../types'
import { runReconciliation } from './engine'

const rule = (over: Partial<MappingRule>): MappingRule => ({
  id: Math.random().toString(36),
  bankColumn: 'Amount',
  erpColumn: 'Amount',
  comparisonMode: 'numeric',
  ...over,
})

describe('runReconciliation — exact pass', () => {
  it('pairs rows 1-to-1 and reports both-sided rates', () => {
    const bank: TransactionRow[] = [{ Amount: '100' }, { Amount: '200' }, { Amount: '300' }]
    const erp: TransactionRow[] = [{ Amount: '200' }, { Amount: '100' }]
    const out = runReconciliation({ bankData: bank, erpData: erp, rules: [rule({})], duplicateStrategy: 'first-wins' })
    expect(out.matched).toHaveLength(2)
    expect(out.unmatchedBank).toHaveLength(1)
    expect(out.unmatchedERP).toHaveLength(0)
    expect(out.bankMatchRate).toBe(67)
    expect(out.erpMatchRate).toBe(100)
    expect(out.progress).toBe(80) // 2*2 / (3+2)
  })

  it('all-unmatched strategy holds every copy of a duplicate signature out of matching', () => {
    const bank: TransactionRow[] = [{ Amount: '50' }, { Amount: '50' }]
    const erp: TransactionRow[] = [{ Amount: '50' }]
    const out = runReconciliation({ bankData: bank, erpData: erp, rules: [rule({})], duplicateStrategy: 'all-unmatched' })
    expect(out.matched).toHaveLength(0)
    expect(out.unmatchedBank).toHaveLength(2)
    expect(out.duplicateSummary.bank.groups).toBe(1)
  })
})

describe('runReconciliation — fuzzy pass', () => {
  it('is skipped entirely when no rule has tolerance', () => {
    const bank: TransactionRow[] = [{ Amount: '100.02' }]
    const erp: TransactionRow[] = [{ Amount: '100.00' }]
    const out = runReconciliation({ bankData: bank, erpData: erp, rules: [rule({})], duplicateStrategy: 'first-wins' })
    expect(out.fuzzyCount).toBe(0)
    expect(out.matched).toHaveLength(0)
  })

  it('pairs near-misses when a rule allows an amount tolerance', () => {
    const bank: TransactionRow[] = [{ Amount: '100.02' }, { Amount: '999' }]
    const erp: TransactionRow[] = [{ Amount: '100.00' }]
    const rules = [rule({ tolerance: { kind: 'amount', value: 0.05 } })]
    const out = runReconciliation({ bankData: bank, erpData: erp, rules, duplicateStrategy: 'first-wins' })
    expect(out.fuzzyCount).toBe(1)
    expect(out.matched[0].kind).toBe('fuzzy')
    expect(out.unmatchedBank).toHaveLength(1)
  })

  it('honours a date ± days tolerance', () => {
    const rules: MappingRule[] = [
      rule({ bankColumn: 'D', erpColumn: 'D', comparisonMode: 'date', tolerance: { kind: 'days', value: 2 } }),
    ]
    const out = runReconciliation({
      bankData: [{ D: '2026-01-01' }],
      erpData: [{ D: '2026-01-03' }],
      rules,
      duplicateStrategy: 'first-wins',
    })
    expect(out.fuzzyCount).toBe(1)
  })
})
