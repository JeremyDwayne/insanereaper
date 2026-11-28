import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { imageUrl } from '#/catalogue/images.ts'
import { bossesById, catalogue, itemsById, tasksById } from '#/catalogue/index.ts'
import type { BossSummary, Progress } from '#/progress/summary.ts'
import { createSearch, type SearchHit } from '#/search/search.ts'
import { SearchIcon } from './icons.tsx'
import { Mark } from './Mark.tsx'

const search = createSearch(catalogue)

/** The first boss whose log lists each item; shared items open there. */
const itemBoss = new Map<string, string>()
for (const boss of catalogue.bosses)
  for (const e of catalogue.logs.find((log) => log.id === boss.logId)?.entries ?? [])
    if (!itemBoss.has(e.itemId)) itemBoss.set(e.itemId, boss.id)

const bossOf = (hit: SearchHit) =>
  hit.kind === 'boss' ? hit.id : hit.kind === 'item' ? itemBoss.get(hit.id) : tasksById.get(hit.id)?.bossId

/** Fuzzy search over bosses, drops and achievements. Picking a hit opens its boss on this profile. */
export function Search({ slug, bosses, progress }: { slug: string; bosses: BossSummary[]; progress: Progress }) {
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = useMemo(() => search(query, 5), [query])
  const hits = [...results.bosses, ...results.items, ...results.tasks]
  const summaries = useMemo(() => new Map(bosses.map((s) => [s.boss.id, s])), [bosses])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const open = (hit: SearchHit | undefined) => {
    const boss = hit && bossOf(hit)
    if (!boss) return
    setQuery('')
    input.current?.blur()
    navigate({
      from: '/$character',
      to: '/$character',
      params: { character: slug },
      // Tier order has no boss rows, so a found boss opens in the default order.
      search: (s) => ({ ...s, boss, sort: s.sort === 'tier' ? undefined : s.sort }),
      resetScroll: false,
    })
  }

  const row = (hit: SearchHit, children: React.ReactNode) => {
    const i = hits.indexOf(hit)
    return (
      <div
        key={`${hit.kind}:${hit.id}`}
        role="option"
        tabIndex={-1}
        aria-selected={i === active}
        className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 ${i === active ? 'bg-raise' : ''}`}
        onMouseEnter={() => setActive(i)}
        onMouseDown={(e) => {
          e.preventDefault()
          open(hit)
        }}
      >
        {children}
      </div>
    )
  }

  const heading = (label: string) => (
    <div role="presentation" className="px-3.5 pt-2.5 pb-1.5 font-semibold text-muted text-xs">
      {label}
    </div>
  )

  return (
    <div className="relative max-w-[560px] flex-[1_1_360px]">
      <label className="flex min-h-10 items-center gap-2 rounded border border-line2 bg-surface px-2.5">
        <SearchIcon />
        <span className="sr-only">Search bosses, drops and achievements</span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="search-results"
          value={query}
          placeholder="Search bosses, drops, achievements. Try AoD, zbow, corp"
          className="flex-auto border-0 bg-transparent py-2 outline-none"
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onBlur={() => setQuery('')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1))
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
            else if (e.key === 'Enter') open(hits[active])
            else if (e.key === 'Escape') setQuery('')
            else return
            e.preventDefault()
          }}
        />
        <kbd className="rounded-sm border border-line2 px-1.5 text-muted text-xs">/</kbd>
      </label>
      {query.trim() && (
        <div
          id="search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute top-12 right-0 left-0 z-10 rounded border border-line2 bg-surface py-1.5 shadow-[0_12px_32px_rgba(0,0,0,.35)]"
        >
          {results.bosses.length > 0 && heading('Bosses')}
          {results.bosses.map((hit) => {
            const s = summaries.get(hit.id)
            const boss = bossesById.get(hit.id)
            return row(
              hit,
              <>
                {boss && <img src={imageUrl(boss)} alt="" className="size-9 object-contain" />}
                <span className="flex-auto">
                  <strong>{hit.name}</strong>
                  {hit.alias && <span className="block text-muted text-xs">Nickname match: {hit.alias}</span>}
                </span>
                {s && (
                  <span className="text-right text-muted text-xs">
                    {s.got}/{s.total} drops
                    <span className="block">{s.tasksLeft} tasks left</span>
                  </span>
                )}
              </>,
            )
          })}
          {results.items.length > 0 && heading('Drops')}
          {results.items.map((hit) => {
            const item = itemsById.get(hit.id)
            const count = progress.items[hit.id] ?? 0
            return row(
              hit,
              <>
                {item && <img src={imageUrl(item)} alt="" className="size-7 object-contain" />}
                <span className="flex-auto">
                  {hit.name}
                  {hit.alias && <span className="block text-muted text-xs">Nickname match: {hit.alias}</span>}
                </span>
                <span className="font-semibold text-xs">{count ? `Got ${count}` : 'Missing'}</span>
              </>,
            )
          })}
          {results.tasks.length > 0 && heading('Achievements')}
          {results.tasks.map((hit) => {
            const task = tasksById.get(hit.id)
            return row(
              hit,
              <>
                <Mark done={progress.tasks.has(hit.id)} />
                <span className="flex-auto">{hit.name}</span>
                {task && (
                  <span className="text-muted text-xs">
                    {task.tier}, {task.points} pts
                  </span>
                )}
              </>,
            )
          })}
          <div role="presentation" className="mt-1.5 border-line border-t px-3.5 pt-2 pb-1 text-muted text-xs">
            {hits.length ? `${hits.length} results. Arrow keys move, Enter opens.` : 'No matches.'}
          </div>
        </div>
      )}
    </div>
  )
}
