import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db } from '#/db/client.ts'
import * as schema from '#/db/schema.ts'
import { sendSignInEmail } from './email.ts'
import { authOptions, SIGN_IN_SECONDS } from './options.ts'

export const auth = betterAuth({
  ...authOptions,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  plugins: [
    emailOTP({
      expiresIn: SIGN_IN_SECONDS,
      storeOTP: 'hashed',
      sendVerificationOTP: ({ email, otp }) => sendSignInEmail(email, otp),
    }),
    tanstackStartCookies(),
  ],
})
