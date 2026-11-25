import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { authClient } from '#/auth/client.ts'
import { Header } from '#/components/Header.tsx'
import { getMe } from '#/server/characters.ts'

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
