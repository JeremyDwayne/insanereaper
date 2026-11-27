import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { nameKey, nameSlug } from '#/characters/name.ts'
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
import type { Waiting } from '#/progress/edit.ts'

/** The groups that track a character, by name. */
export async function trackingGroups(db: Db, characterId: string) {
  const rows = await db
    .select({ id: group.id, name: group.name })
    .from(groupCharacter)
    .innerJoin(group, eq(group.id, groupCharacter.groupId))
    .where(eq(groupCharacter.characterId, characterId))
    .orderBy(group.nameKey)
  return rows.map((g) => ({ ...g, slug: nameSlug(g.name) }))
}

/** What groups recorded for a character before anyone claimed it. */
export type Recorded = { groups: string[]; drops: number; tasks: number; kills: number }

/** Whether a name can be claimed. A name that groups track but nobody claimed is available with what they recorded. */
export async function nameStatus(
  db: Db,
  name: string,
): Promise<{ available: false } | { available: true; recorded: Recorded | null }> {
  const [row] = await db
    .select({ id: character.id, userId: character.userId })
    .from(character)
    .where(eq(character.nameKey, nameKey(name)))
  if (!row) return { available: true, recorded: null }
  if (row.userId) return { available: false }
  const [groups, drops, tasks, kills] = await Promise.all([
    trackingGroups(db, row.id),
    db.$count(itemProgress, and(eq(itemProgress.characterId, row.id), gt(itemProgress.count, 0))),
    db.$count(taskProgress, eq(taskProgress.characterId, row.id)),
    db.$count(killCount, and(eq(killCount.characterId, row.id), gt(killCount.value, 0))),
  ])
  return { available: true, recorded: { groups: groups.map((g) => g.name), drops, tasks, kills } }
}

/**
 * Claims a name for an account: a new character, or an unclaimed one that groups track, keeping what they
 * recorded unless `fresh`. Returns the character id, or null when another account has the name.
 */
export async function claim(db: Db, userId: string, name: string, fresh: boolean): Promise<string | null> {
  const [row] = await db
    .insert(character)
    .values({ userId, name, nameKey: nameKey(name) })
    .onConflictDoUpdate({ target: character.nameKey, set: { userId, name }, setWhere: isNull(character.userId) })
    .returning({ id: character.id })
  if (!row) return null
  if (fresh) {
    await db.batch([
      db.delete(itemProgress).where(eq(itemProgress.characterId, row.id)),
      db.delete(taskProgress).where(eq(taskProgress.characterId, row.id)),
      db.delete(taskPart).where(eq(taskPart.characterId, row.id)),
      db.delete(killCount).where(eq(killCount.characterId, row.id)),
    ])
  }
  return row.id
}

/** The most characters a group can track. */
export const GROUP_LIMIT = 100

/** True when the account leads the group. */
async function leads(db: Db, userId: string | undefined, groupId: string) {
  if (!userId) return false
  return (await db.$count(groupLeader, and(eq(groupLeader.groupId, groupId), eq(groupLeader.userId, userId)))) > 0
}

/** Creates a group led by the account. Returns its id, or null when another group has the name. */
export async function createGroup(db: Db, userId: string, name: string): Promise<string | null> {
  const id = crypto.randomUUID()
  const [created] = await db.batch([
    db
      .insert(group)
      .values({ id, name, nameKey: nameKey(name) })
      .onConflictDoNothing()
      .returning({ id: group.id }),
    // Selects nothing when the name was taken, so the account does not end up leading the other group.
    db.insert(groupLeader).select(
      db
        .select({ groupId: group.id, userId: sql<string>`${userId}`.as('user_id') })
        .from(group)
        .where(eq(group.id, id)),
    ),
  ])
  return created.length ? id : null
}

export type AddResult = 'added' | 'full' | 'refused'

/** Adds a character to a group by name, making an unclaimed one for a new name. Leaders only, up to GROUP_LIMIT. */
export async function addToGroup(
  db: Db,
  userId: string | undefined,
  groupId: string,
  name: string,
): Promise<AddResult> {
  if (!(await leads(db, userId, groupId))) return 'refused'
  if ((await db.$count(groupCharacter, eq(groupCharacter.groupId, groupId))) >= GROUP_LIMIT) return 'full'
  const key = nameKey(name)
  // The no-op update makes the insert return the id of a name that already has a character.
  const [row] = await db
    .insert(character)
    .values({ name, nameKey: key })
    .onConflictDoUpdate({ target: character.nameKey, set: { nameKey: key } })
    .returning({ id: character.id })
  await db.insert(groupCharacter).values({ groupId, characterId: row.id }).onConflictDoNothing()
  return 'added'
}

/**
 * Takes a character out of a group, with the waiting edits made through it. The character and its progress stay.
 * The group's leaders or the character's owner may.
 */
export async function removeFromGroup(
  db: Db,
  userId: string | undefined,
  groupId: string,
  characterId: string,
): Promise<boolean> {
  const owns =
    !!userId && (await db.$count(character, and(eq(character.id, characterId), eq(character.userId, userId)))) > 0
  if (!owns && !(await leads(db, userId, groupId))) return false
  await db
    .delete(groupCharacter)
    .where(and(eq(groupCharacter.groupId, groupId), eq(groupCharacter.characterId, characterId)))
  return true
}

export type LeaderResult = 'ok' | 'last' | 'refused'

/**
 * Makes the owner of a claimed character in the group a leader, or stops them leading. Without a character, the
 * account itself steps down. Leaders only, and the last leader cannot step down.
 */
