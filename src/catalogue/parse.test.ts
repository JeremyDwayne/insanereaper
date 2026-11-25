import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalogue, cleanAliases, parseLogs, parsePets, parseTasks, slug } from './parse.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const logs = parseLogs(fixture('boss-collection-log.html'))
const pets = parsePets(fixture('boss-pets.html'))
const tasks = parseTasks(fixture('combat-mastery.html'))

describe('parseLogs', () => {
  it('reads each log with its title, boss page, and items', () => {
    expect(logs.map((l) => [l.name, l.title, l.page])).toEqual([
      ["Kree'arra", 'Swiftness of the Aviansie', "Kree'arra"],
      ["K'ril Tsutsaroth", 'Brawn of a Tsutsaroth', "K'ril Tsutsaroth"],
      ['Nex', 'Tenacity of Zarytes', 'Nex'],
    ])
    const nex = logs[2]
    expect(nex.entries).toHaveLength(21)
    expect(nex.entries.at(-1)).toEqual({
      name: 'Nexterminator',
      wikiImage: expect.stringMatching(/^\/images\/Nexterminator\.png\?/),
      rarity: '10/2,000',
    })
  })
})

describe('parsePets', () => {
  it('includes pets and the items that unlock them', () => {
    expect([...pets]).toEqual(expect.arrayContaining(['TzRek-Jad', 'Tzhaar egg', 'Nexterminator']))
  })
})

describe('parseTasks', () => {
  it('reads the task table, not the tier summary', () => {
    expect(tasks).toHaveLength(3)
    expect(tasks[0]).toEqual({
      id: '3745',
      name: 'Nex Master Speed Killer',
      description: 'Defeat Nex solo in less than 01:21.',
      members: true,
      subcategory: 'Nex',
      tier: 'Master',
      points: 5,
    })
  })
})

describe('buildCatalogue', () => {
  const nexTasks = tasks.filter((t) => t.subcategory === 'Nex')
  const catalogue = buildCatalogue({ logs, pets, tasks: nexTasks, pageImages: new Map(), aliases: new Map() })

  it('keeps one item for a drop shared by several logs', () => {
    const shard = catalogue.items.filter((i) => i.name === 'Godsword shard 1')
    expect(shard).toHaveLength(1)
    const logsWithShard = catalogue.logs.filter((l) => l.entries.some((e) => e.itemId === shard[0].id))
    expect(logsWithShard.map((l) => l.id)).toEqual(['kreearra', 'kril-tsutsaroth'])
  })

  it('flags pets and maps tasks to their log', () => {
    expect(catalogue.items.find((i) => i.name === 'Nexterminator')?.pet).toBe(true)
    expect(catalogue.items.find((i) => i.name === 'Zaryte bow')?.pet).toBe(false)
    expect(catalogue.tasks[0].logId).toBe('nex')
  })

  it('fails on a subcategory with no log', () => {
    expect(() => buildCatalogue({ logs, pets, tasks, pageImages: new Map(), aliases: new Map() })).toThrow(
      'Subcategories with no boss log: Astellarn, Har-Aken',
    )
  })
})

describe('slug', () => {
  it('drops apostrophes and punctuation', () => {
    expect(slug("K'ril Tsutsaroth")).toBe('kril-tsutsaroth')
    expect(slug('Vindicta & Gorvek')).toBe('vindicta-gorvek')
  })
})

describe('cleanAliases', () => {
  it('drops repeats, case variants, and drop or guide pages', () => {
    expect(cleanAliases('Nex', ['NEX', 'Nex drops', 'Zaros boss', 'zaros boss', 'Nex guide', 'Nexx'])).toEqual([
      'Zaros boss',
      'Nexx',
    ])
  })
})
