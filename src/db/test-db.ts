import { readdirSync, readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/d1'
import { getPlatformProxy } from 'wrangler'
import type { Db } from './client.ts'
import * as schema from './schema.ts'

/** A fresh in-memory local D1 with every migration applied, for tests. Call `dispose` when done. */
export async function testDb() {
  const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ persist: false })
  for (const file of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const sql of readFileSync(`drizzle/${file}`, 'utf8').split('--> statement-breakpoint')) {
      if (sql.trim()) await env.DB.prepare(sql).run()
    }
  }
  const db: Db = drizzle(env.DB, { schema })
  return { db, dispose }
}

/** Adds an account and returns its id. */
export async function addUser(db: Db) {
  const id = crypto.randomUUID()
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` })
  return id
}
