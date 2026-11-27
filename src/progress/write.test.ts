import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { catalogue } from '#/catalogue/index.ts'
import type { Db } from '#/db/client.ts'
import {
  character,
  group,
  groupCharacter,
  groupLeader,
  itemProgress,
  pendingEdit,
  taskPart,
  taskProgress,
} from '#/db/schema.ts'
import { addUser, testDb } from '#/db/test-db.ts'
import { loadWaiting, resolveWaiting, writeEdit } from './write.ts'

let db: Db
let dispose: () => Promise<void>
beforeAll(async () => ({ db, dispose } = await testDb()))
afterAll(() => dispose())

const itemId = catalogue.items[0].id
const taskId = catalogue.tasks[0].id

/** A group led by a new account, tracking a new character owned by `owner` (unclaimed when null). */
async function setup(owner: string | null) {
  const leader = await addUser(db)
  const name = crypto.randomUUID().slice(0, 12)
  const [c] = await db.insert(character).values({ userId: owner, name, nameKey: name }).returning()
  const [g] = await db.insert(group).values({ name, nameKey: name }).returning()
  await db.insert(groupLeader).values({ groupId: g.id, userId: leader })
  await db.insert(groupCharacter).values({ groupId: g.id, characterId: c.id })
  return { leader, characterId: c.id, groupName: g.name }
}

const items = (characterId: string) => db.select().from(itemProgress).where(eq(itemProgress.characterId, characterId))
const tasks = (characterId: string) => db.select().from(taskProgress).where(eq(taskProgress.characterId, characterId))

describe('writeEdit', () => {
  it("saves the owner's edits", async () => {
    const owner = await addUser(db)
    const { characterId } = await setup(owner)

    expect(await writeEdit(db, owner, characterId, { itemId, count: 2 })).toBe('saved')

    expect(await items(characterId)).toMatchObject([{ itemId, count: 2 }])
  })

  it("saves a leader's edits to an unclaimed character", async () => {
    const { leader, characterId } = await setup(null)

    expect(await writeEdit(db, leader, characterId, { taskId, done: true })).toBe('saved')

    expect(await tasks(characterId)).toMatchObject([{ taskId }])
  })

  it("holds a leader's edit to a claimed character until its player confirms it", async () => {
    const owner = await addUser(db)
    const { leader, characterId, groupName } = await setup(owner)

    expect(await writeEdit(db, leader, characterId, { itemId, count: 1 })).toBe('waiting')
    expect(await items(characterId)).toEqual([])
    expect(await loadWaiting(db, characterId)).toEqual([
      { target: `item:${itemId}`, edit: { itemId, count: 1 }, group: groupName },
    ])

    expect(await resolveWaiting(db, leader, characterId, true)).toBe(false)
    expect(await resolveWaiting(db, owner, characterId, true)).toBe(true)

    expect(await items(characterId)).toMatchObject([{ itemId, count: 1 }])
    expect(await loadWaiting(db, characterId)).toEqual([])
  })

  it("holds a leader's part tick for the player, and refuses a part the achievement does not have", async () => {
    const owner = await addUser(db)
    const { leader, characterId } = await setup(owner)
    const tick = { taskId: '3863', part: 'Scopulus', done: true }

    expect(await writeEdit(db, leader, characterId, tick)).toBe('waiting')
    expect(await writeEdit(db, leader, characterId, { ...tick, part: 'Scopulu' })).toBe('refused')
    await resolveWaiting(db, owner, characterId, true)

    expect(await db.select().from(taskPart).where(eq(taskPart.characterId, characterId))).toMatchObject([
      { taskId: '3863', part: 'Scopulus' },
    ])
  })

  it('drops a waiting edit when the leader puts the value back', async () => {
    const { leader, characterId } = await setup(await addUser(db))
    await writeEdit(db, leader, characterId, { taskId, done: true })

    expect(await writeEdit(db, leader, characterId, { taskId, done: false })).toBe('waiting')

    expect(await loadWaiting(db, characterId)).toEqual([])
  })

  it('removes denied edits without saving them', async () => {
    const owner = await addUser(db)
    const { leader, characterId } = await setup(owner)
    await writeEdit(db, leader, characterId, { itemId, count: 1 })
    await writeEdit(db, leader, characterId, { taskId, done: true })

    expect(await resolveWaiting(db, owner, characterId, false, [`task:${taskId}`])).toBe(true)
    expect((await loadWaiting(db, characterId)).map((w) => w.target)).toEqual([`item:${itemId}`])
    await resolveWaiting(db, owner, characterId, false)

    expect(await loadWaiting(db, characterId)).toEqual([])
    expect(await tasks(characterId)).toEqual([])
    expect(await items(characterId)).toEqual([])
  })

  it("lets the owner's own edit replace a waiting one", async () => {
    const owner = await addUser(db)
    const { leader, characterId } = await setup(owner)
    await writeEdit(db, leader, characterId, { itemId, count: 3 })

    await writeEdit(db, owner, characterId, { itemId, count: 1 })

    expect(await items(characterId)).toMatchObject([{ count: 1 }])
    expect(await db.$count(pendingEdit, eq(pendingEdit.characterId, characterId))).toBe(0)
  })

  it('refuses everyone else, including leaders of groups that do not track the character', async () => {
    const { characterId } = await setup(null)
    const other = await setup(null)

    expect(await writeEdit(db, undefined, characterId, { itemId, count: 1 })).toBe('refused')
    expect(await writeEdit(db, await addUser(db), characterId, { itemId, count: 1 })).toBe('refused')
    expect(await writeEdit(db, other.leader, characterId, { itemId, count: 1 })).toBe('refused')
    expect(await items(characterId)).toEqual([])
  })
})
