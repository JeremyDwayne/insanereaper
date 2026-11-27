import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { catalogue } from '#/catalogue/index.ts'
import { applyWaiting } from '#/progress/edit.ts'
import { summarize } from '#/progress/summary.ts'
import type { getGroup } from '#/server/groups.ts'
import { CheckIcon, ClaimedIcon, ClockIcon, DotsIcon, LeaderIcon, UnclaimedIcon } from './icons.tsx'
import { Meter } from './Meter.tsx'

export type GroupData = NonNullable<Awaited<ReturnType<typeof getGroup>>>

/** Each character of a group with its progress summed up, waiting edits included, as the group page shows it. */
export function summarizeMembers(g: GroupData) {
  return g.characters.map((c) => {
    const ids = (joined: string) => (joined ? joined.split(',') : [])
    const items = Object.fromEntries(ids(c.items).map((id) => [id, 1]))
    const tracked = applyWaiting({ items, tasks: ids(c.tasks), parts: {}, kills: {} }, c.waiting)
    return { ...c, summary: summarize(catalogue, { items: tracked.items, tasks: new Set(tracked.tasks) }) }
  })
}

export type Member = ReturnType<typeof summarizeMembers>[number]

/** Member orders other than the default, CombatScore. */
export const memberSorts = {
  score: (a: Member, b: Member) => b.summary.score - a.summary.score,
  drops: (a: Member, b: Member) => b.summary.drops.got - a.summary.drops.got,
  name: () => 0,
}

/** Leader, claimed or not claimed in text beside its icon, and how many edits wait for the player. */
function Status({ m, short }: { m: Member; short?: boolean }) {
  const waiting = m.waiting.length
  return (
    <span className={`flex flex-col gap-0.5 ${short ? 'text-xs' : 'text-[13px]'}`}>
      <span className="flex items-center gap-2">
        {m.status === 'leader' && <LeaderIcon size={16} className="flex-none text-gold-text" />}
        {m.status === 'claimed' && <ClaimedIcon size={16} className="flex-none" />}
        {m.status === 'unclaimed' && <UnclaimedIcon size={16} className="flex-none text-muted" />}
        <span className={m.status === 'unclaimed' ? 'text-muted' : ''}>
          {m.status === 'leader'
            ? 'Leader'
            : m.status === 'claimed'
              ? 'Claimed'
              : short
                ? 'Not claimed'
                : 'Not claimed yet'}
        </span>
      </span>
      {waiting > 0 && (
        <span className="flex items-center gap-2 text-xs">
          <ClockIcon size={16} className="flex-none text-gold-text" />
          {waiting} waiting{short ? '' : ' to confirm'}
        </span>
      )}
    </span>
  )
}

export type MenuItem = { label: string; run: () => void }

