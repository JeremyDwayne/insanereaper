import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/** Browser auth client. Its session hook refetches when the tab regains focus. */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] })

/** BroadcastChannel a newly signed-in tab posts on, so the tab that asked for the link moves on too. */
export const SIGNED_IN = 'insanereaper-signed-in'
