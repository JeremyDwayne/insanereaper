import { describe, expect, it } from 'vitest'
import { catalogue } from '#/catalogue/index.ts'
import { chanceByNow, killKinds } from './kills.ts'

describe('killKinds', () => {
  it('adds hard mode and enrage fields from achievement wording', () => {
    const kinds = killKinds(catalogue)
    expect(kinds.get('nex-angel-of-death')).toEqual(['normal'])
    expect(kinds.get('kreearra')).toEqual(['normal', 'hard'])
    expect(kinds.get('telos')).toEqual(['normal', 'enrage'])
  })
})

describe('chanceByNow', () => {
  it('reads wiki rarities and returns null for ones without a rate', () => {
    expect(chanceByNow('1/85', 40)).toBeCloseTo(0.377, 3)
    expect(chanceByNow('10/2,500', 40)).toBeCloseTo(0.148, 3)
    expect(chanceByNow('2 × 1/2', 1)).toBeCloseTo(0.75, 3)
    expect(chanceByNow('Always', 40)).toBeNull()
  })
})