/** A row's actions behind a button. Closes on a pick, Escape, or a press outside it. */
function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!items.length) return <span />
  return (
    <span ref={ref} className="relative flex justify-end">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        className={`flex size-9 cursor-pointer items-center justify-center rounded border bg-transparent text-text ${open ? 'border-gold-text' : 'border-line2'}`}
        onClick={() => setOpen(!open)}
      >
        <DotsIcon />
      </button>
      {open && (
        <span className="absolute top-[42px] right-0 z-10 flex min-w-[190px] flex-col rounded border border-line2 bg-raise p-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="min-h-10 cursor-pointer rounded border-0 bg-transparent px-3 text-left font-semibold text-text hover:bg-surface"
              onClick={() => {
                setOpen(false)
                item.run()
              }}
            >
              {item.label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

const tasksByBoss = new Set(catalogue.tasks.map((t) => t.bossId))

const ROSTER = 'grid grid-cols-[minmax(0,1.3fr)_180px_minmax(0,1fr)_minmax(0,1fr)_96px_140px_44px] items-center gap-3.5'

/** Mock A: one row per character with its totals, and each row's actions for leaders and its owner. */
export function Roster({ members, menu }: { members: Member[]; menu: (m: Member) => MenuItem[] }) {
  return (
    <section className="overflow-x-auto">
      <div className="flex min-w-[860px] flex-col">
        <div className={`${ROSTER} px-3 pb-2 text-muted text-xs`}>
          <span>Character</span>
          <span>Status</span>
          <span>Drops</span>
          <span>Achievements</span>
          <span className="text-right">CombatScore</span>
          <span>War's Blessing</span>
          <span />
        </div>
        {members.map((m) => (
          <div key={m.id} className={`${ROSTER} min-h-11 border-line border-t px-3 py-1`}>
            <Link
              to="/$character"
              params={{ character: m.slug }}
              className="truncate font-semibold text-text no-underline"
            >
              {m.name}
            </Link>
            <Status m={m} />
            <Meter got={m.summary.drops.got} total={m.summary.drops.total} kind="drops" />
            <Meter got={m.summary.tasksDone} total={catalogue.tasks.length} kind="tasks" />
            <span className="text-right font-bold tabular-nums">{m.summary.score.toLocaleString()}</span>
            <span className="text-[13px] text-muted">
              {m.summary.blessing ? `War's Blessing ${m.summary.blessing}` : 'None yet'}
            </span>
            <RowMenu label={`Actions for ${m.name}`} items={menu(m)} />
          </div>
        ))}
      </div>
    </section>
  )
}

/** A cell's shade, from nothing done to all done, as a step of the --heat scale. */
const heat = (done: number) =>
  `var(--heat-${done >= 1 ? 4 : done >= 0.75 ? 3 : done >= 0.5 ? 2 : done >= 0.25 ? 1 : 0})`

/**
 * Mock C: what each character has left at each boss, achievements or drops, shaded by how close it is to done.
 * Each cell opens that boss on the character's profile.
 */
export function BossGrid({ members, drops }: { members: Member[]; drops: boolean }) {
  // Bosses without achievements have nothing to count in achievements mode.
  const bosses = new Set(catalogue.bosses.filter((b) => drops || tasksByBoss.has(b.id)).map((b) => b.id))
  const columns = `150px 128px 64px repeat(${bosses.size}, 40px)`
  const what = drops ? 'drops' : 'achievements'
  return (
    <section className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="grid min-w-max items-end gap-0.5" style={{ gridTemplateColumns: columns }}>
          <span className="pb-1.5 pl-1 text-muted text-xs">Character</span>
          <span className="pb-1.5 text-muted text-xs">Status</span>
          <span className="pb-1.5 text-right text-muted text-xs">Score</span>
          {catalogue.bosses
            .filter((b) => bosses.has(b.id))
            .map((b) => (
              <span key={b.id} className="flex h-[132px] items-start justify-center">
                <span className="max-h-[132px] rotate-180 pb-1 font-semibold text-xs leading-tight [writing-mode:vertical-rl]">
                  {b.name}
                </span>
              </span>
            ))}
          {members.map((m) => (
            <Row key={m.id} m={m} drops={drops} what={what} bosses={bosses} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4.5 text-[13px] text-muted">
        <span>Each cell is what that character has left at that boss. A check means done.</span>
        <span className="flex items-center gap-1">
          Closer to done
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f} className="h-4 w-[22px] border border-line" style={{ background: heat(f) }} />
          ))}
        </span>
        <span>Click a cell to open that boss on the character's profile.</span>
      </div>
    </section>
  )
}

/** One character's cells in the bosses grid. */
function Row({ m, drops, what, bosses }: { m: Member; drops: boolean; what: string; bosses: Set<string> }) {
  const cell = 'flex h-10 items-center border-line border-t'
  return (
    <>
      <Link
        to="/$character"
        params={{ character: m.slug }}
        className={`${cell} truncate pl-1 font-semibold text-text no-underline`}
      >
        {m.name}
      </Link>
      <span className={cell}>
        <Status m={m} short />
      </span>
      <span className={`${cell} justify-end pr-1.5 font-bold tabular-nums`}>{m.summary.score.toLocaleString()}</span>
      {m.summary.bosses
        .filter((s) => bosses.has(s.boss.id))
        .map((s) => {
          const total = drops ? s.total : s.tasks.length
          const left = drops ? s.total - s.got : s.tasksLeft
          return (
            <Link
              key={s.boss.id}
              to="/$character"
              params={{ character: m.slug }}
              search={{ boss: s.boss.id }}
              aria-label={`${m.name}, ${s.boss.name}: ${left ? `${left} ${what} left` : 'done'}`}
              title={`${s.boss.name}: ${left ? `${left} ${what} left` : 'done'}`}
              className="flex h-10 items-center justify-center font-semibold text-[13px] text-text tabular-nums no-underline"
              style={{ background: heat(1 - left / total) }}
            >
              {left || <CheckIcon size={16} />}
            </Link>
          )
        })}
    </>
  )
}
