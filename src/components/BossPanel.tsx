import { useEffect, useState } from 'react'
import { imageUrl } from '#/catalogue/images.ts'
import { catalogue, itemsById } from '#/catalogue/index.ts'
import type { Task } from '#/catalogue/schema.ts'
import { chanceByNow, KILL_LABELS, type KillKind, killKinds } from '#/progress/kills.ts'
import { partEdits, TASK_PARTS } from '#/progress/parts.ts'
import type { Edit } from '#/progress/queries.ts'
import { type BossSummary, obtained, type Progress, tierSummaries } from '#/progress/summary.ts'
import { CheckIcon } from './icons.tsx'
import { Mark } from './Mark.tsx'

const KINDS = killKinds(catalogue)

type Props = {
  s: BossSummary
  progress: Progress
  /** Kill counts keyed by `${bossId}:${kind}`. */
  kills: Record<string, number>
  /** Ticked part names by task id (see TASK_PARTS). */
  parts: Partial<Record<string, string[]>>
  /** Present only for the character's own account. */
  edit?: (edit: Edit) => void
  show: 'all' | 'drops' | 'tasks'
}

/** An expanded boss: art and kill counts, every drop in its log with missing ones first, then achievements left by tier. */
export function BossPanel({ s, progress, kills, parts, edit, show }: Props) {
  const [showDone, setShowDone] = useState(false)
  const entries = s.log.entries.map((e) => ({ ...e, item: itemsById.get(e.itemId) }))
  const missing = entries.filter((e) => !obtained(progress, e.itemId))
  const got = entries.filter((e) => obtained(progress, e.itemId))
  const tiers = tierSummaries(s.tasks, progress).filter((t) => showDone || !t.complete)
  const kinds = KINDS.get(s.boss.id) ?? ['normal']
  const killsOf = (kind: KillKind) => kills[`${s.boss.id}:${kind}`] ?? 0
  const totalKills = killsOf('normal') + killsOf('hard')

  return (
    <div className="flex flex-wrap gap-7 px-4 pt-2 pb-5">
      <div className="flex flex-[0_1_200px] flex-col gap-2">
        <img
          src={imageUrl(s.boss)}
          alt={s.boss.name}
          className="h-[227px] w-[180px] rounded bg-surface object-contain"
          loading="lazy"
        />
        {kinds.map((kind) => (
          <KillField
            key={kind}
            kind={kind}
            value={killsOf(kind)}
            save={edit && ((value) => edit({ bossId: s.boss.id, kind, value }))}
          />
        ))}
        {s.log.title && <span className="text-muted text-xs">Log title: {s.log.title}</span>}
        <a
          href={`https://runescape.wiki/w/${encodeURIComponent(s.boss.page.replaceAll(' ', '_'))}`}
          className="text-xs"
          target="_blank"
          rel="noreferrer"
        >
          Wiki page
        </a>
      </div>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {show !== 'tasks' && (
          <div>
            <h3 className="mt-0 mb-2 font-bold text-sm">
              {s.boss.id === s.log.id ? 'Drops' : `${s.log.name} drops`}{' '}
              <span className="font-normal text-muted">
                {missing.length} of {entries.length} missing
                {totalKills > 0 && `, chance by now at ${totalKills.toLocaleString()} kills`}
              </span>
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1.5">
              {missing.map((e) => (
                <Drop key={e.itemId} {...e} count={0} kills={totalKills} edit={edit} />
              ))}
              {got.map((e) => (
                <Drop key={e.itemId} {...e} count={progress.items[e.itemId] ?? 0} kills={0} edit={edit} />
              ))}
            </div>
          </div>
        )}
        {show !== 'drops' && s.tasks.length > 0 && (
          <div>
            <h3 className="mt-0 mb-2 font-bold text-sm">
              Achievements left{' '}
              <span className="font-normal text-muted">
                {s.tasksLeft} of {s.tasks.length}, {s.pointsLeft} points
              </span>
            </h3>
            <div className="flex flex-col gap-4">
              {tiers.map((t) => (
                <div key={t.tier}>
                  <div className="flex items-baseline gap-2.5 rounded-t border-line2 border-b-2 bg-raise px-2.5 py-2">
                    <span className="font-extrabold text-[15px]">{t.tier}</span>
                    <span className="text-muted text-xs">
                      {t.done} of {t.total} done, {t.pointsLeft} points left
                    </span>
                  </div>
                  {s.tasks
                    .filter((task) => task.tier === t.tier && (showDone || !progress.tasks.has(task.id)))
                    .map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        done={progress.tasks.has(task.id)}
                        ticked={parts[task.id] ?? []}
                        edit={edit}
                      />
                    ))}
                </div>
              ))}
            </div>
            {s.tasksLeft < s.tasks.length && (
              <button
                type="button"
                className="mt-2 cursor-pointer border-0 bg-transparent p-0 font-semibold text-[13px] text-gold-text"
                onClick={() => setShowDone(!showDone)}
              >
                {showDone ? 'Hide' : 'Show'} {s.tasks.length - s.tasksLeft} done achievements
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type DropProps = {
  itemId: string
  rarity: string
  item: ReturnType<typeof itemsById.get>
  count: number
  /** Kills so far; above 0 adds the chance of having had the drop by now. */
  kills: number
  edit?: (edit: Edit) => void
}

/** A drop tile. Missing tiles have a dashed outline; obtained tiles a solid gold one with a check and the count. */
function Drop({ itemId, rarity, item, count, kills, edit }: DropProps) {
  const chance = kills > 0 ? chanceByNow(rarity, kills) : null
  const body = (
    <>
      {item && <img src={imageUrl(item)} alt="" className="size-8 flex-none object-contain" loading="lazy" />}
      <span className="min-w-0 flex-auto">
        <span className="block text-[13px]">
          {item?.name ?? itemId}
          {item?.pet && <span className="ml-1.5 font-bold text-[11px] text-muted">Pet</span>}
        </span>
        <span className="block text-muted text-xs">
          {rarity}
          {chance !== null && `, ${Math.round(chance * 100)}% by now`}
        </span>
      </span>
    </>
  )
  const box = 'flex min-h-14 items-center gap-2.5 rounded bg-surface px-2.5 py-2 text-left'
  if (count === 0) {
    const missing = `${box} border border-line2 border-dashed`
    return edit ? (
      <button
        type="button"
        className={`${missing} cursor-pointer`}
        title="Mark obtained"
        onClick={() => edit({ itemId, count: 1 })}
      >
        {body}
      </button>
    ) : (
      <div className={missing}>{body}</div>
    )
  }
  return (
    <div className={`${box} border-2 border-gold-text`}>
      {body}
      <span className="flex flex-none items-center gap-1 font-bold text-gold-text text-xs">
        <CheckIcon size={14} />
        {edit ? <CountEditor count={count} save={(next) => edit({ itemId, count: next })} /> : count}
      </span>
    </div>
  )
}

/** The obtained count as a button; clicking it swaps in a small field. Enter or leaving saves, Escape cancels, 0 marks missing. */
function CountEditor({ count, save }: { count: number; save: (count: number) => void }) {
  const [text, setText] = useState<string | null>(null)
  if (text === null)
    return (
      <button
        type="button"
        title="Edit count"
        className="min-w-8 cursor-pointer rounded border border-line2 border-dashed bg-transparent px-1.5 py-1 font-bold text-gold-text"
        onClick={() => setText(String(count))}
      >
        {count}
      </button>
    )
  const commit = () => {
    const next = Math.max(0, Math.min(65535, Math.trunc(Number(text) || 0)))
    setText(null)
    if (next !== count) save(next)
  }
  return (
    <input
      type="number"
      min={0}
      max={65535}
      value={text}
      aria-label="Count"
      // biome-ignore lint/a11y/noAutofocus: the field only appears because the user clicked to edit.
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      className="w-16 rounded border border-line2 bg-bg px-1.5 py-1 text-right text-text"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setText(null)
      }}
    />
  )
}

type TaskRowProps = {
  task: Task
  done: boolean
  /** Ticked part names, for tasks in TASK_PARTS. */
  ticked: string[]
  edit?: (edit: Edit) => void
}

/** One achievement. The owner gets a checkbox; visitors see a read-only mark. Open multi-part tasks show their parts. */
function TaskRow({ task, done, ticked, edit }: TaskRowProps) {
  const parts = TASK_PARTS[task.id]
  const text = (
    <span className={`flex-auto ${done ? 'opacity-60' : ''}`}>
      <strong>{task.name}</strong>
      <span className="mt-0.5 block text-[13px] text-muted">{task.description}</span>
    </span>
  )
  const points = <span className="whitespace-nowrap text-xs">{task.points} pts</span>
  const row = 'flex items-start gap-3 px-2.5 py-2'
  return (
    <div className="border-line border-b">
      {edit ? (
        <label className={`${row} cursor-pointer`}>
          <input
            type="checkbox"
            checked={done}
            className="mt-0.5 size-[18px] flex-none accent-gold"
            onChange={(e) => edit({ taskId: task.id, done: e.target.checked })}
          />
          {text}
          {points}
        </label>
      ) : (
        <div className={row}>
          <span className="mt-0.5">
            <Mark done={done} />
          </span>
          {text}
          {points}
        </div>
      )}
      {parts && !done && (
        <Parts
          parts={parts}
          ticked={ticked}
          tick={
            edit &&
            ((part, on) => {
              for (const e of partEdits(task.id, part, on, ticked)) edit(e)
            })
          }
        />
      )}
    </div>
  )
}

type PartsProps = {
  parts: readonly string[]
  ticked: string[]
  /** Present only for the character's own account. */
  tick?: (part: string, done: boolean) => void
}

/** A multi-part task's progress: one meter segment per part, then a tile per part, dashed until ticked. */
function Parts({ parts, ticked, tick }: PartsProps) {
  const done = parts.filter((p) => ticked.includes(p)).length
  return (
    <div className="flex flex-col gap-2 pr-2.5 pb-2.5 pl-10">
      <span className="flex items-center gap-2.5 text-muted text-xs tabular-nums">
        <span className="flex gap-0.5" aria-hidden="true">
          {parts.map((p) => (
            <span key={p} className={`h-2 w-5 border ${ticked.includes(p) ? 'border-ach bg-ach' : 'border-line2'}`} />
          ))}
        </span>
        {done} of {parts.length}
      </span>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {parts.map((p) => {
          const on = ticked.includes(p)
          const box = `flex min-h-10 items-center justify-between gap-1.5 rounded bg-surface px-2.5 py-1.5 text-left text-[13px] text-text ${
            on ? 'border-2 border-gold-text' : 'border border-line2 border-dashed'
          }`
          const body = (
            <>
              {p}
              {on && (
                <span className="flex flex-none text-gold-text">
                  <CheckIcon size={14} />
                  <span className="sr-only">Done</span>
                </span>
              )}
            </>
          )
          return tick ? (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              title={on ? 'Mark not done' : 'Mark done'}
              className={`${box} cursor-pointer`}
              onClick={() => tick(p, !on)}
            >
              {body}
            </button>
          ) : (
            <span key={p} className={box}>
              {body}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** A kill count. The owner types it or adds one; visitors see the number. Saves when the field loses focus. */
function KillField({ kind, value, save }: { kind: KillKind; value: number; save?: (value: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  if (!save)
    return (
      <span className="text-[13px]">
        <span className="text-muted">{KILL_LABELS[kind]}</span> <strong>{value.toLocaleString()}</strong>
      </span>
    )
  const commit = () => {
    const next = Math.max(0, Math.min(100_000_000, Math.trunc(Number(text) || 0)))
    if (next !== value) save(next)
    else setText(String(value))
  }
  return (
    <label className="flex flex-col gap-1.5 font-semibold text-[13px]">
      {KILL_LABELS[kind]}
      <span className="flex gap-1.5">
        <input
          type="number"
          min={0}
          value={text}
          className="w-[90px] rounded border border-line2 bg-surface px-2.5 py-2"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {kind !== 'enrage' && (
          <button
            type="button"
            aria-label={`Add one to ${KILL_LABELS[kind].toLowerCase()}`}
            className="min-h-[38px] min-w-11 cursor-pointer rounded border-0 bg-gold font-extrabold text-on-gold"
            onClick={() => save(value + 1)}
          >
            +1
          </button>
        )}
      </span>
    </label>
  )
}
