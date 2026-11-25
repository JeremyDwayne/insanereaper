import { describe, expect, it } from 'vitest'
import catalogueJson from '#/catalogue/catalogue.json'
import { Catalogue } from '#/catalogue/schema.ts'
import { createSearch } from './search.ts'

const search = createSearch(Catalogue.assert(catalogueJson))

describe('search', () => {
  it('finds bosses by nickname', () => {
    expect(search('aod').logs[0]).toMatchObject({ id: 'nex-angel-of-death', alias: 'AoD' })
    expect(search('corp').logs[0]).toMatchObject({ id: 'corporeal-beast' })
  })

  it('finds drops by nickname', () => {
    expect(search('zbow').items[0]).toMatchObject({ name: 'Zaryte bow' })
  })

  it('tolerates a typo', () => {
    expect(search('kreeara').logs[0]).toMatchObject({ id: 'kreearra' })
    expect(search('graador').logs[0]).toMatchObject({ id: 'general-graardor' })
  })

  it('returns each kind once and nothing for an empty query', () => {
    const torva = search('torva')
    expect(torva.items.map((i) => i.name)).toContain('Torva platebody')
    expect(new Set(torva.items.map((i) => i.id)).size).toBe(torva.items.length)
    expect(search('  ')).toEqual({ logs: [], items: [], tasks: [] })
  })
})
