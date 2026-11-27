import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCharacter } from '#/server/characters.ts'
import { setItemCount, setKillCount, setPartDone, setTaskDone } from '#/server/progress.ts'
import type { KillKind } from './kills.ts'

/** A character's profile and progress, fetched once per session and then edited in place. */
export const characterQuery = (slug: string) =>
  queryOptions({ queryKey: ['character', slug], queryFn: () => getCharacter({ data: { slug } }) })

export type CharacterData = NonNullable<Awaited<ReturnType<typeof getCharacter>>>

export type Edit =
  | { itemId: string; count: number }
  | { taskId: string; done: boolean }
  | { taskId: string; part: string; done: boolean }
  | { bossId: string; kind: KillKind; value: number }

function apply(c: CharacterData, edit: Edit): CharacterData {
  if ('itemId' in edit) return { ...c, items: { ...c.items, [edit.itemId]: edit.count } }
  if ('bossId' in edit) return { ...c, kills: { ...c.kills, [`${edit.bossId}:${edit.kind}`]: edit.value } }
  if ('part' in edit) {
    const ticked = (c.parts[edit.taskId] ?? []).filter((p) => p !== edit.part)
    return { ...c, parts: { ...c.parts, [edit.taskId]: edit.done ? [...ticked, edit.part] : ticked } }
  }
  const tasks = c.tasks.filter((id) => id !== edit.taskId)
  return { ...c, tasks: edit.done ? [...tasks, edit.taskId] : tasks }
}

/** The edit that puts back what `edit` changes. */
function undoOf(c: CharacterData, edit: Edit): Edit {
  if ('itemId' in edit) return { ...edit, count: c.items[edit.itemId] ?? 0 }
  if ('bossId' in edit) return { ...edit, value: c.kills[`${edit.bossId}:${edit.kind}`] ?? 0 }
  if ('part' in edit) return { ...edit, done: c.parts[edit.taskId]?.includes(edit.part) ?? false }
  return { ...edit, done: !edit.done }
}

/** Sends an edit to the server function that stores its kind. */
function save(data: Edit & { characterId: string }) {
  if ('itemId' in data) return setItemCount({ data })
  if ('bossId' in data) return setKillCount({ data })
  if ('part' in data) return setPartDone({ data })
  return setTaskDone({ data })
}

/** Saves a drop count, achievement or part tick, or kill count. Shows it at once and reverts it if the server refuses. */
export function useEdit(slug: string) {
  const queryClient = useQueryClient()
  const { queryKey } = characterQuery(slug)
  return useMutation({
    // One at a time, so quick +1 clicks reach the server in order.
    scope: { id: slug },
    mutationFn: async (edit: Edit) => {
      const characterId = queryClient.getQueryData(queryKey)?.id ?? ''
      const result = await save({ characterId, ...edit })
      if (!result.ok) throw new Error('Not saved')
    },
    onMutate: (edit) => {
      const c = queryClient.getQueryData(queryKey)
      if (!c) return
      queryClient.setQueryData(queryKey, apply(c, edit))
      return { undo: undoOf(c, edit) }
    },
    onError: (_error, _edit, context) => {
      const c = queryClient.getQueryData(queryKey)
      if (c && context) queryClient.setQueryData(queryKey, apply(c, context.undo))
    },
  })
}
