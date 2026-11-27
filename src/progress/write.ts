import { and, eq, inArray, sql } from 'drizzle-orm'
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
import { type Edit, editTarget, inCatalogue, type Tracked, unchanged, type Waiting } from './edit.ts'

/** Who may edit a character: its owner, or a leader of a group that tracks it. */
export type Role = 'owner' | 'leader' | null

/**
 * The account's role on a character, whether anyone has claimed it, and the group through which a leader edits
 * it. Null when there is no such character.
 */
export async function editorRole(db: Db, userId: string | undefined, characterId: string) {
  const led = db
    .select({ id: groupCharacter.groupId })
    .from(groupCharacter)
    .innerJoin(groupLeader, eq(groupLeader.groupId, groupCharacter.groupId))
    .where(and(eq(groupCharacter.characterId, characterId), eq(groupLeader.userId, userId ?? '')))
    .limit(1)
  const [row] = await db
    .select({ userId: character.userId, groupId: sql<string | null>`(${led})` })
    .from(character)
    .where(eq(character.id, characterId))
  if (!row) return null
  const role: Role = userId && row.userId === userId ? 'owner' : row.groupId ? 'leader' : null
  return { role, claimed: row.userId !== null, groupId: row.groupId }
}

/** The statement that writes an edit to a character's progress. */
function save(db: Db, characterId: string, edit: Edit) {
  if ('itemId' in edit) {
    return db
      .insert(itemProgress)
      .values({ characterId, itemId: edit.itemId, count: edit.count })
      .onConflictDoUpdate({ target: [itemProgress.characterId, itemProgress.itemId], set: { count: edit.count } })
  }
  if ('bossId' in edit) {
    return db
      .insert(killCount)
      .values({ characterId, bossId: edit.bossId, kind: edit.kind, value: edit.value })
      .onConflictDoUpdate({
        target: [killCount.characterId, killCount.bossId, killCount.kind],
        set: { value: edit.value },
      })
  }
  if ('part' in edit) {
    const { taskId, part } = edit
    if (edit.done) return db.insert(taskPart).values({ characterId, taskId, part }).onConflictDoNothing()
    return db
      .delete(taskPart)
      .where(and(eq(taskPart.characterId, characterId), eq(taskPart.taskId, taskId), eq(taskPart.part, part)))
  }
  if (edit.done) return db.insert(taskProgress).values({ characterId, taskId: edit.taskId }).onConflictDoNothing()
  return db
    .delete(taskProgress)
    .where(and(eq(taskProgress.characterId, characterId), eq(taskProgress.taskId, edit.taskId)))
}

/** The character's confirmed progress for just the thing an edit sets. */
async function confirmedFor(db: Db, characterId: string, edit: Edit): Promise<Tracked> {
  const tracked: Tracked = { items: {}, tasks: [], parts: {}, kills: {} }
  if ('itemId' in edit) {
    const [row] = await db
      .select({ count: itemProgress.count })
      .from(itemProgress)
      .where(and(eq(itemProgress.characterId, characterId), eq(itemProgress.itemId, edit.itemId)))
    if (row) tracked.items[edit.itemId] = row.count
  } else if ('bossId' in edit) {
    const [row] = await db
      .select({ value: killCount.value })
      .from(killCount)
      .where(
        and(eq(killCount.characterId, characterId), eq(killCount.bossId, edit.bossId), eq(killCount.kind, edit.kind)),
      )
    if (row) tracked.kills[`${edit.bossId}:${edit.kind}`] = row.value
  } else if ('part' in edit) {
    const done = await db.$count(
      taskPart,
      and(eq(taskPart.characterId, characterId), eq(taskPart.taskId, edit.taskId), eq(taskPart.part, edit.part)),
    )
    if (done) tracked.parts[edit.taskId] = [edit.part]
  } else {
    const done = await db.$count(
      taskProgress,
      and(eq(taskProgress.characterId, characterId), eq(taskProgress.taskId, edit.taskId)),
    )
    if (done) tracked.tasks.push(edit.taskId)
  }
  return tracked
}

/**
 * Applies an edit for an account. The owner's edits, and a leader's edits to an unclaimed character, are saved.
 * A leader's edit to a claimed character waits for its player, unless it puts back the confirmed value, which
 * drops the waiting edit instead. Anyone else is refused.
 */
export async function writeEdit(
  db: Db,
  userId: string | undefined,
  characterId: string,
  edit: Edit,
): Promise<'saved' | 'waiting' | 'refused'> {
  const who = inCatalogue(edit) ? await editorRole(db, userId, characterId) : null
  if (!who?.role) return 'refused'
  const target = editTarget(edit)
  const drop = db
    .delete(pendingEdit)
    .where(and(eq(pendingEdit.characterId, characterId), eq(pendingEdit.target, target)))
  if (who.role === 'owner' || !who.claimed) {
    await db.batch([save(db, characterId, edit), drop])
    return 'saved'
  }
  if (unchanged(await confirmedFor(db, characterId, edit), edit)) await drop
  else {
    await db
      .insert(pendingEdit)
      .values({ characterId, target, edit, groupId: who.groupId ?? '' })
      .onConflictDoUpdate({
        target: [pendingEdit.characterId, pendingEdit.target],
        set: { edit, groupId: who.groupId ?? '', createdAt: new Date() },
      })
  }
  return 'waiting'
}

/** A character's waiting edits, oldest first, with the name of the group each came through. */
export async function loadWaiting(db: Db, characterId: string): Promise<Waiting[]> {
  return db
    .select({ target: pendingEdit.target, edit: pendingEdit.edit, group: group.name })
    .from(pendingEdit)
    .innerJoin(group, eq(group.id, pendingEdit.groupId))
    .where(eq(pendingEdit.characterId, characterId))
    .orderBy(pendingEdit.createdAt)
}

/**
 * Confirms or denies the owner's waiting edits: those with the given targets, or all when `targets` is absent.
 * Confirming saves them; both remove them from the waiting list. False when the account is not the owner.
 */
export async function resolveWaiting(
  db: Db,
  userId: string | undefined,
  characterId: string,
  confirm: boolean,
  targets?: string[],
): Promise<boolean> {
  if ((await editorRole(db, userId, characterId))?.role !== 'owner') return false
  const which = and(
    eq(pendingEdit.characterId, characterId),
    targets ? inArray(pendingEdit.target, targets) : undefined,
  )
  const edits = confirm ? await db.select({ edit: pendingEdit.edit }).from(pendingEdit).where(which) : []
  const saves = edits.filter((w) => inCatalogue(w.edit)).map((w) => save(db, characterId, w.edit))
  await db.batch([db.delete(pendingEdit).where(which), ...saves])
  return true
}
