import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type } from 'arktype'
import { useEffect, useRef, useState } from 'react'
import { authClient, SIGNED_IN } from '#/auth/client.ts'

/** Where the email link lands: signs in with the code from the link, tells the tab that asked, then carries on here. */
export const Route = createFileRoute('/signed-in')({
  // The router parses an all-digit code as a number, so turn it back into text.
  validateSearch: type({ 'email?': 'string', 'code?': type('string | number').pipe((v) => String(v)) }),
  head: () => ({ meta: [{ title: 'Signing in, Insane Reaper' }] }),
  component: SignedIn,
})

function SignedIn() {
  const { email = '', code = '' } = Route.useSearch()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    // Each code allows few attempts, so try it once even when effects run twice in development.
    if (started.current) return
    started.current = true
    authClient.signIn.emailOtp({ email, otp: code }).then(({ error }) => {
      if (error) return setFailed(true)
      const channel = new BroadcastChannel(SIGNED_IN)
      channel.postMessage('signed-in')
      channel.close()
      navigate({ to: '/start', search: { from: 'email' }, replace: true })
    })
  }, [email, code, navigate])

  return (
    <main className="mx-auto max-w-[520px] px-4 py-14">
      {failed ? (
        <p>
          This link has expired or was already used. <Link to="/start">Get a new code</Link>.
        </p>
      ) : (
        <p className="text-muted">Signing you in.</p>
      )}
    </main>
  )
}
