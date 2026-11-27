import { type } from 'arktype'
import { bossesById, itemsById, tasksById } from '#/catalogue/index.ts'
import { KILL_KINDS } from './kills.ts'
import { TASK_PARTS } from './parts.ts'

/** One change to a character's progress: a drop count, an achievement or part tick, or a typed-in kill count. */
export const Edit = type({ itemId: 'string', count: '0 <= number.integer <= 65535' })
  .or({ taskId: 'string', part: 'string', done: 'boolean' })
  .or({ taskId: 'string', done: 'boolean' })
  .or({ bossId: 'string', kind: type.enumerated(...KILL_KINDS), value: '0 <= number.integer <= 100000000' })

export type Edit = typeof Edit.infer

/** A character's progress as a profile holds it. Kill counts are keyed by `${bossId}:${kind}`, parts by task id. */
export type Tracked = {
  items: Record<string, number>
  tasks: string[]
  parts: Partial<Record<string, string[]>>
  kills: Record<string, number>
}

/** A group leader's edit to a claimed character, waiting for its player. `group` is the group's name. */
export type Waiting = { target: string; edit: Edit; group: string }

/** What an edit sets. Two edits with the same target overwrite each other. */
export function editTarget(edit: Edit): string {
  if ('itemId' in edit) return `item:${edit.itemId}`
  if ('bossId' in edit) return `kill:${edit.bossId}:${edit.kind}`
  if ('part' in edit) return `part:${edit.taskId}:${edit.part}`
  return `task:${edit.taskId}`
}

/** True when the edit names a drop, achievement, part or boss the catalogue still has. */
export function inCatalogue(edit: Edit): boolean {
  if ('itemId' in edit) return itemsById.has(edit.itemId)
  if ('bossId' in edit) return bossesById.has(edit.bossId)
  if ('part' in edit) return tasksById.has(edit.taskId) && !!TASK_PARTS[edit.taskId]?.includes(edit.part)
  return tasksById.has(edit.taskId)
}

/** True when the edit would leave the progress as it is. */
export function unchanged(c: Tracked, edit: Edit): boolean {
  if ('itemId' in edit) return (c.items[edit.itemId] ?? 0) === edit.count
  if ('bossId' in edit) return (c.kills[`${edit.bossId}:${edit.kind}`] ?? 0) === edit.value
  if ('part' in edit) return (c.parts[edit.taskId] ?? []).includes(edit.part) === edit.done
  return c.tasks.includes(edit.taskId) === edit.done
}

export function applyEdit<T extends Tracked>(c: T, edit: Edit): T {
  if ('itemId' in edit) return { ...c, items: { ...c.items, [edit.itemId]: edit.count } }
  if ('bossId' in edit) return { ...c, kills: { ...c.kills, [`${edit.bossId}:${edit.kind}`]: edit.value } }
  if ('part' in edit) {
    const ticked = (c.parts[edit.taskId] ?? []).filter((p) => p !== edit.part)
    return { ...c, parts: { ...c.parts, [edit.taskId]: edit.done ? [...ticked, edit.part] : ticked } }
  }
  const tasks = c.tasks.filter((id) => id !== edit.taskId)
  return { ...c, tasks: edit.done ? [...tasks, edit.taskId] : tasks }
}

/** Progress with waiting edits applied, as the group page and a leader see it. */
export const applyWaiting = <T extends Tracked>(c: T, waiting: Waiting[]): T =>
  waiting.reduce((acc, w) => (inCatalogue(w.edit) ? applyEdit(acc, w.edit) : acc), c)
