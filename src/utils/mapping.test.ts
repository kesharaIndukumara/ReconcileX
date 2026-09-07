import { describe, it, expect } from 'vitest'
import { guessComparisonMode, headerSimilarity, suggestMappings } from './mapping'

describe('headerSimilarity', () => {
  it('is 1 for the same header ignoring case/punctuation', () => {
    expect(headerSimilarity('Txn Date', 'txn_date')).toBe(1)
  })
  it('is high when one contains the other', () => {
    expect(headerSimilarity('Amount', 'Amount (USD)')).toBeGreaterThanOrEqual(0.8)
  })
  it('is 0 for unrelated headers', () => {
    expect(headerSimilarity('Reference', 'Balance')).toBe(0)
  })
})

describe('guessComparisonMode', () => {
  it('detects dates', () => {
    expect(guessComparisonMode('Posting Date', 'Eff Date')).toBe('date')
  })
  it('detects numbers', () => {
    expect(guessComparisonMode('Debit Amount', 'Credit')).toBe('numeric')
  })
  it('falls back to text', () => {
    expect(guessComparisonMode('Narration', 'Memo')).toBe('text')
  })
})

describe('suggestMappings', () => {
  it('pairs the closest headers one-to-one and guesses the mode', () => {
    const rules = suggestMappings(['Date', 'Amount', 'Ref No'], ['Txn Date', 'Amount', 'Reference'])
    const byBank = Object.fromEntries(rules.map(r => [r.bankColumn, r]))
    expect(byBank['Date'].erpColumn).toBe('Txn Date')
    expect(byBank['Date'].comparisonMode).toBe('date')
    expect(byBank['Amount'].erpColumn).toBe('Amount')
    expect(byBank['Amount'].comparisonMode).toBe('numeric')
  })

  it('returns nothing when headers are unrelated', () => {
    expect(suggestMappings(['Alpha'], ['Omega'])).toEqual([])
  })
})
