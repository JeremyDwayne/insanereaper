import { Link } from '@tanstack/react-router'
import { bossesById, catalogue, itemsById, tasksById } from '#/catalogue/index.ts'
import type { Edit, Tracked, Waiting } from '#/progress/edit.ts'
import { KILL_LABELS } from '#/progress/kills.ts'
import { type CharacterData, holdsEdits, useResolve } from '#/progress/queries.ts'
import { counted, list } from '#/text.ts'
import { ClockIcon, UnclaimedIcon } from './icons.tsx'

/** How an edit reads in a list, against the confirmed progress it would change. */
function describe(edit: Edit, c: Tracked) {
  if ('itemId' in edit) {
    const before = c.items[edit.itemId] ?? 0
    return {
      kind: 'Drop',
      what: itemsById.get(edit.itemId)?.name ?? edit.itemId,
      where: list(catalogue.logs.filter((l) => l.entries.some((e) => e.itemId === edit.itemId)).map((l) => l.name)),
      change: `${before ? before.toLocaleString() : 'Not obtained'} to ${edit.count.toLocaleString()}`,
    }
  }
  if ('bossId' in edit) {
    const before = c.kills[`${edit.bossId}:${edit.kind}`] ?? 0
    return {
      kind: 'Kill count',
      what: KILL_LABELS[edit.kind],
      where: bossesById.get(edit.bossId)?.name ?? '',
      change: `${before.toLocaleString()} to ${edit.value.toLocaleString()}`,
    }
  }
  const task = tasksById.get(edit.taskId)
  if ('part' in edit) {
    return {
      kind: 'Part',
      what: edit.part,
      where: task ? `${task.name}, ${bossesById.get(task.bossId)?.name}` : '',
      change: edit.done ? 'Done' : 'Not done',
    }
  }
  return {
    kind: 'Achievement',
    what: task?.name ?? edit.taskId,
    where: task ? `${bossesById.get(task.bossId)?.name}, ${task.tier}, ${counted(task.points, 'point')}` : '',
    change: edit.done ? 'Done' : 'Not done',
  }
}

const row = 'flex flex-wrap items-center gap-x-3.5 gap-y-1 border-line border-t py-2 sm:grid sm:py-0'
const ownerColumns = 'sm:grid-cols-[110px_minmax(0,1.6fr)_minmax(0,1fr)_130px_180px] sm:min-h-11'
const leaderColumns = 'sm:grid-cols-[110px_minmax(0,1.6fr)_minmax(0,1fr)] sm:min-h-9'

/** The kind, name, place and change cells of a waiting edit's row. */
function EditCells({ w, c }: { w: Waiting; c: Tracked }) {
  const d = describe(w.edit, c)
  return (
    <>
      <span className="text-muted">{d.kind}</span>
      <span>
        <strong>{d.what}</strong> <span className="text-muted text-xs">{d.where}</span>
      </span>
      <span>{d.change}</span>
    </>
  )
}

const button = 'cursor-pointer rounded font-[inherit] disabled:opacity-60'