export async function setLeader(
  db: Db,
  userId: string | undefined,
  groupId: string,
  lead: boolean,
  characterId?: string,
): Promise<LeaderResult> {
  if (!userId || !(await leads(db, userId, groupId))) return 'refused'
  let target = userId
  if (characterId) {
    const [row] = await db
      .select({ userId: character.userId })
      .from(groupCharacter)
      .innerJoin(character, eq(character.id, groupCharacter.characterId))
      .where(and(eq(groupCharacter.groupId, groupId), eq(groupCharacter.characterId, characterId)))
    if (!row?.userId) return 'refused'
    target = row.userId
  }
  if (lead) {
    await db.insert(groupLeader).values({ groupId, userId: target }).onConflictDoNothing()
    return 'ok'
  }
  const removed = await db
    .delete(groupLeader)
    .where(
      and(
        eq(groupLeader.groupId, groupId),
        eq(groupLeader.userId, target),
        sql`exists (select 1 from group_leader other where other.group_id = ${groupId} and other.user_id <> ${target})`,
      ),
    )
    .returning()
  return removed.length ? 'ok' : 'last'
}

/** Deletes a group. Its characters and their progress stay. Leaders only. */
export async function deleteGroup(db: Db, userId: string | undefined, groupId: string): Promise<boolean> {
  if (!(await leads(db, userId, groupId))) return false
  await db.delete(group).where(eq(group.id, groupId))
  return true
}

export type MemberStatus = 'leader' | 'claimed' | 'unclaimed'

/**
 * A group's page by slug: its characters with their obtained drop ids, done achievement ids and the group's waiting
 * edits, its leaders by a character name (null for an account with none), and whether the viewer leads it.
 */
export async function loadGroup(db: Db, slug: string, viewerId: string | undefined) {
  const [g] = await db
    .select({ id: group.id, name: group.name })
    .from(group)
    .where(eq(group.nameKey, nameKey(slug)))
  if (!g) return null
  const [members, waiting, leaderRows] = await Promise.all([
    db
      .select({
        id: character.id,
        name: character.name,
        userId: character.userId,
        // One JSON array per character keeps the response small for a 100-character group.
        items: sql<string>`(select json_group_array(item_id) from item_progress where character_id = "character"."id" and "count" > 0)`,
        tasks: sql<string>`(select json_group_array(task_id) from task_progress where character_id = "character"."id")`,
      })
      .from(groupCharacter)
      .innerJoin(character, eq(character.id, groupCharacter.characterId))
      .where(eq(groupCharacter.groupId, g.id))
      .orderBy(character.nameKey),
    db
      .select({ characterId: pendingEdit.characterId, target: pendingEdit.target, edit: pendingEdit.edit })
      .from(pendingEdit)
      .where(eq(pendingEdit.groupId, g.id))
      .orderBy(pendingEdit.createdAt),
    db
      .select({ userId: groupLeader.userId, name: character.name })
      .from(groupLeader)
      .leftJoin(character, eq(character.userId, groupLeader.userId))
      .where(eq(groupLeader.groupId, g.id))
      .orderBy(character.nameKey),
  ])
  const leaderIds = new Set(leaderRows.map((l) => l.userId))
  const inGroup = new Set(members.map((m) => m.name))
  const leaders = [...leaderIds].map((id) => {
    const names = leaderRows.filter((l) => l.userId === id).flatMap((l) => (l.name ? [l.name] : []))
    return names.find((n) => inGroup.has(n)) ?? names[0] ?? null
  })
  return {
    id: g.id,
    name: g.name,
    slug: nameSlug(g.name),
    leads: !!viewerId && leaderIds.has(viewerId),
    leaders,
    characters: members.map((m) => ({
      id: m.id,
      name: m.name,
      slug: nameSlug(m.name),
      status: (m.userId === null ? 'unclaimed' : leaderIds.has(m.userId) ? 'leader' : 'claimed') as MemberStatus,
      /** Owned by the viewer, who may take it out of the group. */
      mine: !!viewerId && m.userId === viewerId,
      items: JSON.parse(m.items) as string[],
      tasks: JSON.parse(m.tasks) as string[],
      waiting: waiting
        .filter((w) => w.characterId === m.id)
        .map((w): Waiting => ({ target: w.target, edit: w.edit, group: g.name })),
    })),
  }
}

/** The groups an account leads or has characters in, with its characters there and each group's size. */
export async function accountGroups(db: Db, userId: string) {
  const [led, member] = await Promise.all([
    db.select({ id: groupLeader.groupId }).from(groupLeader).where(eq(groupLeader.userId, userId)),
    db
      .select({ id: groupCharacter.groupId, name: character.name })
      .from(groupCharacter)
      .innerJoin(character, eq(character.id, groupCharacter.characterId))
      .where(eq(character.userId, userId)),
  ])
  const ids = [...new Set([...led, ...member].map((r) => r.id))]
  if (!ids.length) return []
  const groups = await db
    .select({
      id: group.id,
      name: group.name,
      size: sql<number>`(select count(*) from group_character where group_id = "group"."id")`,
    })
    .from(group)
    .where(inArray(group.id, ids))
    .orderBy(group.nameKey)
  return groups.map((g) => ({
    name: g.name,
    slug: nameSlug(g.name),
    size: g.size,
    leads: led.some((r) => r.id === g.id),
    mine: member.filter((r) => r.id === g.id).map((r) => r.name),
  }))
}
