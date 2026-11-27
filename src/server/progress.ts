import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { type } from 'arktype'
import { currentUser } from '#/auth/user.server.ts'
import { db } from '#/db/client.ts'
import { Edit } from '#/progress/edit.ts'
import { resolveWaiting, writeEdit } from '#/progress/write.ts'

/** Saves a progress edit, or holds it for the player when a group leader edits a claimed character (see writeEdit). */
export const saveEdit = createServerFn({ method: 'POST' })
  .validator(type({ characterId: 'string', edit: Edit }))
  .handler(async ({ data }) => {
    const user = await currentUser()
    const result = await writeEdit(db, user?.id, data.characterId, data.edit)
    if (result === 'refused') setResponseStatus(403)
    return result
  })

/** Confirms or denies the owner's waiting edits, the listed targets or all of them (see resolveWaiting). */
export const resolveEdits = createServerFn({ method: 'POST' })
  .validator(type({ characterId: 'string', confirm: 'boolean', 'targets?': 'string[]' }))
  .handler(async ({ data }) => {
    const user = await currentUser()
    const ok = await resolveWaiting(db, user?.id, data.characterId, data.confirm, data.targets)
    if (!ok) setResponseStatus(403)
    return ok
  })
