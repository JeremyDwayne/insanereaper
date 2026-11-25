import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db } from '#/db/client.ts'
import * as schema from '#/db/schema.ts'
import { sendSignInLink } from './email.ts'
import { authOptions, MAGIC_LINK_SECONDS } from './options.ts'

export const auth = betterAuth({
  ...authOptions,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  plugins: [
    magicLink({ expiresIn: MAGIC_LINK_SECONDS, sendMagicLink: ({ email, url }) => sendSignInLink(email, url) }),
    tanstackStartCookies(),
  ],
})
