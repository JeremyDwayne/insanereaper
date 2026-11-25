import { useState } from 'react'
import { imageUrl } from '#/catalogue/images.ts'
import { itemsById } from '#/catalogue/index.ts'
import type { Task } from '#/catalogue/schema.ts'
import type { Edit } from '#/progress/queries.ts'
import { type LogSummary, obtained, type Progress, tierSummaries } from '#/progress/summary.ts'
import { CheckIcon } from './icons.tsx'
import { Mark } from './Mark.tsx'

type Props = {
  s: LogSummary
  progress: Progress
  /** Present only for the character's own account. */
  edit?: (edit: Edit) => void
  show: 'all' | 'drops' | 'tasks'
}

/** An expanded boss log: art, missing drops first, then achievements left by tier. */
export function LogPanel({ s, progress, edit, show }: Props) {
  const [showObtained, setShowObtained] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const entries = s.log.entries.map((e) => ({ ...e, item: itemsById.get(e.itemId) }))
  const missing = entries.filter((e) => !obtained(progress, e.itemId))
  const got = entries.filter((e) => obtained(progress, e.itemId))
  const tiers = tierSummaries(s.tasks, progress).filter((t) => showDone || !t.complete)

  return (
    <div className="flex flex-wrap gap-7 px-4 pt-2 pb-5">
      <div className="flex flex-[0_1_200px] flex-col gap-2">
        <img
          src={imageUrl(s.log)}
          alt={s.log.name}
          className="h-[227px] w-[180px] rounded bg-surface object-contain"
          loading="lazy"
        />
        {s.log.title && <span className="text-muted text-xs">Log title: {s.log.title}</span>}
        <a
          href={`https://runescape.wiki/w/${encodeURIComponent(s.log.page.replaceAll(' ', '_'))}`}
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
              Missing drops{' '}
              <span className="font-normal text-muted">
                {missing.length} of {entries.length}
              </span>
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5">
              {missing.map((e) => (
                <Drop key={e.itemId} {...e} count={0} edit={edit} />
              ))}
              {showObtained &&
                got.map((e) => <Drop key={e.itemId} {...e} count={progress.items[e.itemId] ?? 0} edit={edit} />)}
            </div>
            {got.length > 0 && (
              <button
                type="button"
                className="mt-2 cursor-pointer border-0 bg-transparent p-0 font-semibold text-[13px] text-gold-text"
                onClick={() => setShowObtained(!showObtained)}
              >
                {showObtained ? 'Hide' : 'Show'} {got.length} obtained drops
              </button>
            )}
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
            <div className="flex flex-col gap-3.5">
              {tiers.map((t) => (
                <div key={t.tier}>
                  <div className="flex items-center gap-2.5 border-line border-b py-1.5">
                    <span className="font-extrabold">{t.tier}</span>
                    <span className="text-muted text-xs">
                      {t.done} of {t.total} done, {t.pointsLeft} points left
                    </span>
                  </div>
                  {s.tasks
                    .filter((task) => task.tier === t.tier && (showDone || !progress.tasks.has(task.id)))
                    .map((task) => (
                      <TaskRow key={task.id} task={task} done={progress.tasks.has(task.id)} edit={edit} />
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
  edit?: (edit: Edit) => void
}

const step = 'size-7 cursor-pointer rounded border border-line2 bg-bg font-bold text-text'

/** A drop tile. Missing tiles are dashed; obtained tiles are solid with a check and the count. */
function Drop({ itemId, rarity, item, count, edit }: DropProps) {
  const body = (
    <>
      {item && <img src={imageUrl(item)} alt="" className="size-7 object-contain" loading="lazy" />}
      <span className="min-w-0 flex-auto">
        <span className="block text-[13px]">{item?.name ?? itemId}</span>
        <span className="block text-muted text-xs">{rarity}</span>
      </span>
      {item?.pet && <span className="font-bold text-[11px] text-muted">Pet</span>}
    </>
  )
  const box = 'flex min-h-11 items-center gap-2.5 rounded bg-surface px-2.5 py-2 text-left'
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
      <span className="flex items-center gap-1 font-bold text-gold-text text-xs">
        <CheckIcon size={14} />
        {edit ? (
          <>
            <button
              type="button"
              className={step}
              aria-label="One fewer"
              onClick={() => edit({ itemId, count: count - 1 })}
            >
              -
            </button>
            {count}
            <button
              type="button"
              className={step}
              aria-label="One more"
              onClick={() => edit({ itemId, count: Math.min(count + 1, 65535) })}
            >
              +
            </button>
          </>
        ) : (
          `Got ${count}`
        )}
      </span>
    </div>
  )
}

/** One achievement. The owner gets a checkbox; visitors see a read-only mark. */
function TaskRow({ task, done, edit }: { task: Task; done: boolean; edit?: (edit: Edit) => void }) {
  const text = (
    <span className={`flex-auto ${done ? 'opacity-60' : ''}`}>
      <strong>{task.name}</strong>
      <span className="mt-0.5 block text-[13px] text-muted">{task.description}</span>
    </span>
  )
  const points = <span className="whitespace-nowrap text-xs">{task.points} pts</span>
  const row = 'flex items-start gap-3 border-line border-b py-2'
  return edit ? (
    <label className={`${row} cursor-pointer`}>
      <input
        type="checkbox"
        checked={done}
        className="mt-0.5 size-[18px] accent-gold"
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
  )
}
