import { type Catalogue, type Log, type Task, TIERS, type Tier } from '#/catalogue/schema.ts'

/** A character's progress: drop counts by item id and the ids of done tasks. */
export type Progress = { items: Record<string, number>; tasks: ReadonlySet<string> }

/** CombatScore needed for War's Blessing 1 to 4. */
export const BLESSINGS = [25, 151, 670, 1450] as const

export type TierSummary = { tier: Tier; done: number; total: number; pointsLeft: number; complete: boolean }

export type LogSummary = {
  log: Log
  got: number
  total: number
  complete: boolean
  tasks: Task[]
  tasksLeft: number
  pointsLeft: number
  /** Nothing left to obtain or complete: hidden when the missing-only filter is on. */
  done: boolean
}

export type Summary = {
  score: number
  maxScore: number
  blessing: number
  /** Points still needed for the next blessing, or null at Blessing 4. */
  toNextBlessing: number | null
  tiers: TierSummary[]
  drops: { got: number; total: number }
  logs: LogSummary[]
  logsComplete: number
  insaneReaper: boolean
}

export const obtained = (progress: Progress, itemId: string) => (progress.items[itemId] ?? 0) > 0

/** Groups tasks by tier, Easy to Grandmaster, skipping tiers with no tasks. */
export function tierSummaries(tasks: Task[], progress: Progress): TierSummary[] {
  return TIERS.map((tier) => {
    const inTier = tasks.filter((t) => t.tier === tier)
    const left = inTier.filter((t) => !progress.tasks.has(t.id))
    const pointsLeft = left.reduce((sum, t) => sum + t.points, 0)
    return { tier, done: inTier.length - left.length, total: inTier.length, pointsLeft, complete: left.length === 0 }
  }).filter((t) => t.total > 0)
}

export function summarize(catalogue: Catalogue, progress: Progress): Summary {
  const score = catalogue.tasks.reduce((sum, t) => sum + (progress.tasks.has(t.id) ? t.points : 0), 0)
  const maxScore = catalogue.tasks.reduce((sum, t) => sum + t.points, 0)
  const blessing = BLESSINGS.filter((at) => score >= at).length
  const next = BLESSINGS[blessing]

  const logs = catalogue.logs.map((log): LogSummary => {
    const got = log.entries.filter((e) => obtained(progress, e.itemId)).length
    const tasks = catalogue.tasks.filter((t) => t.logId === log.id)
    const left = tasks.filter((t) => !progress.tasks.has(t.id))
    const complete = got === log.entries.length
    return {
      log,
      got,
      total: log.entries.length,
      complete,
      tasks,
      tasksLeft: left.length,
      pointsLeft: left.reduce((sum, t) => sum + t.points, 0),
      done: complete && left.length === 0,
    }
  })
  const logsComplete = logs.filter((l) => l.complete).length

  return {
    score,
    maxScore,
    blessing,
    toNextBlessing: next === undefined ? null : next - score,
    tiers: tierSummaries(catalogue.tasks, progress),
    drops: { got: catalogue.items.filter((i) => obtained(progress, i.id)).length, total: catalogue.items.length },
    logs,
    logsComplete,
    insaneReaper: logsComplete === logs.length,
  }
}
