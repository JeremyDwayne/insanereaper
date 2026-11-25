import uFuzzy from '@leeoniya/ufuzzy'
import type { Catalogue } from '#/catalogue/schema.ts'

export type SearchHit = {
  kind: 'log' | 'item' | 'task'
  id: string
  name: string
  /** The nickname that matched, when it was not the name itself. */
  alias?: string
}

export type SearchResults = { logs: SearchHit[]; items: SearchHit[]; tasks: SearchHit[] }

/**
 * Builds a fuzzy search over boss logs, drops and achievements, including wiki nicknames.
 * Returns a function from query to the best hits of each kind.
 */
export function createSearch(catalogue: Catalogue) {
  const entries: SearchHit[] = []
  for (const log of catalogue.logs) {
    entries.push({ kind: 'log', id: log.id, name: log.name })
    for (const alias of log.aliases) entries.push({ kind: 'log', id: log.id, name: log.name, alias })
  }
  for (const item of catalogue.items) {
    entries.push({ kind: 'item', id: item.id, name: item.name })
    for (const alias of item.aliases) entries.push({ kind: 'item', id: item.id, name: item.name, alias })
  }
  for (const task of catalogue.tasks) entries.push({ kind: 'task', id: task.id, name: task.name })

  const haystack = entries.map((e) => e.alias ?? e.name)
  // Single-error mode tolerates one typo per word, such as "kreeara" for "Kree'arra".
  const uf = new uFuzzy({ intraMode: 1, intraIns: 1 })

  return (query: string, limit = 6): SearchResults => {
    const results: SearchResults = { logs: [], items: [], tasks: [] }
    const needle = query.trim()
    if (!needle) return results
    const [idxs, info, order] = uf.search(haystack, needle, 1)
    const ranked = info && order ? order.map((i) => info.idx[i]) : (idxs ?? [])
    const seen = new Set<string>()
    for (const i of ranked) {
      const hit = entries[i]
      const key = `${hit.kind}:${hit.id}`
      const group = results[`${hit.kind}s`]
      if (seen.has(key) || group.length >= limit) continue
      seen.add(key)
      group.push(hit)
    }
    return results
  }
}
