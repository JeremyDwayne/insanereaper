import { sql } from 'drizzle-orm'
import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Edit } from '../progress/edit.ts'
import { KILL_KINDS } from '../progress/kills.ts'
import { user } from './auth-schema.ts'

export * from './auth-schema.ts'

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`

/**
 * A RuneScape character. `userId` is the account that claimed it, or null while only groups track it.
 * `nameKey` makes names unique (see nameKey).
 */
export const character = sqliteTable('character', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
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

/** A clan or team that tracks characters. `nameKey` makes names unique, as for characters. */
export const group = sqliteTable('group', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(now).notNull(),
})

/** Accounts that lead a group: they add and remove its characters and edit their progress. */
export const groupLeader = sqliteTable(
  'group_leader',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => group.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index('group_leader_user_idx').on(t.userId)],
)

/** Characters a group tracks. */
export const groupCharacter = sqliteTable(
  'group_character',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => group.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => character.id, { onDelete: 'cascade' }),
    addedAt: integer('added_at', { mode: 'timestamp_ms' }).default(now).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.characterId] }),
    index('group_character_character_idx').on(t.characterId),
  ],
)

/**
 * A leader's edit to a claimed character, waiting for its player to confirm or deny it. `target` names what the
 * edit sets (see editTarget), so a later edit to the same thing replaces it. Goes when the group stops tracking
 * the character.
 */
export const pendingEdit = sqliteTable(
  'pending_edit',
  {
    characterId: text('character_id').notNull(),
    target: text('target').notNull(),
    edit: text('edit', { mode: 'json' }).$type<Edit>().notNull(),
    groupId: text('group_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(now).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.target] }),
    foreignKey({
      columns: [t.groupId, t.characterId],
      foreignColumns: [groupCharacter.groupId, groupCharacter.characterId],
    }).onDelete('cascade'),
  ],
)
