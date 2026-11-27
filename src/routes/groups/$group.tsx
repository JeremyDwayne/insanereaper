import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, redirect, useNavigate } from '@tanstack/react-router'
import { type } from 'arktype'
import { useMemo, useState } from 'react'
import { CharacterName } from '#/characters/name.ts'
import {
  BossGrid,
  type Member,
  type MenuItem,
  memberSorts,
  Roster,
  summarizeMembers,
} from '#/components/GroupViews.tsx'
import { CopyLink, Header } from '#/components/Header.tsx'
import { addCharacter, changeLeader, getGroup, removeCharacter, removeGroup } from '#/server/groups.ts'
import { list } from '#/text.ts'

const groupQuery = (slug: string) =>
  queryOptions({ queryKey: ['group', slug], queryFn: () => getGroup({ data: { slug } }) })

const GroupSearch = type({
  /** Mock C's bosses grid instead of the roster. */
  'view?': "'bosses'",
  'show?': "'unclaimed'",
  /** CombatScore when absent. */
  'sort?': "'drops' | 'name'",
  /** Grid cells count drops left instead of achievements left. */
  'left?': "'drops'",
})

export const Route = createFileRoute('/groups/$group')({
  validateSearch: GroupSearch,
  // Summing up 100 characters takes longer than a Worker's CPU budget, so the page itself renders in the browser.
  ssr: 'data-only',
  loader: async ({ context, params }) => {
    const g = await context.queryClient.ensureQueryData(groupQuery(params.group))
    if (!g) throw notFound()
    if (g.slug !== params.group) throw redirect({ to: '/groups/$group', params: { group: g.slug } })
    return { name: g.name }
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.name}, Insane Reaper` : 'Insane Reaper' }] }),
  component: GroupPage,
  notFoundComponent: NoGroup,
})

/** Shown for a name no group has, or a group deleted while its page was cached. */
function NoGroup() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-extrabold text-2xl">No group has that name</h1>
      <Link to="/account">Create one</Link>
    </main>
  )
}

const select = 'rounded border border-line2 bg-surface px-2.5 py-2'
const toggle = (on: boolean) =>
  `min-h-10 cursor-pointer rounded bg-surface px-3.5 text-text ${on ? 'border-2 border-gold-text font-extrabold' : 'border border-line2 font-semibold'}`

function GroupPage() {
  const { group: slug } = Route.useParams()
  const { view, show, sort, left } = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(groupQuery(slug))
  const members = useMemo(() => (data ? summarizeMembers(data) : []), [data])
  const [message, setMessage] = useState('')

  if (!data) return <NoGroup />
  const setSearch = (next: Partial<typeof GroupSearch.infer>) =>
    navigate({ search: (s) => ({ ...s, ...next }), resetScroll: false, replace: true })

  /** Runs a change, shows what it says back, and reloads the group and any cached profiles. */
  const run = async (change: () => Promise<string | undefined>) => {
    setMessage('')
    try {
      setMessage((await change()) ?? '')
    } catch {
      setMessage('That did not save. Try again.')
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: groupQuery(slug).queryKey }),
      queryClient.invalidateQueries({ queryKey: ['character'] }),
    ])
  }
  const groupId = data.id

  const menu = (m: Member): MenuItem[] => {
    const remove = {
      label: 'Remove from group',
      run: () => run(async () => void (await removeCharacter({ data: { groupId, characterId: m.id } }))),
    }
    if (!data.leads) return m.mine ? [remove] : []
    const lead = m.status === 'leader'
    return [
      ...(m.status === 'unclaimed'
        ? []
        : [
            {
              label: lead ? 'Remove as leader' : 'Make leader',
              run: () =>
                run(async () => {
                  const result = await changeLeader({ data: { groupId, lead: !lead, characterId: m.id } })
                  return result === 'last' ? 'A group needs a leader. Make someone else a leader first.' : undefined
                }),
            },
          ]),
      remove,
    ]
  }

  const shown = members.filter((m) => show !== 'unclaimed' || m.status === 'unclaimed')
  const rows = shown.sort(memberSorts[sort ?? 'score'])
  const unclaimed = members.filter((m) => m.status === 'unclaimed').length
  const reapers = members.filter((m) => m.summary.insaneReaper).length
  const leaders = data.leaders.map((n) => n ?? 'an account with no character')

  return (
    <>
      <Header signedIn={data.signedIn} actions={<CopyLink path={`/groups/${data.slug}`} label="Copy group link" />} />
      <main className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-6 sm:px-8">
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-bold text-[15px]">Group</span>
            <span className="text-[13px] text-muted">Public page, insanereaper.com/groups/{data.slug}</span>
          </div>
          <h1 className="m-0 font-extrabold text-[34px]">{data.name}</h1>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-muted">
            <span>
              <strong className="text-text">{members.length}</strong>{' '}
              {members.length === 1 ? 'character' : 'characters'}
              {unclaimed > 0 && `, ${unclaimed} not claimed yet`}
            </span>
            <span>
              <strong className="text-text">{reapers}</strong> {reapers === 1 ? 'Insane Reaper' : 'Insane Reapers'}
            </span>
            <span>
              {leaders.length === 1 ? 'Leader' : 'Leaders'} <strong className="text-text">{list(leaders)}</strong>
            </span>
            {data.leads && <LeaderActions groupId={groupId} name={data.name} slug={data.slug} run={run} />}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4 border-line border-y py-1.5">
          {data.leads && (
            <AddCharacter
              add={(name) =>
                run(async () => {
                  const result = await addCharacter({ data: { groupId, name } })
                  return result === 'full' ? `${data.name} already has 100 characters.` : undefined
                })
              }
            />
          )}
          <span className="flex-auto" />
          <fieldset className="m-0 flex gap-1.5 border-0 p-0">
            <legend className="sr-only">View</legend>
            <button
              type="button"
              aria-pressed={!view}
              className={toggle(!view)}
              onClick={() => setSearch({ view: undefined })}
            >
              Roster
            </button>
            <button
              type="button"
              aria-pressed={view === 'bosses'}
              className={toggle(view === 'bosses')}
              onClick={() => setSearch({ view: 'bosses' })}
            >
              Bosses
            </button>
          </fieldset>
          {view === 'bosses' && (
            <fieldset className="m-0 flex gap-1.5 border-0 p-0">
              <legend className="sr-only">Cells show</legend>
              <button
                type="button"
                aria-pressed={!left}
                className={toggle(!left)}
                onClick={() => setSearch({ left: undefined })}
              >
                Achievements left
              </button>
              <button
                type="button"
                aria-pressed={left === 'drops'}
                className={toggle(left === 'drops')}
                onClick={() => setSearch({ left: 'drops' })}
              >
                Drops left
              </button>
            </fieldset>
          )}
          <label className="flex items-center gap-2 font-semibold">
            Show
            <select
              value={show ?? ''}
              className={select}
              onChange={(e) => setSearch({ show: e.target.value ? 'unclaimed' : undefined })}
            >
              <option value="">Everyone</option>
              <option value="unclaimed">Not claimed yet</option>
            </select>
          </label>
          <label className="flex items-center gap-2 font-semibold">
            Order
            <select
              value={sort ?? ''}
              className={select}
              onChange={(e) =>
                setSearch({
                  sort: e.target.value === 'drops' || e.target.value === 'name' ? e.target.value : undefined,
                })
              }
            >
              <option value="">CombatScore</option>
              <option value="drops">Drops</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        {message && (
          <p role="status" className="m-0 font-semibold">
            {message}
          </p>
        )}

        {view === 'bosses' ? (
          <BossGrid members={rows} drops={left === 'drops'} />
        ) : (
          <Roster members={rows} menu={menu} />
        )}
        {rows.length === 0 && (
          <p className="m-0 text-muted">
            {members.length ? 'Everyone here has claimed their character.' : 'No characters yet.'}
          </p>
        )}
        <p className="m-0 text-[13px] text-muted">
          Names open the character's profile. Leaders tick drops and achievements there. Ticks on a claimed character
          count here at once and reach its profile when the player confirms them.
        </p>
      </main>
    </>
  )
}

/** The leaders' field for adding a character by RuneScape name. */
function AddCharacter({ add }: { add: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const invalid = name.trim() !== '' && CharacterName(name) instanceof type.errors
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (invalid) return
        await add(name)
        setName('')
      }}
    >
      <label htmlFor="add-name" className="font-semibold">
        Add a character
      </label>
      <input
        id="add-name"
        type="text"
        required
        placeholder="RuneScape name"
        maxLength={12}
        value={name}
        aria-invalid={invalid}
        aria-describedby={invalid ? 'add-name-error' : undefined}
        className="w-[180px] rounded border border-line2 bg-surface px-2.5 py-2"
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="submit"
        disabled={invalid}
        className="min-h-10 cursor-pointer rounded border-0 bg-gold px-4 font-bold text-on-gold disabled:opacity-60"
      >
        Add
      </button>
      {invalid && (
        <span id="add-name-error" className="text-muted">
          Up to 12 letters, numbers, spaces, hyphens or underscores.
        </span>
      )}
    </form>
  )
}

/** Stepping down and deleting the group, for leaders. Deleting asks once more. */
function LeaderActions({
  groupId,
  name,
  slug,
  run,
}: {
  groupId: string
  name: string
  slug: string
  run: (change: () => Promise<string | undefined>) => Promise<void>
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const button = 'min-h-9 cursor-pointer rounded border border-line2 bg-transparent px-3 font-semibold text-text'
  return (
    <span className="flex flex-wrap items-center gap-2 sm:ml-auto">
      {deleting ? (
        <>
          <span className="text-text">Delete {name}? Its characters and their progress stay.</span>
          <button
            type="button"
            className={button}
            onClick={async () => {
              if (!(await removeGroup({ data: { groupId } }))) return
              await navigate({ to: '/account' })
              // Going back must not show the deleted group from the cache, nor profiles still linking to it.
              queryClient.setQueryData(groupQuery(slug).queryKey, null)
              queryClient.invalidateQueries({ queryKey: ['character'] })
            }}
          >
            Delete group
          </button>
          <button type="button" className={button} onClick={() => setDeleting(false)}>
            Keep it
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={button}
            onClick={() =>
              run(async () => {
                const result = await changeLeader({ data: { groupId, lead: false } })
                return result === 'last' ? 'You are the only leader. Make someone else a leader first.' : undefined
              })
            }
          >
            Step down as leader
          </button>
          <button type="button" className={button} onClick={() => setDeleting(true)}>
            Delete group
          </button>
        </>
      )}
    </span>
  )
}
