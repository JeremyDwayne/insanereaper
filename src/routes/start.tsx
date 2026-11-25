import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { type } from 'arktype'
import { useCallback, useEffect, useState } from 'react'
import { authClient, SIGNED_IN } from '#/auth/client.ts'
import { CharacterName } from '#/characters/name.ts'
import { Header } from '#/components/Header.tsx'
import { CheckIcon, InfoIcon, MailIcon } from '#/components/icons.tsx'
import { checkName, claimCharacter, getMe } from '#/server/characters.ts'

export const Route = createFileRoute('/start')({
  validateSearch: type({ 'from?': "'email'", 'add?': 'boolean' }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const me = await getMe()
    const [first] = me?.characters ?? []
    if (first && !deps.add) throw redirect({ to: '/$character', params: { character: first.slug } })
    return { signedIn: !!me }
  },
  head: () => ({ meta: [{ title: 'Sign in, Insane Reaper' }] }),
  component: Start,
})

const panel = 'mx-auto flex max-w-[520px] flex-col gap-4 rounded border bg-surface p-7'
const field = 'rounded border border-line2 bg-bg px-3 py-2.5'
const primary = 'min-h-11 cursor-pointer rounded border-0 bg-gold font-bold text-on-gold disabled:opacity-60'
const secondary = 'min-h-11 cursor-pointer rounded border border-line2 bg-transparent font-bold'

function Start() {
  const { signedIn } = Route.useLoaderData()
  const { from } = Route.useSearch()
  return (
    <>
      <Header signedIn={signedIn} />
      <main className="px-4 py-14 sm:px-8">
        {signedIn ? <ClaimForm fromEmail={from === 'email'} /> : <SignInForm />}
      </main>
    </>
  )
}

/**
 * Step 1. Emails a 6-digit code and a link. Typing the code here signs in this tab; opening the link
 * in the same browser signs it in too, and this tab moves on by itself.
 */
function SignInForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  // Profiles cached while signed out say the account owns nothing, so drop them before moving on.
  const signedIn = useCallback(() => {
    queryClient.clear()
    router.invalidate()
  }, [queryClient, router])

  useEffect(() => {
    if (!sent) return
    const channel = new BroadcastChannel(SIGNED_IN)
    channel.onmessage = signedIn
    return () => channel.close()
  }, [sent, signedIn])

  return (
    <div className={`${panel} border-line`}>
      <div className="font-semibold text-muted text-xs">Step 1 of 2</div>
      <h1 className="m-0 font-extrabold text-[26px]">Sign in</h1>
      <p className="m-0 text-muted">We email you a code and a link. No password.</p>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
          if (error)
            setError(
              error.status === 429
                ? 'Too many codes asked for. Try again in 10 minutes.'
                : 'That did not send. Try again.',
            )
          else setSent(email)
        }}
      >
        <label className="flex flex-col gap-1.5 font-semibold">
          Email
          <input type="email" required value={email} className={field} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" className={sent ? secondary : primary}>
          {sent ? 'Send a new code' : 'Email me a code'}
        </button>
      </form>
      {sent && (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            const { error } = await authClient.signIn.emailOtp({ email: sent, otp: code.trim() })
            if (error) setError('That code did not work. Check it, or send a new one.')
            else signedIn()
          }}
        >
          <p
            role="status"
            className="m-0 flex items-start gap-2.5 rounded border border-line2 border-dashed p-3 text-muted"
          >
            <MailIcon size={18} className="mt-px flex-none text-text" />
            <span>Check {sent}. Type the code here, or open the link in the email. Both expire in 15 minutes.</span>
          </p>
          <label className="flex flex-col gap-1.5 font-semibold">
            Code
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              className={`${field} font-bold text-xl tracking-[0.3em]`}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button type="submit" className={primary}>
            Sign in
          </button>
        </form>
      )}
      {error && <p className="m-0 font-semibold">{error}</p>}
    </div>
  )
}

/** Step 2. Claims a RuneScape name, checking it as the user types. */
function ClaimForm({ fromEmail }: { fromEmail: boolean }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'available' | 'taken' | 'invalid'>('idle')

  useEffect(() => {
    if (!name.trim()) return setStatus('idle')
    if (CharacterName(name) instanceof type.errors) return setStatus('invalid')
    const timer = setTimeout(async () => setStatus((await checkName({ data: { name } })) ? 'available' : 'taken'), 300)
    return () => clearTimeout(timer)
  }, [name])

  return (
    <form
      className={`${panel} border-2 border-gold-text`}
      onSubmit={async (e) => {
        e.preventDefault()
        const result = await claimCharacter({ data: { name } })
        if (result.ok) navigate({ to: '/$character', params: { character: result.slug } })
        else setStatus('taken')
      }}
    >
      {fromEmail && (
        <p className="m-0 flex items-center gap-2 font-semibold">
          <CheckIcon size={18} className="text-gold-text" />
          Signed in. If you started in another tab, it has moved on and you can close this one.
        </p>
      )}
      <div className="font-semibold text-muted text-xs">Step 2 of 2</div>
      <h1 className="m-0 font-extrabold text-[26px]">Add your character</h1>
      <p className="m-0 text-muted">
        Your RuneScape display name. Each name can be claimed by one account, and its profile is public at
        insanereaper.com/&lt;name&gt;.
      </p>
      <label className="flex flex-col gap-1.5 font-semibold">
        RuneScape name
        <input
          type="text"
          required
          maxLength={12}
          value={name}
          className={field}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {status === 'available' && (
        <p className="m-0 flex items-center gap-2 font-semibold">
          <CheckIcon size={18} className="text-gold-text" />
          Available
        </p>
      )}
      {status === 'invalid' && (
        <p className="m-0 flex items-center gap-2 text-muted">
          <InfoIcon size={18} className="flex-none text-text" />
          Up to 12 letters, numbers, spaces, hyphens or underscores.
        </p>
      )}
      {status === 'taken' && (
        <p className="m-0 flex items-start gap-2">
          <InfoIcon size={18} className="flex-none" />
          <span>
            <strong>Claimed by another account.</strong> If it is yours,{' '}
            <a
              href={`https://github.com/JeremyDwayne/insanereaper/issues/new?title=${encodeURIComponent(`Name claim: ${name}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              report it
            </a>
            .
          </span>
        </p>
      )}
      <button type="submit" disabled={status !== 'available'} className={primary}>
        Claim and start tracking
      </button>
    </form>
  )
}
