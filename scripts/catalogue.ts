// Rebuilds src/catalogue/catalogue.json from the RuneScape Wiki. Run with `pnpm catalogue`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { buildCatalogue, cleanAliases, parseLogs, parsePets, parseTasks } from '../src/catalogue/parse.ts'
import { Catalogue, TIERS } from '../src/catalogue/schema.ts'
import { LOG_PAGES } from '../src/catalogue/subcategories.ts'

const API = 'https://runescape.wiki/api.php'
const USER_AGENT = 'insanereaper.com catalogue build (https://github.com/JeremyDwayne/insanereaper)'
const OUT = new URL('../src/catalogue/catalogue.json', import.meta.url)

type QueryPage = { title: string; thumbnail?: { source: string }; redirects?: { title: string }[] }
type QueryResponse = {
  continue?: Record<string, string>
  query?: {
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
    pages?: QueryPage[]
  }
}

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json() as Promise<T>
}

async function pageHtml(page: string): Promise<string> {
  const data = await api<{ parse: { text: string } }>({ action: 'parse', page, prop: 'text' })
  return data.parse.text
}

/**
 * Runs a query over titles in batches of 50, following redirects and continuations.
 * Returns each requested title's resolved page, with redirects merged across continuations.
 */
async function queryTitles(titles: string[], params: Record<string, string>): Promise<Map<string, QueryPage>> {
  const byTitle = new Map<string, QueryPage>()
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const pages = new Map<string, QueryPage>()
    const resolve = new Map(batch.map((t) => [t, t]))
    let cont: Record<string, string> = {}
    do {
      const data = await api<QueryResponse>({
        action: 'query',
        redirects: '1',
        titles: batch.join('|'),
        ...params,
        ...cont,
      })
      for (const { from, to } of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])]) {
        for (const [t, r] of resolve) if (r === from) resolve.set(t, to)
      }
      for (const page of data.query?.pages ?? []) {
        const prev = pages.get(page.title)
        pages.set(page.title, {
          ...prev,
          ...page,
          redirects: [...(prev?.redirects ?? []), ...(page.redirects ?? [])],
        })
      }
      cont = data.continue ?? {}
    } while (Object.keys(cont).length)
    for (const [t, r] of resolve) {
      const page = pages.get(r)
      if (page) byTitle.set(t, page)
    }
  }
  return byTitle
}

const [logsHtml, petsHtml, tasksHtml] = await Promise.all(
  ['Boss collection log', 'Boss pets', 'Combat Mastery achievements'].map(pageHtml),
)
const logs = parseLogs(logsHtml)
const pets = parsePets(petsHtml)
const tasks = parseTasks(tasksHtml)

const bossPages = logs.map((log) => LOG_PAGES[log.page] ?? log.page)
const itemNames = [...new Set(logs.flatMap((log) => log.entries.map((e) => e.name)))]
const bossInfo = await queryTitles(bossPages, {
  prop: 'pageimages|redirects',
  piprop: 'thumbnail',
  pithumbsize: '392',
  rdnamespace: '0',
  rdlimit: 'max',
})
const itemInfo = await queryTitles(itemNames, { prop: 'redirects', rdnamespace: '0', rdlimit: 'max' })

const pageImages = new Map<string, string>()
const aliases = new Map<string, string[]>()
for (const log of logs) {
  const info = bossInfo.get(LOG_PAGES[log.page] ?? log.page)
  const source = info?.thumbnail?.source
  if (source) pageImages.set(log.page, new URL(source).pathname + new URL(source).search)
  aliases.set(
    log.page,
    cleanAliases(
      log.name,
      (info?.redirects ?? []).map((r) => r.title),
    ),
  )
}
for (const name of itemNames) {
  aliases.set(
    name,
    cleanAliases(
      name,
      (itemInfo.get(name)?.redirects ?? []).map((r) => r.title),
    ),
  )
}

const catalogue = buildCatalogue({ logs, pets, tasks, pageImages, aliases })

const noImage = catalogue.logs.filter((log) => !log.wikiImage).map((log) => log.name)
if (noImage.length) throw new Error(`Logs with no boss image, add them to LOG_PAGES: ${noImage.join(', ')}`)
const petIds = new Set(catalogue.items.filter((item) => item.pet).map((item) => item.id))
const noPet = catalogue.logs.filter((log) => !log.entries.some((e) => petIds.has(e.itemId))).map((log) => log.name)

if (existsSync(OUT)) {
  const previous = Catalogue.assert(JSON.parse(readFileSync(OUT, 'utf8')))
  const ids = (c: Catalogue) => new Set([...c.logs, ...c.items, ...c.tasks].map((x) => x.id))
  const next = ids(catalogue)
  const removed = [...ids(previous)].filter((id) => !next.has(id))
  if (removed.length) console.warn(`Removed ids, check for progress before deploying: ${removed.join(', ')}`)
}

writeFileSync(OUT, `${JSON.stringify(catalogue, null, 1)}\n`)

const points = catalogue.tasks.reduce((sum, t) => sum + t.points, 0)
const perTier = TIERS.map((tier) => `${tier} ${catalogue.tasks.filter((t) => t.tier === tier).length}`).join(', ')
const rows = catalogue.logs.reduce((sum, log) => sum + log.entries.length, 0)
console.log(`${catalogue.logs.length} logs, ${rows} rows, ${catalogue.items.length} unique items`)
console.log(`${catalogue.tasks.length} tasks, ${points} points: ${perTier}`)
if (noPet.length) console.log(`Logs with no pet found: ${noPet.join(', ')}`)
