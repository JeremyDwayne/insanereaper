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
  /** Our image URL, empty until the image sync has run. */
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

/** One Combat Mastery achievement. `id` is the game's achievement id from the wiki row. */
const Task = type({
  id: 'string',
  name: 'string',
  description: 'string',
  subcategory: 'string',
  logId: 'string',
  tier: Tier,
  points: 'number.integer',
  members: 'boolean',
})

export const Catalogue = type({ logs: Log.array(), items: Item.array(), tasks: Task.array() })

export type Tier = typeof Tier.infer
export type Item = typeof Item.infer
export type Log = typeof Log.infer
export type Task = typeof Task.infer
export type Catalogue = typeof Catalogue.infer
