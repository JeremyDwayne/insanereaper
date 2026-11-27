import { createServerFn } from '@tanstack/react-start'
import { type } from 'arktype'
import { eq } from 'drizzle-orm'
import { currentUser } from '#/auth/user.server.ts'
import { loadCharacter } from '#/characters/load.server.ts'
import { CharacterName, nameSlug } from '#/characters/name.ts'
import { db } from '#/db/client.ts'
import { character } from '#/db/schema.ts'
import { claim, nameStatus } from '#/groups/groups.ts'

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

/** Claims a character name for the signed-in account (see claim). `fresh` drops what groups recorded for it. */
export const claimCharacter = createServerFn({ method: 'POST' })
  .validator(type({ name: CharacterName, 'fresh?': 'boolean' }))
  .handler(async ({ data }): Promise<ClaimResult> => {
    const user = await currentUser()
    if (!user) return { ok: false, error: 'signed-out' }
    if (!(await claim(db, user.id, data.name, data.fresh ?? false))) return { ok: false, error: 'taken' }
    return { ok: true, slug: nameSlug(data.name) }
  })

/** Whether a name can be claimed, and what groups recorded for it (see nameStatus). */
export const checkName = createServerFn()
  .validator(type({ name: CharacterName }))
  .handler(({ data }) => nameStatus(db, data.name))

/** A character's public profile and progress, by profile slug. `owned` is true for its account. */
export const getCharacter = createServerFn()
  .validator(type({ slug: 'string' }))
  .handler(async ({ data }) => {
    const [c, user] = await Promise.all([loadCharacter(data.slug), currentUser()])
    if (!c) return null
    const { userId, ...profile } = c
    return { ...profile, owned: user?.id === userId, signedIn: !!user }
  })
