import { useMemo, useState } from 'react'
import { bossesById, catalogue } from '#/catalogue/index.ts'
import type { Tier } from '#/catalogue/schema.ts'
import type { Edit } from '#/progress/edit.ts'
import type { Progress } from '#/progress/summary.ts'
import { tierLists } from '#/progress/tiers.ts'
import { LayoutButton, TaskTile, tileClass } from './BossPanel.tsx'
import { CheckIcon } from './icons.tsx'
import { Mark } from './Mark.tsx'

type TierFilter = 'done' | 'left'

const FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'left', label: 'Not done' },
] as const

type Props = {
  progress: Progress
  /** Present for the character's owner and its group leaders. */
  edit?: (edit: Edit) => void
  /** The open tier; the first with anything left when absent. */
  tier?: Tier
  filter?: TierFilter
  setSearch: (next: { tier?: Tier; filter?: TierFilter }) => void
}

/** Every achievement by Combat Mastery tier, one tier at a time in the game's order, to check ticks against the game. */
export function TierView({ progress, edit, tier, filter, setSearch }: Props) {
  const lists = useMemo(() => tierLists(catalogue.tasks, progress), [progress])
  // Picked once, so ticking the last achievement in it doesn't switch tiers.
  const [firstLeft] = useState(() => (lists.find((l) => l.done < l.total) ?? lists.at(-1))?.tier)
  const open = lists.find((l) => l.tier === (tier ?? firstLeft))
  if (!open) return null
  const shows = (done: boolean) => !filter || (filter === 'done') === done
  const tasks = open.tasks.filter((t) => shows(progress.tasks.has(t.id)))
  const mastery = open.mastery && shows(open.mastery.done) ? open.mastery : null
  const counts = { All: open.total, Done: open.done, 'Not done': open.total - open.done }

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {lists.map((l) => {
          const on = l === open
          return (
            <button
              key={l.tier}
              type="button"
              aria-pressed={on}
              onClick={() => setSearch({ tier: l.tier })}
              className={`flex min-h-15 cursor-pointer flex-col items-start gap-0.5 rounded border px-3 py-2 text-left ${on ? 'border-gold bg-gold text-on-gold' : 'border-line2 bg-surface text-text'}`}
            >
              <span className="flex items-center gap-1.5 font-extrabold text-[15px]">
                {l.tier}
                {l.done === l.total && (
                  <>
                    <CheckIcon size={14} />
                    <span className="sr-only">complete</span>
                  </>
                )}
              </span>
              <span className="flex flex-wrap gap-x-1.5 font-semibold text-[13px] tabular-nums">
                {l.done}/{l.total}
                <span className="whitespace-nowrap font-normal">
                  {l.points}/{l.maxPoints} pts
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <span className="flex">
        {FILTERS.map((f, i) => (
          <LayoutButton
            key={f.label}
            pressed={filter === f.value}
            onClick={() => setSearch({ filter: f.value })}
            className={i === 0 ? 'rounded-l' : i === FILTERS.length - 1 ? '-ml-px rounded-r' : '-ml-px'}
          >
            {`${f.label} ${counts[f.label]}`}
          </LayoutButton>
        ))}
      </span>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-1.5">
        {mastery && (
          <div className={tileClass(mastery.done)} title="Done once every achievement in the tier before is done">
            <Mark done={mastery.done} />
            <span className="min-w-0">
              <strong className="block text-[13px] leading-tight">{mastery.name}</strong>
              <span className="text-muted text-xs">No points</span>
            </span>
          </div>
        )}
        {tasks.map((t) => (
          <TaskTile
            key={t.id}
            task={t}
            done={progress.tasks.has(t.id)}
            edit={edit}
            label={bossesById.get(t.bossId)?.name ?? t.subcategory}
          />
        ))}
      </div>
      {!mastery && tasks.length === 0 && (
        <p className="m-0 text-muted">
          {filter === 'done' ? `Nothing done in ${open.tier} yet.` : `Nothing left in ${open.tier}.`}
        </p>
      )}
    </section>
  )
}
