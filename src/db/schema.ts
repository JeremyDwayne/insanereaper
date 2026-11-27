import { sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { KILL_KINDS } from '../progress/kills.ts'
import { user } from './auth-schema.ts'

export * from './auth-schema.ts'

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`

/** A RuneScape character claimed by one account. `nameKey` makes names unique (see nameKey). */
export const character = sqliteTable('character', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(now).notNull(),
})

/** Drop counts by catalogue item id. A row with count 0 means not obtained. */
export const itemProgress = sqliteTable(
  'item_progress',
  {
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    count: integer('count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.itemId] })],
)

/** Done Combat Mastery tasks by catalogue task id. */
export const taskProgress = sqliteTable(
  'task_progress',
  {
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }).default(now).notNull(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.taskId] })],
)

/** Ticked parts of multi-part tasks, by catalogue task id and part name (see TASK_PARTS). */
export const taskPart = sqliteTable(
  'task_part',
  {
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull(),
    part: text('part').notNull(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.taskId, t.part] })],
)

/** Kill counts typed in by the player, per catalogue boss and kind (see KILL_KINDS). */
export const killCount = sqliteTable(
  'kill_count',
  {
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    bossId: text('boss_id').notNull(),
    kind: text('kind', { enum: KILL_KINDS }).notNull(),
    value: integer('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.bossId, t.kind] })],
)
