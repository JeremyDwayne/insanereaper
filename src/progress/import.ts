import { type } from 'arktype'
import type { Catalogue } from '#/catalogue/schema.ts'

/** A progress export: achievements by name with a done flag, and drop counts by item name. Other fields are ignored. */
export const ProgressExport = type({
  combatAchievements: type({ name: 'string', completed: 'boolean' }).array(),
  drops: type({ id: 'string', count: 'number' }).array(),
})

export type ExportMatch = {
  items: Record<string, number>
  tasks: string[]
  unmatched: { tasks: string[]; drops: string[] }
}

/**
 * Matches an export to catalogue ids by name only. Drops also match wiki nicknames, which
 * cover items renamed since the export was made. Wording and points come from the catalogue.
 */
export function matchExport(catalogue: Catalogue, data: typeof ProgressExport.infer): ExportMatch {
  const key = (s: string) => s.trim().toLowerCase()
  const taskIds = new Map(catalogue.tasks.map((t) => [key(t.name), t.id]))
  const itemIds = new Map<string, string>()
  for (const item of catalogue.items) for (const alias of item.aliases) itemIds.set(key(alias), item.id)
  for (const item of catalogue.items) itemIds.set(key(item.name), item.id)

  const result: ExportMatch = { items: {}, tasks: [], unmatched: { tasks: [], drops: [] } }
  for (const task of data.combatAchievements.filter((t) => t.completed)) {
    const id = taskIds.get(key(task.name))
    if (id) result.tasks.push(id)
    else result.unmatched.tasks.push(task.name)
  }
  for (const drop of data.drops.filter((d) => d.count > 0)) {
    const id = itemIds.get(key(drop.id))
    if (id) result.items[id] = Math.max(result.items[id] ?? 0, drop.count)
    else result.unmatched.drops.push(drop.id)
  }
  return result
}
