import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type } from 'arktype'
import { useState } from 'react'
import { authClient, SIGNED_IN } from '#/auth/client.ts'

/**
 * Where the email link lands. Signing in waits for a click that names the account, so a link
 * someone else sends cannot quietly sign this browser into their account.
 */
export const Route = createFileRoute('/signed-in')({
  // The router parses an all-digit code as a number, so turn it back into text.
  validateSearch: type({ 'email?': 'string', 'code?': type('string | number').pipe((v) => String(v)) }),
  head: () => ({ meta: [{ title: 'Sign in, Insane Reaper' }] }),
  component: SignedIn,
})

function SignedIn() {
  const { email = '', code = '' } = Route.useSearch()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const signIn = async () => {
    setBusy(true)
    const { error } = await authClient.signIn.emailOtp({ email, otp: code })
    if (error) return setFailed(true)
    const channel = new BroadcastChannel(SIGNED_IN)
    channel.postMessage('signed-in')
    channel.close()
    navigate({ to: '/start', search: { from: 'email' }, replace: true })
  }

  return (
    <main className="mx-auto flex max-w-[520px] flex-col gap-4 px-4 py-14">
      {failed ? (
        <p>
          This link has expired or was already used. <Link to="/start">Get a new code</Link>.
        </p>
      ) : (
        <>
          <h1 className="m-0 font-extrabold text-[26px]">Sign in as {email}?</h1>
          <p className="m-0 text-muted">Only continue if you asked for this email.</p>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 cursor-pointer rounded border-0 bg-gold font-bold text-on-gold disabled:opacity-60"
            onClick={signIn}
          >
            Sign in
          </button>
        </>
      )}
    </main>
  )
}
