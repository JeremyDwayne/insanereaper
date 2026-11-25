import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCharacter } from '#/server/characters.ts'
import { setItemCount, setKillCount, setTaskDone } from '#/server/progress.ts'
import type { KillKind } from './kills.ts'

/** A character's profile and progress, fetched once per session and then edited in place. */
export const characterQuery = (slug: string) =>
  queryOptions({ queryKey: ['character', slug], queryFn: () => getCharacter({ data: { slug } }) })

export type CharacterData = NonNullable<Awaited<ReturnType<typeof getCharacter>>>

export type Edit =
  | { itemId: string; count: number }
  | { taskId: string; done: boolean }
  | { logId: string; kind: KillKind; value: number }

function apply(c: CharacterData, edit: Edit): CharacterData {
  if ('itemId' in edit) return { ...c, items: { ...c.items, [edit.itemId]: edit.count } }
  if ('logId' in edit) return { ...c, kills: { ...c.kills, [`${edit.logId}:${edit.kind}`]: edit.value } }
  const tasks = c.tasks.filter((id) => id !== edit.taskId)
  return { ...c, tasks: edit.done ? [...tasks, edit.taskId] : tasks }
}

/** Saves a drop count or achievement tick. Shows it at once and reverts it if the server refuses. */
export function useEdit(slug: string) {
  const queryClient = useQueryClient()
  const { queryKey } = characterQuery(slug)
  return useMutation({
    // One at a time, so quick +1 clicks reach the server in order.
    scope: { id: slug },
    mutationFn: async (edit: Edit) => {
      const characterId = queryClient.getQueryData(queryKey)?.id ?? ''
      const data = { characterId, ...edit }
      const result =
        'itemId' in data
          ? await setItemCount({ data })
          : 'logId' in data
            ? await setKillCount({ data })
            : await setTaskDone({ data })
      if (!result.ok) throw new Error('Not saved')
    },
    onMutate: (edit) => {
      const c = queryClient.getQueryData(queryKey)
      if (!c) return
      const undo: Edit =
        'itemId' in edit
          ? { ...edit, count: c.items[edit.itemId] ?? 0 }
          : 'logId' in edit
            ? { ...edit, value: c.kills[`${edit.logId}:${edit.kind}`] ?? 0 }
            : { ...edit, done: !edit.done }
      queryClient.setQueryData(queryKey, apply(c, edit))
      return { undo }
    },
    onError: (_error, _edit, context) => {
      const c = queryClient.getQueryData(queryKey)
      if (c && context) queryClient.setQueryData(queryKey, apply(c, context.undo))
    },
  })
}
