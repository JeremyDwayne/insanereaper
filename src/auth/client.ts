import { magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/** Browser auth client. Its session hook refetches when the tab regains focus. */
export const authClient = createAuthClient({ plugins: [magicLinkClient()] })

/** BroadcastChannel the email link's tab posts on, so the tab that asked for the link moves on too. */
export const SIGNED_IN = 'insanereaper-signed-in'
