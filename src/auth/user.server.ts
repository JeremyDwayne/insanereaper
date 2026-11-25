import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './server.ts'

/** The signed-in user for the current request, or null. */
export async function currentUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  return session?.user ?? null
}
