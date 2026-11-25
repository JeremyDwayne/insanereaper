import type { BetterAuthOptions } from 'better-auth'

/** Options shared by the app and the better-auth CLI, which generates the auth tables from them. */
export const authOptions = {
  appName: 'Insane Reaper',
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: { '/sign-in/magic-link': { window: 600, max: 5 } },
  },
  advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
} satisfies BetterAuthOptions

/** Sign-in links expire after 15 minutes. */
export const MAGIC_LINK_SECONDS = 15 * 60
