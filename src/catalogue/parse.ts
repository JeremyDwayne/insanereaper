import { type HTMLElement, parse } from 'node-html-parser'
import { type Boss, Catalogue, type Item, type Log, type Task } from './schema.ts'
import { BOSS_PAGES, GROUP_PREFIXES, SUBCATEGORY_LOGS } from './subcategories.ts'

// Parsers for the RuneScape Wiki's rendered pages. Used by scripts/catalogue.ts and its tests only.

export type RawLog = {
  name: string
  title: string
  /** Wiki page of the boss, from the page's titles table. */
  page: string
  entries: { name: string; wikiImage: string; rarity: string }[]
}

/** A task row before validation; `tier` is checked when the catalogue is built. */
export type RawTask = Omit<Task, 'bossId' | 'logId' | 'tier'> & { tier: string }

/** Lower-case, accent-free, hyphenated id: "Kree'arra" becomes "kreearra". */
export function slug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function cellText(td: HTMLElement): string {
  for (const sup of td.querySelectorAll('sup')) sup.remove()
  return td.text.replace(/\s+/g, ' ').trim()
}

/** Boss collection log page: one table per log, plus the titles table that names each boss page. */
export function parseLogs(html: string): RawLog[] {
  const root = parse(html)
  // The titles table and each log section both link the title's wiki page, which joins them.
  const bossByTitlePage = new Map<string, string>()
  for (const link of root.querySelectorAll('td.plinkt-link')) {
    const titlePage = link.parentNode?.querySelector('.rs-title')?.parentNode?.getAttribute('title')
    const boss = link.querySelector('a')?.getAttribute('title')
    if (titlePage && boss && !bossByTitlePage.has(titlePage)) bossByTitlePage.set(titlePage, boss)
  }

  const logs: RawLog[] = []
  let heading = ''
  let titlePage = ''
  for (const el of root.querySelectorAll('h4, p, table')) {
    if (el.tagName === 'H4') heading = el.text.trim()
    if (el.tagName === 'P' && el.text.includes('Unlocks the title'))
      titlePage = el.querySelector('a')?.getAttribute('title') ?? ''
    const tableId = el.getAttribute('data-tableid') ?? ''
    if (el.tagName !== 'TABLE' || !tableId.startsWith('Collection log - ')) continue
    const title = tableId.slice('Collection log - '.length)
    const page = bossByTitlePage.get(titlePage)
    if (!page) throw new Error(`No boss page in the titles table for log "${heading}" (${titlePage})`)
    const entries = el.querySelectorAll('tr[data-rowid]').map((tr) => {
      const tds = tr.querySelectorAll('td')
      return {
        name: tr.getAttribute('data-rowid') ?? '',
        wikiImage: tr.querySelector('img')?.getAttribute('src') ?? '',
        rarity: cellText(tds[tds.length - 1]),
      }
    })
    logs.push({ name: heading, title, page, entries })
  }
  return logs
}

/** Boss pets page: every pet and every item that unlocks one. */
export function parsePets(html: string): Set<string> {
  const names = parse(html)
    .querySelectorAll('tr[data-rowid] td.plinkt-link')
    .map((td) => td.text.trim())
  return new Set(names)
}

/** The rendered Combat Mastery achievements list, in game order: the task list is the largest wikitable. */
export function parseTasks(html: string): RawTask[] {
  const tables = parse(html).querySelectorAll('table.wikitable')
  const table = tables.reduce((a, b) => (b.querySelectorAll('tr').length > a.querySelectorAll('tr').length ? b : a))
  return table.querySelectorAll('tr[data-rowid]').map((tr) => {
    // The first cell is the game's sequence number, which the row order already carries.
    const td = tr.querySelectorAll('td').slice(1)
    return {
      id: tr.getAttribute('data-rowid') ?? '',
      name: cellText(td[0]),
      description: cellText(td[1]),
      members: (td[2].querySelector('img')?.getAttribute('src') ?? '').includes('P2P'),
      subcategory: cellText(td[3]),
      tier: cellText(td[4]),
      points: Number(cellText(td[5])),
    }
  })
}

