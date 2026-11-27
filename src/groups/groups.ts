import { and, eq, gt, isNull } from 'drizzle-orm'
import { nameKey, nameSlug } from '#/characters/name.ts'
import type { Db } from '#/db/client.ts'
import { character, group, groupCharacter, itemProgress, killCount, taskPart, taskProgress } from '#/db/schema.ts'

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