/** The owner's list of edits from group leaders, each confirmed or denied, or all at once. */
export function WaitingReview({ data }: { data: CharacterData }) {
  const resolve = useResolve(data.slug)
  if (data.role !== 'owner' || data.waiting.length === 0) return null
  const groups = [...new Set(data.waiting.map((w) => w.group))]
  const n = data.waiting.length
  return (
    <>
      <section className="flex flex-col gap-2.5 rounded border-2 border-gold-text px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <ClockIcon size={20} className="flex-none text-gold-text" />
          <h2 className="m-0 font-extrabold text-[17px]">{counted(n, 'change')} from your group leaders</h2>
          <span className="text-muted">
            {n > 1 ? 'They show' : 'It shows'} on {list(groups)}'s {groups.length > 1 ? 'pages' : 'page'} now, and on
            your profile once you confirm {n > 1 ? 'them' : 'it'}.
          </span>
          <span className="flex-auto" />
          <button
            type="button"
            disabled={resolve.isPending}
            className={`${button} min-h-10 border-0 bg-gold px-4 font-bold text-on-gold`}
            onClick={() => resolve.mutate({ confirm: true })}
          >
            Confirm all
          </button>
          <button
            type="button"
            disabled={resolve.isPending}
            className={`${button} min-h-10 border border-line2 bg-transparent px-4 font-semibold text-text`}
            onClick={() => resolve.mutate({ confirm: false })}
          >
            Deny all
          </button>
        </div>
        <div className="flex flex-col">
          <div className={`hidden gap-3.5 py-1 text-muted text-xs sm:grid ${ownerColumns}`}>
            <span>Kind</span>
            <span>What</span>
            <span>Change</span>
            <span>From</span>
            <span />
          </div>
          {data.waiting.map((w) => (
            <div key={w.target} className={`${row} ${ownerColumns}`}>
              <EditCells w={w} c={data} />
              <span className="text-muted">{w.group}</span>
              <span className="flex flex-auto justify-end gap-2">
                <button
                  type="button"
                  disabled={resolve.isPending}
                  className={`${button} min-h-9 border border-gold-text bg-transparent px-3 font-bold text-text`}
                  onClick={() => resolve.mutate({ confirm: true, targets: [w.target] })}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  disabled={resolve.isPending}
                  className={`${button} min-h-9 border border-line2 bg-transparent px-3 font-semibold text-text`}
                  onClick={() => resolve.mutate({ confirm: false, targets: [w.target] })}
                >
                  Deny
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
      <p className="m-0 text-[13px] text-muted">
        Denied changes leave the group's page too. If you tick or untick the same thing yourself, your edit wins and the
        waiting one goes.
      </p>
    </>
  )
}

const SHOWN = 3

/**
 * What a group leader or visitor should know before the progress: that a leader's edits wait for the player,
 * listing the first few, or that nobody has claimed the character yet.
 */
export function CharacterNotice({ data }: { data: CharacterData }) {
  if (holdsEdits(data)) {
    const more = data.waiting.length - SHOWN
    return (
      <div className="flex flex-col gap-2.5 rounded border-2 border-gold-text px-4 py-3.5">
        <p className="m-0 flex items-start gap-2.5">
          <ClockIcon size={20} className="flex-none text-gold-text" />
          <span>
            <strong>
              You lead {data.ledGroup}, so you can edit {data.name}.
            </strong>{' '}
            Your changes count on the group's page now and reach this public profile when {data.name} confirms them.
            This page shows them already applied.
          </span>
        </p>
        {data.waiting.length > 0 && (
          <div className="flex flex-col pl-[30px]">
            {data.waiting.slice(0, SHOWN).map((w) => (
              <div key={w.target} className={`${row} ${leaderColumns}`}>
                <EditCells w={w} c={data} />
              </div>
            ))}
            <span className="border-line border-t pt-2 text-muted">
              {more > 0 && `and ${more} more waiting. `}Undo one by changing it back below.
            </span>
          </div>
        )}
      </div>
    )
  }
  if (data.claimed) return null
  return (
    <p className="m-0 flex items-start gap-2.5 rounded border border-line2 border-dashed p-3">
      <UnclaimedIcon size={20} className="flex-none text-muted" />
      <span>
        <strong>Not claimed yet.</strong>
        {data.groups.length > 0 && (
          <>
            {' '}
            Tracked by <GroupLinks groups={data.groups} />.
          </>
        )}{' '}
        {data.role === 'leader' ? (
          `You lead ${data.groups.length > 1 ? data.ledGroup : 'it'}, so your changes save straight away and come with the character when its player claims it.`
        ) : (
          <>
            Is this you?{' '}
            <Link to="/start" search={{ add: true }}>
              Claim it
            </Link>{' '}
            to keep what is here and edit it yourself.
          </>
        )}
      </span>
    </p>
  )
}

/** Links to each group's page, joined as "A, B and C". */
function GroupLinks({ groups }: { groups: { name: string; slug: string }[] }) {
  return new Intl.ListFormat('en').formatToParts(groups.map((g) => g.slug)).map((part) =>
    part.type === 'element' ? (
      <Link key={part.value} to="/groups/$group" params={{ group: part.value }}>
        {groups.find((g) => g.slug === part.value)?.name}
      </Link>
    ) : (
      part.value
    ),
  )
}