export type CatalogueInput = {
  logs: RawLog[]
  pets: Set<string>
  tasks: RawTask[]
  /** Wiki image path for each boss page. */
  pageImages: Map<string, string>
  /** Wiki redirect names, keyed by boss page or item name. */
  aliases: Map<string, string[]>
}

/** Joins the parsed pages into a validated catalogue. Throws on a subcategory with no log. */
export function buildCatalogue(input: CatalogueInput): Catalogue {
  const items = new Map<string, Item>()
  const logs: Log[] = input.logs.map((raw) => ({
    id: slug(raw.name),
    name: raw.name,
    title: raw.title,
    page: raw.page,
    wikiImage: input.pageImages.get(raw.page) ?? '',
    image: '',
    aliases: input.aliases.get(raw.page) ?? [],
    entries: raw.entries.map((entry) => {
      const id = slug(entry.name)
      if (!items.has(id)) {
        items.set(id, {
          id,
          name: entry.name,
          pet: input.pets.has(entry.name),
          wikiImage: entry.wikiImage,
          image: '',
          aliases: input.aliases.get(entry.name) ?? [],
        })
      }
      return { itemId: id, rarity: entry.rarity }
    }),
  }))

  const logsById = new Map(logs.map((log) => [log.id, log]))
  const unmapped = new Set<string>()
  const subcategoryLogs = new Map<string, string>()
  for (const task of input.tasks) {
    const logId = SUBCATEGORY_LOGS[task.subcategory] ?? slug(task.subcategory)
    if (logsById.has(logId)) subcategoryLogs.set(task.subcategory, logId)
    else unmapped.add(task.subcategory)
  }
  if (unmapped.size) throw new Error(`Subcategories with no boss log: ${[...unmapped].join(', ')}`)

  const shared = new Set([...subcategoryLogs.values()].filter((id, i, all) => all.indexOf(id) !== i))
  const bossOf = new Map<string, Boss>()
  for (const [subcategory, logId] of subcategoryLogs) {
    const log = logsById.get(logId)
    if (!log) continue
    const own = shared.has(logId) && !GROUP_PREFIXES.some((p) => subcategory.startsWith(p))
    const page = own ? (BOSS_PAGES[subcategory] ?? subcategory) : log.page
    bossOf.set(subcategory, {
      id: shared.has(logId) ? slug(subcategory) : logId,
      name: subcategory,
      logId,
      page,
      wikiImage: own ? (input.pageImages.get(page) ?? '') : log.wikiImage,
      image: '',
    })
  }
  const withTasks = new Set(subcategoryLogs.values())
  const bosses = [
    ...bossOf.values(),
    ...logs
      .filter((log) => !withTasks.has(log.id))
      .map((log) => ({
        id: log.id,
        name: log.name,
        logId: log.id,
        page: log.page,
        wikiImage: log.wikiImage,
        image: '',
      })),
  ].sort(gameOrder)
  const tasks = input.tasks.map((task) => {
    const boss = bossOf.get(task.subcategory)
    return { ...task, bossId: boss?.id ?? '', logId: boss?.logId ?? '' }
  })

  return Catalogue.assert({ logs, bosses, items: [...items.values()], tasks })
}

/**
 * The game's combat achievement list order: boss names alphabetically, ignoring a leading "The" and
 * apostrophes, then the dungeon and raid groups in GROUP_PREFIXES order.
 */
export function gameOrder(a: { name: string }, b: { name: string }): number {
  const rank = (name: string) => GROUP_PREFIXES.findIndex((p) => name.startsWith(p))
  const key = (name: string) => name.replace(/^The /, '').replace(/['’]/g, '')
  return rank(a.name) - rank(b.name) || key(a.name).localeCompare(key(b.name), 'en')
}

/** Wiki redirect titles worth searching by: no "drops" or guide pages, no repeats of the name. */
export function cleanAliases(name: string, redirects: string[]): string[] {
  const seen = new Set([name.toLowerCase()])
  return redirects.filter((alias) => {
    const key = alias.toLowerCase()
    if (seen.has(key) || /drop|guide|strateg/i.test(alias)) return false
    seen.add(key)
    return true
  })
}
