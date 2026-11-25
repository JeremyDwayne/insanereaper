// Rebuilds src/catalogue/catalogue.json from the RuneScape Wiki and copies new images to R2.
// Run with `pnpm catalogue` after `wrangler login`.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { type } from 'arktype'
import { buildCatalogue, cleanAliases, parseLogs, parsePets, parseTasks } from '../src/catalogue/parse.ts'
import { type Catalogue, TIERS } from '../src/catalogue/schema.ts'
import { BOSS_PAGES, GROUP_PREFIXES, LOG_PAGES, SUBCATEGORY_LOGS } from '../src/catalogue/subcategories.ts'

const WIKI = 'https://runescape.wiki'
const API = `${WIKI}/api.php`
const BUCKET = 'insanereaper-images'
const run = promisify(execFile)
const WRANGLER = new URL('../node_modules/.bin/wrangler', import.meta.url).pathname
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

/** Renders wikitext, such as a list template with options the wiki's own page does not use. */
async function renderHtml(text: string): Promise<string> {
  const data = await api<{ parse: { text: string } }>({ action: 'parse', text, contentmodel: 'wikitext', prop: 'text' })
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

const [logsHtml, petsHtml, tasksHtml] = await Promise.all([
  pageHtml('Boss collection log'),
  pageHtml('Boss pets'),
  renderHtml('{{Achievements list|Combat Mastery|category_column=no|mastery_tier_column=yes|sequence_number=yes}}'),
])
const logs = parseLogs(logsHtml)
const pets = parsePets(petsHtml)
const tasks = parseTasks(tasksHtml)

// Subcategories that split a shared log get their own boss page and image.
const splitPages = [...new Set(tasks.map((t) => t.subcategory))]
  .filter((sub) => SUBCATEGORY_LOGS[sub] && !GROUP_PREFIXES.some((p) => sub.startsWith(p)))
  .map((sub) => BOSS_PAGES[sub] ?? sub)
const bossPages = [...logs.map((log) => LOG_PAGES[log.page] ?? log.page), ...splitPages]
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
for (const page of splitPages) {
  const source = bossInfo.get(page)?.thumbnail?.source
  if (source) pageImages.set(page, new URL(source).pathname + new URL(source).search)
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

const noImage = [...catalogue.logs, ...catalogue.bosses].filter((x) => !x.wikiImage).map((x) => x.name)
if (noImage.length) throw new Error(`No boss image, add a page to LOG_PAGES or BOSS_PAGES: ${noImage.join(', ')}`)
const petIds = new Set(catalogue.items.filter((item) => item.pet).map((item) => item.id))
const noPet = catalogue.logs.filter((log) => !log.entries.some((e) => petIds.has(e.itemId))).map((log) => log.name)

/** The parts of the previous catalogue this build reads: ids and image keys. Older builds have no bosses. */
const Pictured = type({ id: 'string', wikiImage: 'string', image: 'string' })
const Previous = type({
  logs: Pictured.array(),
  'bosses?': Pictured.array(),
  items: Pictured.array(),
  tasks: type({ id: 'string' }).array(),
})
type Previous = typeof Previous.infer

/**
 * Gives every log, boss and item an R2 image key named by content hash, so the image can be cached forever.
 * Reuses the previous key when the wiki image URL, which carries the wiki's own file hash, is unchanged.
 */
async function syncImages(next: Catalogue, previous: Previous | null) {
  const known = new Map(
    [...(previous?.logs ?? []), ...(previous?.bosses ?? []), ...(previous?.items ?? [])].map((x) => [
      x.wikiImage,
      x.image,
    ]),
  )
  const entries = [...next.logs, ...next.bosses, ...next.items]
  const todo = [...new Set(entries.map((x) => x.wikiImage).filter((src) => !known.get(src)))]
  const dir = mkdtempSync(join(tmpdir(), 'insanereaper-'))
  let uploaded = 0
  const upload = async (src: string) => {
    const res = await fetch(WIKI + src, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`${res.status} ${src}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    const type = res.headers.get('content-type') ?? 'image/png'
    const key = `${createHash('sha256').update(bytes).digest('hex').slice(0, 20)}.${type.split('/')[1] ?? 'png'}`
    const file = join(dir, key)
    writeFileSync(file, bytes)
    await run(WRANGLER, [
      'r2',
      'object',
      'put',
      `${BUCKET}/${key}`,
      '--remote',
      '--file',
      file,
      '--content-type',
      type,
      '--cache-control',
      'public, max-age=31536000, immutable',
    ])
    known.set(src, key)
    uploaded++
  }
  for (let i = 0; i < todo.length; i += 8) await Promise.all(todo.slice(i, i + 8).map(upload))
  for (const x of entries) x.image = known.get(x.wikiImage) ?? ''
  console.log(`${uploaded} new images uploaded to R2`)
}

const previous = existsSync(OUT) ? Previous.assert(JSON.parse(readFileSync(OUT, 'utf8'))) : null
await syncImages(catalogue, previous)

if (previous) {
  const ids = (c: Previous) => new Set([...c.logs, ...(c.bosses ?? []), ...c.items, ...c.tasks].map((x) => x.id))
  const next = ids(catalogue)
  const removed = [...ids(previous)].filter((id) => !next.has(id))
  if (removed.length) console.warn(`Removed ids, check for progress before deploying: ${removed.join(', ')}`)
}

writeFileSync(OUT, `${JSON.stringify(catalogue, null, 1)}\n`)

const points = catalogue.tasks.reduce((sum, t) => sum + t.points, 0)
const perTier = TIERS.map((tier) => `${tier} ${catalogue.tasks.filter((t) => t.tier === tier).length}`).join(', ')
const rows = catalogue.logs.reduce((sum, log) => sum + log.entries.length, 0)
console.log(
  `${catalogue.logs.length} logs, ${catalogue.bosses.length} bosses, ${rows} rows, ${catalogue.items.length} unique items`,
)
console.log(`${catalogue.tasks.length} tasks, ${points} points: ${perTier}`)
if (noPet.length) console.log(`Logs with no pet found: ${noPet.join(', ')}`)
