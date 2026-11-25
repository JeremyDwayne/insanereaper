import { createServerFn } from '@tanstack/react-start'
import { type } from 'arktype'
import { eq } from 'drizzle-orm'
import { currentUser } from '#/auth/user.server.ts'
import { CharacterName, nameKey, nameSlug } from '#/characters/name.ts'
import { db } from '#/db/client.ts'
import { character, itemProgress, killCount, taskProgress } from '#/db/schema.ts'

/** The signed-in account and its characters, or null when signed out. */
export const getMe = createServerFn().handler(async () => {
  const user = await currentUser()
  if (!user) return null
  const characters = await db
    .select({ id: character.id, name: character.name })
    .from(character)
    .where(eq(character.userId, user.id))
  return { email: user.email, characters: characters.map((c) => ({ ...c, slug: nameSlug(c.name) })) }
})

export type ClaimResult = { ok: true; slug: string } | { ok: false; error: 'signed-out' | 'taken' }

/** Claims a character name for the signed-in account. Names are unique by nameKey. */
export const claimCharacter = createServerFn({ method: 'POST' })
  .validator(type({ name: CharacterName }))
  .handler(async ({ data }): Promise<ClaimResult> => {
    const user = await currentUser()
    if (!user) return { ok: false, error: 'signed-out' }
    const inserted = await db
      .insert(character)
      .values({ userId: user.id, name: data.name, nameKey: nameKey(data.name) })
      .onConflictDoNothing({ target: character.nameKey })
      .returning({ id: character.id })
    if (!inserted.length) return { ok: false, error: 'taken' }
    return { ok: true, slug: nameSlug(data.name) }
  })

/** True when no account has claimed a name with the same key. */
export const checkName = createServerFn()
  .validator(type({ name: CharacterName }))
  .handler(async ({ data }) => {
    const [row] = await db
      .select({ id: character.id })
      .from(character)
      .where(eq(character.nameKey, nameKey(data.name)))
    return !row
  })

/** A character's public profile and progress, by profile slug. `owned` is true for its account. */
export const getCharacter = createServerFn()
  .validator(type({ slug: 'string' }))
  .handler(async ({ data }) => {
    const [row] = await db
      .select()
      .from(character)
      .where(eq(character.nameKey, nameKey(data.slug)))
    if (!row) return null
    const [items, tasks, kills, user] = await Promise.all([
      db.select().from(itemProgress).where(eq(itemProgress.characterId, row.id)),
      db.select().from(taskProgress).where(eq(taskProgress.characterId, row.id)),
      db.select().from(killCount).where(eq(killCount.characterId, row.id)),
      currentUser(),
    ])
    return {
      id: row.id,
      name: row.name,
      slug: nameSlug(row.name),
      owned: user?.id === row.userId,
      signedIn: !!user,
      items: Object.fromEntries(items.map((i) => [i.itemId, i.count])),
      tasks: tasks.map((t) => t.taskId),
      /** Keyed by `${logId}:${kind}`. */
      kills: Object.fromEntries(kills.map((k) => [`${k.logId}:${k.kind}`, k.value])),
    }
  })
