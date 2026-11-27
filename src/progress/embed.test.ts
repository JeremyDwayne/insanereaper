import { describe, expect, it } from 'vitest'
import type { Catalogue, Tier } from '#/catalogue/schema.ts'
import { bossEmbed, linkPreview } from './embed.ts'
import type { Progress } from './summary.ts'

const item = (id: string) => ({ id, name: `Item ${id}`, pet: false, wikiImage: '', image: '', aliases: [] })
const task = (id: string, tier: Tier, points: number) => ({
  id,
  name: id,
  description: '',
  subcategory: 'Vorago',
  bossId: 'vorago',
  logId: 'vorago',
  tier,
  points,
  members: true,
})
const drops = ['a', 'b', 'c']
const catalogue: Catalogue = {
  items: drops.map(item),
  logs: [
    {
      id: 'vorago',
      name: 'Vorago',
      title: '',
      page: 'Vorago',
      wikiImage: '',
      image: '',
      aliases: [],
      entries: drops.map((itemId) => ({ itemId, rarity: '1/1' })),
    },
  ],
  bosses: [{ id: 'vorago', name: 'Vorago', logId: 'vorago', page: 'Vorago', wikiImage: '', image: '' }],
  tasks: [task('t1', 'Master', 5), task('t2', 'Elite', 4), task('t3', 'Elite', 4)],
}
const progress = (items: Record<string, number>, tasks: string[]): Progress => ({ items, tasks: new Set(tasks) })
const jeremy = { name: 'Jeremydwayne', slug: 'jeremydwayne' }

describe('bossEmbed', () => {
  it('groups achievements left by tier in game order and lists missing drops', () => {
    const b = bossEmbed(catalogue, progress({ b: 1 }, ['t2']), 'vorago')
    expect(b?.tiers.map((t) => [t.tier, t.tasks.map((x) => x.id)])).toEqual([
      ['Elite', ['t3']],
      ['Master', ['t1']],
    ])
    expect(b?.missing.map((i) => i.id)).toEqual(['a', 'c'])
  })
})

describe('linkPreview', () => {
  it('sums up a boss and points at its image', () => {
    const p = linkPreview(catalogue, progress({ b: 1 }, ['t2']), jeremy, 'vorago')
    expect(p.title).toBe('Jeremydwayne at Vorago')
    expect(p.description).toBe('2 of 3 achievements left, 9 points. 2 of 3 drops missing: Item a, Item c.')
    expect(p.image).toMatch(/^\/og\/jeremydwayne\/vorago\?v=\w+$/)
  })

  it('says when a boss is finished', () => {
    const p = linkPreview(catalogue, progress({ a: 1, b: 1, c: 2 }, ['t1', 't2', 't3']), jeremy, 'vorago')
    expect(p.description).toBe('All 3 achievements done. All 3 drops obtained.')
  })

  it('cuts long drop lists to fit', () => {
    const many = Array.from({ length: 40 }, (_, i) => `long-drop-name-${i}`)
    const big = {
      ...catalogue,
      items: many.map(item),
      logs: [{ ...catalogue.logs[0], entries: many.map((itemId) => ({ itemId, rarity: '1/1' })) }],
    }
    const p = linkPreview(big, progress({}, []), jeremy, 'vorago')
    expect(p.description.length).toBeLessThanOrEqual(300)
    expect(p.description).toMatch(/ and \d+ more\.$/)
  })

  it('changes the image version when progress changes', () => {
    const before = linkPreview(catalogue, progress({}, []), jeremy, 'vorago').image
    const after = linkPreview(catalogue, progress({}, ['t1']), jeremy, 'vorago').image
    expect(after).not.toBe(before)
  })

  it('falls back to the whole profile for an unknown boss', () => {
    const p = linkPreview(catalogue, progress({ a: 1 }, ['t1']), jeremy, 'nope')
    expect(p).toEqual({
      title: 'Jeremydwayne, Insane Reaper',
      description: '2 drops to the Reaper. 1 of 3 drops, CombatScore 5 of 13.',
    })
  })
})
