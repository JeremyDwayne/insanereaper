import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { type } from 'arktype'
import { eq } from 'drizzle-orm'
import { currentUser } from '#/auth/user.server.ts'
import { CharacterName, nameKey, nameSlug } from '#/characters/name.ts'
import { db } from '#/db/client.ts'
import { group } from '#/db/schema.ts'
import {
  type AddResult,
  addToGroup,
  createGroup,
  deleteGroup,
  type LeaderResult,
  loadGroup,
  removeFromGroup,
  setLeader,
} from '#/groups/groups.ts'
import { GroupName } from '#/groups/name.ts'

/** A group's page by slug (see loadGroup) and whether the viewer is signed in, or null. */
export const getGroup = createServerFn()
  .validator(type({ slug: 'string' }))
  .handler(async ({ data }) => {
    const user = await currentUser()
    const g = await loadGroup(db, data.slug, user?.id)
    return g && { ...g, signedIn: !!user }
  })

/** Whether no group has the name yet. */
export const checkGroupName = createServerFn()
  .validator(type({ name: GroupName }))
  .handler(async ({ data }) => (await db.$count(group, eq(group.nameKey, nameKey(data.name)))) === 0)

export type CreateResult = { ok: true; slug: string } | { ok: false; error: 'signed-out' | 'taken' }

/** Creates a group led by the signed-in account. */
export const newGroup = createServerFn({ method: 'POST' })
  .validator(type({ name: GroupName }))
  .handler(async ({ data }): Promise<CreateResult> => {
    const user = await currentUser()
    if (!user) return { ok: false, error: 'signed-out' }
    if (!(await createGroup(db, user.id, data.name))) return { ok: false, error: 'taken' }
    return { ok: true, slug: nameSlug(data.name) }
  })

/** Adds a character to a group by name (see addToGroup). */
export const addCharacter = createServerFn({ method: 'POST' })
  .validator(type({ groupId: 'string', name: CharacterName }))
  .handler(async ({ data }): Promise<AddResult> => {
    const result = await addToGroup(db, (await currentUser())?.id, data.groupId, data.name)
    if (result === 'refused') setResponseStatus(403)
    return result
  })

/** Takes a character out of a group (see removeFromGroup). */
export const removeCharacter = createServerFn({ method: 'POST' })
  .validator(type({ groupId: 'string', characterId: 'string' }))
  .handler(async ({ data }) => {
    const ok = await removeFromGroup(db, (await currentUser())?.id, data.groupId, data.characterId)
    if (!ok) setResponseStatus(403)
    return ok
  })

/** Makes a character's account a leader or stops it leading; without a character, steps down (see setLeader). */
export const changeLeader = createServerFn({ method: 'POST' })
  .validator(type({ groupId: 'string', lead: 'boolean', 'characterId?': 'string' }))
  .handler(async ({ data }): Promise<LeaderResult> => {
    const result = await setLeader(db, (await currentUser())?.id, data.groupId, data.lead, data.characterId)
    if (result === 'refused') setResponseStatus(403)
    return result
  })

/** Deletes a group (see deleteGroup). */
export const removeGroup = createServerFn({ method: 'POST' })
  .validator(type({ groupId: 'string' }))
  .handler(async ({ data }) => {
    const ok = await deleteGroup(db, (await currentUser())?.id, data.groupId)
    if (!ok) setResponseStatus(403)
    return ok
  })
