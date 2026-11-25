import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { type } from 'arktype'
import { and, eq } from 'drizzle-orm'
import { currentUser } from '#/auth/user.server.ts'
import { itemsById, tasksById } from '#/catalogue/index.ts'
import { db } from '#/db/client.ts'
import { character, itemProgress, taskProgress } from '#/db/schema.ts'

/** True when the signed-in account owns the character; sets 403 otherwise. */
async function ownsCharacter(characterId: string): Promise<boolean> {
  const user = await currentUser()
  const [row] = await db.select({ userId: character.userId }).from(character).where(eq(character.id, characterId))
  if (user && row?.userId === user.id) return true
  setResponseStatus(403)
  return false
}

/** Sets a drop's count for an owned character. A count of 0 means not obtained. */
export const setItemCount = createServerFn({ method: 'POST' })
  .validator(type({ characterId: 'string', itemId: 'string', count: '0 <= number.integer <= 65535' }))
  .handler(async ({ data }) => {
    if (!itemsById.has(data.itemId) || !(await ownsCharacter(data.characterId))) return { ok: false }
    await db
      .insert(itemProgress)
      .values(data)
      .onConflictDoUpdate({ target: [itemProgress.characterId, itemProgress.itemId], set: { count: data.count } })
    return { ok: true }
  })

/** Marks a Combat Mastery task done or not done for an owned character. */
export const setTaskDone = createServerFn({ method: 'POST' })
  .validator(type({ characterId: 'string', taskId: 'string', done: 'boolean' }))
  .handler(async ({ data }) => {
    if (!tasksById.has(data.taskId) || !(await ownsCharacter(data.characterId))) return { ok: false }
    if (data.done) {
      await db.insert(taskProgress).values({ characterId: data.characterId, taskId: data.taskId }).onConflictDoNothing()
    } else {
      await db
        .delete(taskProgress)
        .where(and(eq(taskProgress.characterId, data.characterId), eq(taskProgress.taskId, data.taskId)))
    }
    return { ok: true }
  })
