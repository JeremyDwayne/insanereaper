import { type Catalogue, type Item, type Task, TIERS, type Tier } from '#/catalogue/schema.ts'
import { type BossSummary, obtained, type Progress, summarize } from './summary.ts'

/** What a shared profile link shows in a chat embed. `image` is a site path, present only on boss links. */
export type LinkPreview = { title: string; description: string; image?: string }

/** One boss's achievements left, by tier in game order, and its log's missing drops. */
export type BossEmbed = BossSummary & { tiers: { tier: Tier; tasks: Task[] }[]; missing: Item[] }

/** Chat apps cut longer descriptions; Discord shows about 350 characters. */
const DESCRIPTION_MAX = 300

export function bossEmbed(catalogue: Catalogue, progress: Progress, bossId: string): BossEmbed | undefined {
  const s = summarize(catalogue, progress).bosses.find((b) => b.boss.id === bossId)
  if (!s) return undefined
  const left = s.tasks.filter((t) => !progress.tasks.has(t.id))
  const items = new Map(catalogue.items.map((i) => [i.id, i]))
  return {
    ...s,
    tiers: TIERS.map((tier) => ({ tier, tasks: left.filter((t) => t.tier === tier) })).filter((t) => t.tasks.length),
    missing: s.log.entries.filter((e) => !obtained(progress, e.itemId)).flatMap((e) => items.get(e.itemId) ?? []),
  }
}

/** Title, text and image path for a profile link, or for one boss when `bossId` names one. */
export function linkPreview(
  catalogue: Catalogue,
  progress: Progress,
  character: { name: string; slug: string },
  bossId?: string,
): LinkPreview {
  const b = bossId ? bossEmbed(catalogue, progress, bossId) : undefined
  if (!b) {
    const s = summarize(catalogue, progress)
    const reaper = s.insaneReaper
      ? 'The Insane Reaper.'
      : `${(s.drops.total - s.drops.got).toLocaleString('en-US')} drops to the Reaper.`
    return {
      title: `${character.name}, Insane Reaper`,
      description: `${reaper} ${s.drops.got.toLocaleString('en-US')} of ${s.drops.total.toLocaleString('en-US')} drops, CombatScore ${s.score.toLocaleString('en-US')} of ${s.maxScore.toLocaleString('en-US')}.`,
    }
  }
  const tasks =
    b.tasks.length === 0
      ? ''
      : b.tasksLeft === 0
        ? `All ${b.tasks.length} achievements done. `
        : `${b.tasksLeft} of ${b.tasks.length} achievements left, ${b.pointsLeft} points. `
  const description =
    b.missing.length === 0
      ? `${tasks}All ${b.total} drops obtained.`
      : sentence(
          `${tasks}${b.missing.length} of ${b.total} drops missing: `,
          b.missing.map((i) => i.name),
        )
  const version = hash([...b.tiers.flatMap((t) => t.tasks.map((task) => task.id)), '|', ...b.missing.map((i) => i.id)])
  return {
    title: `${character.name} at ${b.boss.name}`,
    description,
    image: `/og/${character.slug}/${b.boss.id}?v=${version}`,
  }
}

/** `lead` and the names as a sentence, dropping names from the end into "and N more" until it fits. */
function sentence(lead: string, names: string[], max = DESCRIPTION_MAX): string {
  let text = `${lead}${names.join(', ')}.`
  for (let n = names.length - 1; text.length > max && n > 0; n--) {
    text = `${lead}${names.slice(0, n).join(', ')} and ${names.length - n} more.`
  }
  return text
}

/** FNV-1a of the joined ids in base 36: short, and changes when any id is added or removed. */
function hash(ids: string[]): string {
  let h = 0x811c9dc5
  for (const c of ids.join(',')) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
  return (h >>> 0).toString(36)
}
