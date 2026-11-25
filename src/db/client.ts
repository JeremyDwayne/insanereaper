import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema.ts'

/** Drizzle over the Worker's D1 binding. Server code only. */
export const db = drizzle(env.DB, { schema })
