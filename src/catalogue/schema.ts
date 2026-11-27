import { type } from 'arktype'

export const TIERS = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'] as const

const Tier = type.enumerated(...TIERS)

/** A drop that appears in one or more boss logs. `id` is a slug of the wiki name. */
const Item = type({
  id: 'string',
  name: 'string',
  pet: 'boolean',
  /** Wiki image path including its version query, used to skip unchanged images on sync. */
  wikiImage: 'string',
  /** R2 key named by content hash, empty until the image sync has run. */
  image: 'string',
  aliases: 'string[]',
})

const LogEntry = type({ itemId: 'string', rarity: 'string' })

/** One boss collection log. `id` is a slug of its heading on the wiki. */
const Log = type({
  id: 'string',
  name: 'string',
  title: 'string',
  page: 'string',
  wikiImage: 'string',
  image: 'string',
  aliases: 'string[]',
  entries: LogEntry.array(),
})

/**
 * A boss as the game's combat achievement list names it: one per achievement subcategory, plus logs
 * with no achievements. Bosses sharing a dungeon share its log. A log's only boss takes the log's id.
 */
const Boss = type({
  id: 'string',
  name: 'string',
  logId: 'string',
  page: 'string',
  wikiImage: 'string',
  image: 'string',
})

/** One Combat Mastery achievement, in the game's order. `id` is the game's achievement id from the wiki row. */
const Task = type({
  id: 'string',
  name: 'string',
  /** Wiki page the task list links its name to, empty when the wiki has none. */
  page: 'string',
  description: 'string',
  subcategory: 'string',
  bossId: 'string',
  logId: 'string',
  tier: Tier,
  points: 'number.integer',
  members: 'boolean',
})

/** `bosses` are in the game's combat achievement list order; `logs` in its drop log order. */
export const Catalogue = type({ logs: Log.array(), bosses: Boss.array(), items: Item.array(), tasks: Task.array() })

export type Tier = typeof Tier.infer
export type Item = typeof Item.infer
export type Log = typeof Log.infer
export type Boss = typeof Boss.infer
export type Task = typeof Task.infer
export type Catalogue = typeof Catalogue.infer
