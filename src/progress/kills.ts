import type { Catalogue } from '#/catalogue/schema.ts'

export const KILL_KINDS = ['normal', 'hard', 'enrage'] as const
export type KillKind = (typeof KILL_KINDS)[number]

export const KILL_LABELS: Record<KillKind, string> = {
  normal: 'Kills',
  hard: 'Hard mode kills',
  enrage: 'Highest enrage',
}

/**
 * The kill fields each boss offers: every boss has Kills, plus Hard mode kills or Highest enrage
 * when one of its achievements mentions a hard mode or an enrage.
 */
export function killKinds(catalogue: Catalogue): Map<string, KillKind[]> {
  const kinds = new Map(catalogue.bosses.map((boss) => [boss.id, new Set<KillKind>(['normal'])]))
  for (const task of catalogue.tasks) {
    const text = `${task.name} ${task.description}`
    if (/hard ?mode/i.test(text)) kinds.get(task.bossId)?.add('hard')
    if (/enrage/i.test(text)) kinds.get(task.bossId)?.add('enrage')
  }
  return new Map([...kinds].map(([id, set]) => [id, KILL_KINDS.filter((k) => set.has(k))]))
}

/** Drop chance per kill from a wiki rarity such as "1/85", "10/2,500" or "3 × 1/50". Null when not a fraction. */
export function dropRate(rarity: string): number | null {
  const m = rarity.replaceAll(',', '').match(/^(?:(\d+) × )?(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
  if (!m) return null
  const p = Number(m[2]) / Number(m[3])
  return 1 - (1 - p) ** Number(m[1] ?? 1)
}

/** Chance of at least one drop in `kills` kills, or null when the rarity has no rate. */
export function chanceByNow(rarity: string, kills: number): number | null {
  const p = dropRate(rarity)
  return p === null ? null : 1 - (1 - p) ** kills
}
