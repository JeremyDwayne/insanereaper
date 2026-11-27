import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalogue, cleanAliases, gameOrder, parseLogs, parsePets, parseTasks, slug } from './parse.ts'

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
  it('reads the task table after the sequence column, not the tier summary', () => {
    expect(tasks).toHaveLength(3)
    expect(tasks[0]).toEqual({
      id: '3745',
      name: 'Nex Master Speed Killer',
      page: 'Nex Master Speed Killer',
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

  it('flags pets and maps tasks to their boss and log', () => {
    expect(catalogue.items.find((i) => i.name === 'Nexterminator')?.pet).toBe(true)
    expect(catalogue.items.find((i) => i.name === 'Zaryte bow')?.pet).toBe(false)
    expect(catalogue.tasks[0]).toMatchObject({ bossId: 'nex', logId: 'nex' })
  })

  it('gives a log its own boss, and splits a shared log into one boss per subcategory', () => {
    const temple = { name: 'Temple of Aminishi', title: '', page: 'Temple of Aminishi', entries: [] }
    const task = (id: string, subcategory: string) => ({ ...tasks[0], id, subcategory })
    const split = buildCatalogue({
      logs: [...logs, temple],
      pets,
      tasks: [task('1', 'Seiryu'), task('2', 'Masuta'), task('3', 'Nex')],
      pageImages: new Map([['Seiryu', '/images/Seiryu.png']]),
      aliases: new Map(),
    })
    expect(split.bosses.map((b) => [b.id, b.logId, b.wikiImage])).toEqual([
      ['kreearra', 'kreearra', ''],
      ['kril-tsutsaroth', 'kril-tsutsaroth', ''],
      ['masuta', 'temple-of-aminishi', ''],
      ['nex', 'nex', ''],
      ['seiryu', 'temple-of-aminishi', '/images/Seiryu.png'],
    ])
    expect(split.tasks.map((t) => t.bossId)).toEqual(['seiryu', 'masuta', 'nex'])
  })

  it('fails on a subcategory with no log', () => {
    expect(() => buildCatalogue({ logs, pets, tasks, pageImages: new Map(), aliases: new Map() })).toThrow(
      'Subcategories with no boss log: Astellarn, Har-Aken',
    )
  })
})

describe('gameOrder', () => {
  it('sorts like the in-game list: no "The" or apostrophes, groups last', () => {
    const names = [
      'Raid: Liberation of Mazcab',
      "K'ril Tsutsaroth",
      'The Magister',
      'Kezalam',
      'King Black Dragon',
      'Masuta',
    ]
    expect(
      names
        .map((name) => ({ name }))
        .sort(gameOrder)
        .map((b) => b.name),
    ).toEqual([
      'Kezalam',
      'King Black Dragon',
      "K'ril Tsutsaroth",
      'The Magister',
      'Masuta',
      'Raid: Liberation of Mazcab',
    ])
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
