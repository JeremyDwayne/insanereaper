import { type } from 'arktype'
import { describe, expect, it } from 'vitest'
import { CharacterName, nameKey, nameSlug } from './name.ts'

describe('CharacterName', () => {
  it('accepts RuneScape names and trims them', () => {
    expect(CharacterName('  Iron_Man-2 ')).toBe('Iron_Man-2')
    expect(CharacterName('JeremyDwayne')).toBe('JeremyDwayne')
  })

  it('rejects empty, long, or punctuated names', () => {
    for (const bad of ['', 'ThirteenChars', "Kree'arra", 'a.b']) {
      expect(CharacterName(bad)).toBeInstanceOf(type.errors)
    }
  })
})

describe('nameKey', () => {
  it('treats case, spaces, hyphens and underscores as the same', () => {
    expect(new Set(['Iron Man', 'iron_man', 'IRON-MAN', 'Iron  Man'].map(nameKey))).toEqual(new Set(['iron man']))
    expect(nameSlug('Iron Man')).toBe('iron_man')
  })
})
