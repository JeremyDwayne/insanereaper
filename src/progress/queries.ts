import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCharacter } from '#/server/characters.ts'
import { resolveEdits, saveEdit } from '#/server/progress.ts'
import { applyEdit, applyWaiting, type Edit, editTarget, unchanged } from './edit.ts'

/** A character's profile and progress, fetched once per session and then edited in place. */
export const characterQuery = (slug: string) =>
  queryOptions({ queryKey: ['character', slug], queryFn: () => getCharacter({ data: { slug } }) })

export type CharacterData = NonNullable<Awaited<ReturnType<typeof getCharacter>>>

/** True when the viewer's edits wait for the player: a group leader looking at a claimed character. */
export const holdsEdits = (c: CharacterData) => c.role === 'leader' && c.claimed

/**
 * A character with an edit laid in as the server stores it: in the waiting list when held (see holdsEdits),
 * otherwise applied, replacing any waiting edit to the same thing.
 */
function stage(c: CharacterData, edit: Edit): CharacterData {
  const target = editTarget(edit)
  const waiting = c.waiting.filter((w) => w.target !== target)
  if (!holdsEdits(c)) return { ...applyEdit(c, edit), waiting }
  if (unchanged(c, edit)) return { ...c, waiting }
  return { ...c, waiting: [...waiting, { target, edit, group: c.ledGroup ?? '' }] }
}

/** Saves a drop count, achievement tick or kill count. Shows it at once and reloads the character if refused. */
export function useEdit(slug: string) {
  const queryClient = useQueryClient()
  const { queryKey } = characterQuery(slug)
  return useMutation({
    // One at a time, so quick +1 clicks reach the server in order.
    scope: { id: slug },
    mutationFn: async (edit: Edit) => {
      const characterId = queryClient.getQueryData(queryKey)?.id ?? ''
      if ((await saveEdit({ data: { characterId, edit } })) === 'refused') throw new Error('Not saved')
    },
    onMutate: (edit) => {
      const c = queryClient.getQueryData(queryKey)
      if (c) queryClient.setQueryData(queryKey, stage(c, edit))
    },
    onError: () => queryClient.invalidateQueries({ queryKey }),
  })
}

/** Confirms or denies the owner's waiting edits: those with the given targets, or all of them. */
export function useResolve(slug: string) {
  const queryClient = useQueryClient()
  const { queryKey } = characterQuery(slug)
  return useMutation({
    scope: { id: slug },
    mutationFn: async ({ confirm, targets }: { confirm: boolean; targets?: string[] }) => {
      const characterId = queryClient.getQueryData(queryKey)?.id ?? ''
      if (!(await resolveEdits({ data: { characterId, confirm, targets } }))) throw new Error('Not saved')
    },
    onSuccess: (_result, { confirm, targets }) => {
      const c = queryClient.getQueryData(queryKey)
      if (!c) return
      const picked = c.waiting.filter((w) => !targets || targets.includes(w.target))
      const rest = c.waiting.filter((w) => !picked.includes(w))
      const next: CharacterData = { ...(confirm ? applyWaiting(c, picked) : c), waiting: rest }
      queryClient.setQueryData(queryKey, next)
    },
    onError: () => queryClient.invalidateQueries({ queryKey }),
  })
}
