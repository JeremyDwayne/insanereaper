import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '#/db/client.ts'
import { character, itemProgress, killCount, taskPart, taskProgress } from '#/db/schema.ts'
import { addUser, testDb } from '#/db/test-db.ts'
import { claim, nameStatus } from './groups.ts'

let db: Db
let dispose: () => Promise<void>
beforeAll(async () => ({ db, dispose } = await testDb()))
afterAll(() => dispose())

/** An unclaimed character with one drop, one achievement, one achievement part and one kill count recorded. */
async function tracked(name: string) {
  const [row] = await db.insert(character).values({ name, nameKey: name.toLowerCase() }).returning()
  await db.insert(itemProgress).values({ characterId: row.id, itemId: 'seismic-wand', count: 1 })
  await db.insert(taskProgress).values({ characterId: row.id, taskId: 'the-mighty-maul' })
  await db.insert(taskPart).values({ characterId: row.id, taskId: '3863', part: 'Scopulus' })
  await db.insert(killCount).values({ characterId: row.id, bossId: 'vorago', kind: 'normal', value: 40 })
  return row.id
}

describe('claim', () => {
  it('takes over a tracked name with what was recorded for it', async () => {
    const id = await tracked('ash vale')
    expect(await nameStatus(db, 'Ash Vale')).toEqual({
      available: true,
      recorded: { groups: [], drops: 1, tasks: 1, kills: 1 },
    })
    const user = await addUser(db)

    expect(await claim(db, user, 'Ash_Vale', false)).toBe(id)

    const [row] = await db.select().from(character).where(eq(character.id, id))
    expect(row).toMatchObject({ userId: user, name: 'Ash_Vale' })
    expect(await db.$count(itemProgress, eq(itemProgress.characterId, id))).toBe(1)
    expect(await db.$count(taskProgress, eq(taskProgress.characterId, id))).toBe(1)
    expect(await db.$count(taskPart, eq(taskPart.characterId, id))).toBe(1)
    expect(await db.$count(killCount, eq(killCount.characterId, id))).toBe(1)
  })

  it('clears what was recorded when claimed from scratch', async () => {
    const id = await tracked('dusk rider')

    expect(await claim(db, await addUser(db), 'Dusk Rider', true)).toBe(id)

    expect(await db.$count(itemProgress, eq(itemProgress.characterId, id))).toBe(0)
    expect(await db.$count(taskProgress, eq(taskProgress.characterId, id))).toBe(0)
    expect(await db.$count(taskPart, eq(taskPart.characterId, id))).toBe(0)
    expect(await db.$count(killCount, eq(killCount.characterId, id))).toBe(0)
  })

  it('refuses a name another account claimed and keeps its progress', async () => {
    const owner = await addUser(db)
    const id = await claim(db, owner, 'Kanzo', false)
    await db.insert(itemProgress).values({ characterId: id ?? '', itemId: 'seismic-wand', count: 2 })

    expect(await nameStatus(db, 'kanzo')).toEqual({ available: false })
    expect(await claim(db, await addUser(db), 'kanzo', true)).toBeNull()

    const [row] = await db.select().from(character).where(eq(character.nameKey, 'kanzo'))
    expect(row).toMatchObject({ userId: owner, name: 'Kanzo' })
    expect(await db.$count(itemProgress, eq(itemProgress.characterId, row.id))).toBe(1)
  })
})
