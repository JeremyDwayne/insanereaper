import type { BetterAuthOptions } from 'better-auth'

/** Options shared by the app and the better-auth CLI, which generates the auth tables from them. */
export const authOptions = {
  appName: 'Insane Reaper',
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/email-otp/send-verification-otp': { window: 600, max: 5 },
      '/sign-in/email-otp': { window: 600, max: 10 },
    },
  },
  // Sessions last 90 days and renew once a day while in use, so regular players stay signed in.
  session: { expiresIn: 90 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
} satisfies BetterAuthOptions

/** Sign-in codes and links expire after 15 minutes. */
export const SIGN_IN_SECONDS = 15 * 60
