import { type Task, TIERS, type Tier } from '#/catalogue/schema.ts'
import type { Progress } from './summary.ts'

/** One Combat Mastery tier as the game lists it. Counts include its mastery achievement; points don't. */
export type TierList = {
  tier: Tier
  /** "Combat Mastery - <previous tier>", which the game lists first in every tier after Easy and scores 0 points. */
  mastery: { name: string; done: boolean } | null
  /** In tierOrder. */
  tasks: Task[]
  done: number
  total: number
  points: number
  maxPoints: number
}

const orderKey = (name: string) =>
  name
    .replace(/^(The|A) /, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replaceAll('(', '~')

/** The in-game Combat Mastery list's order: alphabetical, ignoring a leading "The" or "A" and apostrophes, brackets after letters. */
export function tierOrder(a: { name: string }, b: { name: string }): number {
  const x = orderKey(a.name)
  const y = orderKey(b.name)
  return x < y ? -1 : x > y ? 1 : 0
}

/** Each tier with tasks, Easy to Grandmaster. */
export function tierLists(tasks: Task[], progress: Progress): TierList[] {
  const isDone = (t: Task) => progress.tasks.has(t.id)
  const inTier = (tier: Tier) => tasks.filter((t) => t.tier === tier)
  const sum = (list: Task[]) => list.reduce((n, t) => n + t.points, 0)
  return TIERS.flatMap((tier, i): TierList[] => {
    const list = inTier(tier).sort(tierOrder)
    if (list.length === 0) return []
    const before = i > 0 ? TIERS[i - 1] : undefined
    const mastery = before ? { name: `Combat Mastery - ${before}`, done: inTier(before).every(isDone) } : null
    const done = list.filter(isDone)
    return [
      {
        tier,
        mastery,
        tasks: list,
        done: done.length + (mastery?.done ? 1 : 0),
        total: list.length + (mastery ? 1 : 0),
        points: sum(done),
        maxPoints: sum(list),
      },
    ]
  })
}
