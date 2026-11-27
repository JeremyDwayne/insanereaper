import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '#/db/client.ts'
import {
  character,
  group,
  groupCharacter,
  groupLeader,
  itemProgress,
  killCount,
  pendingEdit,
  taskPart,
  taskProgress,
} from '#/db/schema.ts'
import { addUser, testDb } from '#/db/test-db.ts'
import { writeEdit } from '#/progress/write.ts'
import {
  addToGroup,
  claim,
  createGroup,
  deleteGroup,
  GROUP_LIMIT,
  loadGroup,
  nameStatus,
  removeFromGroup,
  setLeader,
} from './groups.ts'

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

const unique = () => crypto.randomUUID().slice(0, 8)

/** A new group led by a new account. */
async function newGroup() {
  const leader = await addUser(db)
  const name = `g ${unique()}`
  const id = (await createGroup(db, leader, name)) ?? ''
  return { leader, id, slug: name.replace(' ', '_') }
}

/** A claimed character with one drop, and its owner. */
async function claimed() {
  const owner = await addUser(db)
  const name = unique()
  const id = (await claim(db, owner, name, false)) ?? ''
  await db.insert(itemProgress).values({ characterId: id, itemId: 'seismic-wand', count: 1 })
  return { owner, id, name }
}

const roster = async (slug: string) => (await loadGroup(db, slug, undefined))?.characters ?? []

describe('createGroup', () => {
  it('makes the creator its leader and keeps names unique', async () => {
    const user = await addUser(db)
    const name = `Iron ${unique()}`

    const id = await createGroup(db, user, name)

    expect(
      await db
        .select()
        .from(groupLeader)
        .where(eq(groupLeader.groupId, id ?? '')),
    ).toEqual([{ groupId: id, userId: user }])
    const other = await addUser(db)
    expect(await createGroup(db, other, name.toUpperCase().replace(' ', '_'))).toBeNull()
    expect(await db.$count(groupLeader, eq(groupLeader.userId, other))).toBe(0)
  })
})

describe('addToGroup', () => {
  it('makes an unclaimed character for a new name', async () => {
    const g = await newGroup()
    const name = unique()

    expect(await addToGroup(db, g.leader, g.id, name)).toBe('added')

    expect(await roster(g.slug)).toMatchObject([{ name, status: 'unclaimed', items: '', tasks: '' }])
    const [row] = await db.select().from(character).where(eq(character.nameKey, name))
    expect(row.userId).toBeNull()
  })

  it('adds a claimed character with its progress, and only for leaders', async () => {
    const g = await newGroup()
    const c = await claimed()

    expect(await addToGroup(db, c.owner, g.id, c.name)).toBe('refused')
    expect(await addToGroup(db, g.leader, g.id, c.name)).toBe('added')

    expect(await roster(g.slug)).toMatchObject([{ id: c.id, status: 'claimed', items: 'seismic-wand' }])
  })

  it(`refuses a group's ${GROUP_LIMIT + 1}st character`, async () => {
    const g = await newGroup()
    const ids = Array.from({ length: GROUP_LIMIT }, () => crypto.randomUUID())
    await db.batch([
      db.insert(character).values({ id: ids[0], name: ids[0], nameKey: ids[0] }),
      ...ids.slice(1).map((id) => db.insert(character).values({ id, name: id, nameKey: id })),
      ...ids.map((characterId) => db.insert(groupCharacter).values({ groupId: g.id, characterId })),
    ])

    expect(await addToGroup(db, g.leader, g.id, unique())).toBe('full')
    expect(await roster(g.slug)).toHaveLength(GROUP_LIMIT)
  })
})

describe('removeFromGroup', () => {
  it("lets the owner leave a group, taking that group's waiting edits", async () => {
    const g = await newGroup()
    const other = await newGroup()
    const c = await claimed()
    await addToGroup(db, g.leader, g.id, c.name)
    await addToGroup(db, other.leader, other.id, c.name)
    await writeEdit(db, g.leader, c.id, { itemId: 'tectonic-energy', count: 1 })
    await writeEdit(db, other.leader, c.id, { itemId: 'seismic-singularity', count: 1 })

    expect(await removeFromGroup(db, await addUser(db), g.id, c.id)).toBe(false)
    expect(await removeFromGroup(db, c.owner, g.id, c.id)).toBe(true)

    expect(await roster(g.slug)).toEqual([])
    expect(
      (await db.select().from(pendingEdit).where(eq(pendingEdit.characterId, c.id))).map((w) => w.groupId),
    ).toEqual([other.id])
  })

  it('keeps the character and its progress, which come back when added again', async () => {
    const g = await newGroup()
    const c = await claimed()
    await addToGroup(db, g.leader, g.id, c.name)

    expect(await removeFromGroup(db, g.leader, g.id, c.id)).toBe(true)
    expect(await db.$count(character, eq(character.id, c.id))).toBe(1)
    await addToGroup(db, g.leader, g.id, c.name)

    expect(await roster(g.slug)).toMatchObject([{ id: c.id, items: 'seismic-wand' }])
  })
})

describe('setLeader', () => {
  it("makes a claimed character's account a leader, and never removes the last one", async () => {
    const g = await newGroup()
    const c = await claimed()
    const unclaimed = unique()
    await addToGroup(db, g.leader, g.id, c.name)
    await addToGroup(db, g.leader, g.id, unclaimed)
    const [row] = await roster(g.slug).then((r) => r.filter((m) => m.name === unclaimed))

    expect(await setLeader(db, c.owner, g.id, true, c.id)).toBe('refused')
    expect(await setLeader(db, g.leader, g.id, true, row.id)).toBe('refused')
    expect(await setLeader(db, g.leader, g.id, false)).toBe('last')
    expect(await setLeader(db, g.leader, g.id, true, c.id)).toBe('ok')

    expect((await loadGroup(db, g.slug, c.owner))?.leads).toBe(true)
    expect(await setLeader(db, c.owner, g.id, false)).toBe('ok')
    expect(await setLeader(db, g.leader, g.id, false)).toBe('last')
  })
})

describe('deleteGroup', () => {
  it('keeps its characters and their progress', async () => {
    const g = await newGroup()
    const c = await claimed()
    await addToGroup(db, g.leader, g.id, c.name)

    expect(await deleteGroup(db, c.owner, g.id)).toBe(false)
    expect(await deleteGroup(db, g.leader, g.id)).toBe(true)

    expect(await db.$count(group, eq(group.id, g.id))).toBe(0)
    expect(await db.$count(itemProgress, eq(itemProgress.characterId, c.id))).toBe(1)
  })
})
