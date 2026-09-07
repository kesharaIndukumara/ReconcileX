import { describe, it, expect } from 'vitest'
import { MappingRule, TransactionRow } from '../types'
import { describeRow, evaluateMatch, getRowSignature, normalizeNumeric } from './reconcile'

const numericRule = (bankColumn: string, erpColumn: string): MappingRule => ({
  id: `${bankColumn}-${erpColumn}`,
  bankColumn,
  erpColumn,
  comparisonMode: 'numeric',
})

const textRule = (bankColumn: string, erpColumn: string): MappingRule => ({
  id: `${bankColumn}-${erpColumn}`,
  bankColumn,
  erpColumn,
  comparisonMode: 'text',
})

describe('normalizeNumeric', () => {
  it('strips thousands separators and rounds to the cent', () => {
    expect(normalizeNumeric('1,099.98')).toBe(1099.98)
    expect(normalizeNumeric(' 2,500 ')).toBe(2500)
  })

  it('treats an empty or non-numeric cell as null', () => {
    expect(normalizeNumeric('')).toBeNull()
    expect(normalizeNumeric('   ')).toBeNull()
    expect(normalizeNumeric('n/a')).toBeNull()
  })

  it('collapses floating-point noise', () => {
    expect(normalizeNumeric('1099.9800000001')).toBe(1099.98)
  })

  it('keeps a real zero as 0, not null', () => {
    expect(normalizeNumeric('0')).toBe(0)
  })
})

describe('evaluateMatch', () => {
  const rules = [textRule('Ref', 'Reference'), numericRule('Amount', 'Credit')]

  it('matches rows that agree on every rule (case-insensitive text, formatted numbers)', () => {
    const bank: TransactionRow = { Ref: 'INV-100', Amount: '1,250.00' }
    const erp: TransactionRow = { Reference: 'inv-100', Credit: '1250' }
    expect(evaluateMatch(bank, erp, rules)).toBe(true)
  })

  it('rejects rows that disagree on a rule', () => {
    const bank: TransactionRow = { Ref: 'INV-100', Amount: '1250' }
    const erp: TransactionRow = { Reference: 'INV-100', Credit: '1251' }
    expect(evaluateMatch(bank, erp, rules)).toBe(false)
  })

  it('matches a genuine zero amount on both sides (regression: || vs ??)', () => {
    const bank: TransactionRow = { Ref: 'ADJ', Amount: 0 }
    const erp: TransactionRow = { Reference: 'ADJ', Credit: '0' }
    expect(evaluateMatch(bank, erp, rules)).toBe(true)
  })

  it('treats sub-cent differences as equal', () => {
    const bank: TransactionRow = { Ref: 'X', Amount: '100.001' }
    const erp: TransactionRow = { Reference: 'X', Credit: '100.004' }
    expect(evaluateMatch(bank, erp, rules)).toBe(true)
  })
})

describe('getRowSignature', () => {
  const rules = [numericRule('Amount', 'Credit')]

  it('produces the same signature for the same amount in different formats', () => {
    const bankSig = getRowSignature({ Amount: '1,250.00' }, rules, 'bank')
    const erpSig = getRowSignature({ Credit: '1250' }, rules, 'erp')
    expect(bankSig).toBe(erpSig)
  })

  it('does not collide across field boundaries', () => {
    const twoRules = [textRule('A', 'A'), textRule('B', 'B')]
    const left = getRowSignature({ A: 'x|y', B: 'z' }, twoRules, 'bank')
    const right = getRowSignature({ A: 'x', B: 'y|z' }, twoRules, 'bank')
    expect(left).not.toBe(right)
  })

  it('gives a distinct signature to invalid numeric cells per side', () => {
    const bankSig = getRowSignature({ Amount: 'oops' }, rules, 'bank')
    const erpSig = getRowSignature({ Credit: 'oops' }, rules, 'erp')
    expect(bankSig).not.toBe(erpSig)
  })

  it('keeps a real zero distinct from an empty cell', () => {
    const zeroSig = getRowSignature({ Amount: 0 }, rules, 'bank')
    const emptySig = getRowSignature({ Amount: '' }, rules, 'bank')
    expect(zeroSig).not.toBe(emptySig)
  })
})

describe('describeRow', () => {
  const rules = [textRule('Ref', 'Reference'), numericRule('Amount', 'Credit')]

  it('renders the mapped values for the given side', () => {
    const bank: TransactionRow = { Ref: 'INV-1', Amount: '1250' }
    expect(describeRow(bank, rules, 'bank')).toBe('Ref=INV-1 · Amount=1250')
  })

  it('marks empty mapped cells', () => {
    expect(describeRow({ Reference: 'X' }, rules, 'erp')).toBe('Reference=X · Credit=∅')
  })
})
