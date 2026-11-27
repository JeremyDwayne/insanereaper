import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { type } from 'arktype'
import { useEffect, useState } from 'react'
import { authClient } from '#/auth/client.ts'
import { nameSlug } from '#/characters/name.ts'
import { Header } from '#/components/Header.tsx'
import { CheckIcon, InfoIcon } from '#/components/icons.tsx'
import { GroupName } from '#/groups/name.ts'
import { getMe } from '#/server/characters.ts'
import { checkGroupName, newGroup } from '#/server/groups.ts'
import { counted, list } from '#/text.ts'

export const Route = createFileRoute('/account')({
  loader: async () => {
    const me = await getMe()
    if (!me) throw redirect({ to: '/start' })
    return me
  },
  head: () => ({ meta: [{ title: 'Account, Insane Reaper' }] }),
  component: Account,
})

function Account() {
  const me = Route.useLoaderData()
  const router = useRouter()
  const queryClient = useQueryClient()
  return (
    <>
      <Header signedIn />
      <main className="mx-auto flex max-w-[640px] flex-col gap-5 px-4 py-10 sm:px-8">
        <h1 className="m-0 font-extrabold text-[26px]">Account</h1>
        <p className="m-0 text-muted">Signed in as {me.email}</p>
        <section className="flex flex-col">
          <h2 className="mt-0 mb-2 font-bold text-base">Characters</h2>
          {me.characters.map((c) => (
            <Link
              key={c.id}
              to="/$character"
              params={{ character: c.slug }}
              className="border-line border-t py-2.5 font-semibold"
            >
              {c.name}
            </Link>
          ))}
          <Link to="/start" search={{ add: true }} className="border-line border-t pt-2.5 font-semibold">
            Add another character
          </Link>
        </section>
        <section className="flex flex-col">
          <h2 className="mt-0 mb-2 font-bold text-base">Groups</h2>
          {me.groups.map((g) => (
            <Link
              key={g.slug}
              to="/groups/$group"
              params={{ group: g.slug }}
              className="flex justify-between gap-3 border-line border-t py-2.5 font-semibold"
            >
              {g.name}
              <span className="font-normal text-muted">
                {g.leads ? 'Leader' : `${list(g.mine)} ${g.mine.length > 1 ? 'are' : 'is'} in it`},{' '}
                {counted(g.size, 'character')}
              </span>
            </Link>
          ))}
          <CreateGroup />
        </section>
        <button
          type="button"
          className="min-h-11 cursor-pointer self-start rounded border border-line2 bg-transparent px-4 font-semibold"
          onClick={async () => {
            await authClient.signOut()
            queryClient.clear()
            await router.navigate({ to: '/start' })
            router.invalidate()
          }}
        >
          Sign out
        </button>
      </main>
    </>
  )
}

/** Creates a group, checking the name as the user types, then opens its page. */
function CreateGroup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'available' | 'taken' | 'invalid'>('idle')

  useEffect(() => {
    if (!name.trim()) return setStatus('idle')
    if (GroupName(name) instanceof type.errors) return setStatus('invalid')
    const timer = setTimeout(
      async () => setStatus((await checkGroupName({ data: { name } })) ? 'available' : 'taken'),
      300,
    )
    return () => clearTimeout(timer)
  }, [name])

  return (
    <form
      className="flex flex-col gap-1.5 border-line border-t pt-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const result = await newGroup({ data: { name } })
        if (result.ok) navigate({ to: '/groups/$group', params: { group: result.slug } })
        else setStatus('taken')
      }}
    >
      <label htmlFor="new-group" className="font-semibold">
        Create a group
      </label>
      <span className="flex gap-2">
        <input
          id="new-group"
          type="text"
          required
          maxLength={32}
          value={name}
          className="flex-auto rounded border border-line2 bg-surface px-2.5 py-2"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={status !== 'available'}
          className="min-h-10 cursor-pointer rounded border-0 bg-gold px-4 font-bold text-on-gold disabled:opacity-60"
        >
          Create
        </button>
      </span>
      {status === 'available' && (
        <span className="flex items-center gap-2 font-semibold">
          <CheckIcon size={16} className="text-gold-text" />
          Available at insanereaper.com/groups/{nameSlug(name)}
        </span>
      )}
      {status === 'taken' && (
        <span className="flex items-center gap-2">
          <InfoIcon size={16} className="flex-none" />
          Another group has that name.
        </span>
      )}
      {status === 'invalid' && (
        <span className="flex items-center gap-2 text-muted">
          <InfoIcon size={16} className="flex-none text-text" />
          Up to 32 letters, numbers, spaces, hyphens or underscores.
        </span>
      )}
    </form>
  )
}
