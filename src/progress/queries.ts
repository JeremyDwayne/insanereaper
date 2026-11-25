import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCharacter } from '#/server/characters.ts'
import { setItemCount, setTaskDone } from '#/server/progress.ts'

/** A character's profile and progress, fetched once per session and then edited in place. */
export const characterQuery = (slug: string) =>
  queryOptions({ queryKey: ['character', slug], queryFn: () => getCharacter({ data: { slug } }) })

export type CharacterData = NonNullable<Awaited<ReturnType<typeof getCharacter>>>

export type Edit = { itemId: string; count: number } | { taskId: string; done: boolean }

function apply(c: CharacterData, edit: Edit): CharacterData {
  if ('itemId' in edit) return { ...c, items: { ...c.items, [edit.itemId]: edit.count } }
  const tasks = c.tasks.filter((id) => id !== edit.taskId)
  return { ...c, tasks: edit.done ? [...tasks, edit.taskId] : tasks }
}

/** Saves a drop count or achievement tick. Shows it at once and reverts it if the server refuses. */
export function useEdit(slug: string) {
  const queryClient = useQueryClient()
  const { queryKey } = characterQuery(slug)
  return useMutation({
    mutationFn: async (edit: Edit) => {
      const characterId = queryClient.getQueryData(queryKey)?.id ?? ''
      const result =
        'itemId' in edit
          ? await setItemCount({ data: { characterId, ...edit } })
          : await setTaskDone({ data: { characterId, ...edit } })
      if (!result.ok) throw new Error('Not saved')
    },
    onMutate: (edit) => {
      const c = queryClient.getQueryData(queryKey)
      if (!c) return
      const undo: Edit =
        'itemId' in edit ? { itemId: edit.itemId, count: c.items[edit.itemId] ?? 0 } : { ...edit, done: !edit.done }
      queryClient.setQueryData(queryKey, apply(c, edit))
      return { undo }
    },
    onError: (_error, _edit, context) => {
      const c = queryClient.getQueryData(queryKey)
      if (c && context) queryClient.setQueryData(queryKey, apply(c, context.undo))
    },
  })
}
