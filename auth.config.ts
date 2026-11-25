// Used only by `pnpm auth:schema` to generate better-auth's tables into src/db/auth-schema.ts.
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { authOptions } from './src/auth/options.ts'

export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter({}, { provider: 'sqlite' }),
  plugins: [magicLink({ sendMagicLink: async () => {} })],
})
