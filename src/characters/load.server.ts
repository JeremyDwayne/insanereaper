import { eq } from 'drizzle-orm'
import { db } from '#/db/client.ts'
import { character, itemProgress, killCount, taskProgress } from '#/db/schema.ts'
import { nameKey, nameSlug } from './name.ts'

/** A character and its progress by profile slug, or null. Read by the profile and its embed image. */
export async function loadCharacter(slug: string) {
  const [row] = await db
    .select()
    .from(character)
    .where(eq(character.nameKey, nameKey(slug)))
  if (!row) return null
  const [items, tasks, kills] = await Promise.all([
    db.select().from(itemProgress).where(eq(itemProgress.characterId, row.id)),
    db.select().from(taskProgress).where(eq(taskProgress.characterId, row.id)),
    db.select().from(killCount).where(eq(killCount.characterId, row.id)),
  ])
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    slug: nameSlug(row.name),
    items: Object.fromEntries(items.map((i) => [i.itemId, i.count])),
    tasks: tasks.map((t) => t.taskId),
    /** Keyed by `${bossId}:${kind}`. */
    kills: Object.fromEntries(kills.map((k) => [`${k.bossId}:${k.kind}`, k.value])),
  }
}
