import type { Edit } from './queries.ts'

const VORAGO_ROTATIONS = ['Ceiling Collapse', 'Scopulus', 'Vitalis', 'Green Bomb', 'Teamsplit', 'The End']

/**
 * Parts of Combat Mastery achievements that the game tracks across kills, by task id, in the game's order.
 * The wiki's achievement list has no parts, so they are kept here by hand. Saved ticks are keyed by part name.
 */
export const TASK_PARTS: Partial<Record<string, readonly string[]>> = {
  // The Mighty Maul, Maul or Nothing and Maul and Brawl: the Maul of Omens on each weekly rotation.
  '3863': VORAGO_ROTATIONS,
  '3873': VORAGO_ROTATIONS,
  '3874': VORAGO_ROTATIONS,
  // Brothers in More Arms: the brother left to last.
  '1392': ['Ahrim', 'Dharok', 'Guthan', 'Karil', 'Torag', 'Verac'],
  // Stand Your Ground.
  '1349': ['Legio Primus', 'Legio Secundus', 'Legio Tertius', 'Legio Quartus', 'Legio Quintus', 'Legio Sextus'],
}

/** The edits one part tick sends: the part, then the achievement when the tick leaves no part open. */
export function partEdits(taskId: string, part: string, done: boolean, ticked: readonly string[]): Edit[] {
  const edits: Edit[] = [{ taskId, part, done }]
  const parts = TASK_PARTS[taskId] ?? []
  if (done && parts.every((p) => p === part || ticked.includes(p))) edits.push({ taskId, done: true })
  return edits
}
