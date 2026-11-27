import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, redirect } from '@tanstack/react-router'
import { type } from 'arktype'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { imageUrl } from '#/catalogue/images.ts'
import { catalogue } from '#/catalogue/index.ts'
import { BossPanel } from '#/components/BossPanel.tsx'
import { Header, HeaderButton } from '#/components/Header.tsx'
import { DownloadIcon, LinkIcon } from '#/components/icons.tsx'
import { Meter } from '#/components/Meter.tsx'
import { Search } from '#/components/Search.tsx'
import { downloadXlsx } from '#/export/xlsx.ts'
import { characterQuery, useEdit } from '#/progress/queries.ts'
import { type BossSummary, summarize } from '#/progress/summary.ts'

const ORDERS = ['log', 'closest', 'points'] as const
const isOrder = (v: string): v is (typeof ORDERS)[number] => ORDERS.some((o) => o === v)

const ProfileSearch = type({
  'boss?': 'string',
  /** Also list logs with nothing left. */
  'all?': 'boolean',
  'show?': "'drops' | 'tasks'",
  /** Row order; the game's combat achievement list when absent or unknown, such as an old link's value. */
  'sort?': type('string').pipe((v) => (isOrder(v) ? v : undefined)),
})

export const Route = createFileRoute('/$character')({
  validateSearch: ProfileSearch,
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(characterQuery(params.character))
    if (!c) throw notFound()
    if (c.slug !== params.character) throw redirect({ to: '/$character', params: { character: c.slug } })
    return { name: c.name }
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.name}, Insane Reaper` : 'Insane Reaper' }] }),
  component: Profile,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-extrabold text-2xl">No one has claimed that name yet</h1>
      <Link to="/start">Claim it</Link>
    </main>
  ),
})

const SHOW_OPTIONS = [
  { value: undefined, label: 'Drops and achievements' },
  { value: 'drops', label: 'Drops' },
  { value: 'tasks', label: 'Achievements' },
] as const

const SORT_OPTIONS = [
  { value: undefined, label: 'Achievements' },
  { value: 'log', label: 'Drop log' },
  { value: 'closest', label: 'Closest to done' },
  { value: 'points', label: 'Most points left' },
] as const

const COLUMNS = 'grid grid-cols-[44px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_84px] items-center gap-3.5'

const logOrder = new Map(catalogue.logs.map((log, i) => [log.id, i]))

/** Row orders other than the default, which keeps the catalogue's game achievement order. */
const sorts = {
  log: (a: BossSummary, b: BossSummary) => (logOrder.get(a.log.id) ?? 0) - (logOrder.get(b.log.id) ?? 0),
  closest: (a: BossSummary, b: BossSummary) => b.got / b.total - a.got / a.total || a.tasksLeft - b.tasksLeft,
  points: (a: BossSummary, b: BossSummary) => b.pointsLeft - a.pointsLeft,
}

function Profile() {
  const { character } = Route.useParams()
  const { boss, all = false, show, sort } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(characterQuery(character))
  const edit = useEdit(character)
  const progress = useMemo(() => ({ items: data?.items ?? {}, tasks: new Set(data?.tasks) }), [data])
  const summary = useMemo(() => summarize(catalogue, progress), [progress])

  useEffect(() => {
    if (boss) document.getElementById(`boss-${boss}`)?.scrollIntoView({ block: 'nearest' })
  }, [boss])

  if (!data) return null
  const left = (s: BossSummary) => (show === 'drops' ? !s.complete : show === 'tasks' ? s.tasksLeft > 0 : !s.done)
  const shown = summary.bosses.filter((s) => all || left(s) || s.boss.id === boss)
  const rows = sort ? shown.sort(sorts[sort]) : shown
  const dropsLeft = summary.drops.total - summary.drops.got
  const setSearch = (next: Partial<typeof ProfileSearch.infer>) =>
    navigate({ search: (s) => ({ ...s, ...next }), resetScroll: false, replace: true })

  return (
    <>
      <Header
        signedIn={data.signedIn}
        actions={
          <>
            <CopyLink slug={data.slug} />
            <HeaderButton onClick={() => downloadXlsx(catalogue, progress, data.name)}>
              <DownloadIcon />
              Export .xlsx
            </HeaderButton>
          </>
        }
      >
        <Search slug={data.slug} bosses={summary.bosses} progress={progress} />
      </Header>
      <main className="mx-auto flex max-w-[1240px] flex-col gap-5.5 px-4 py-6 sm:px-8">
        <section className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-bold text-[15px]">{data.name}</span>
            <span className="text-[13px] text-muted">Public profile, insanereaper.com/{data.slug}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <h1 className="m-0 font-extrabold text-[34px]">
              {summary.insaneReaper ? 'The Insane Reaper' : `${dropsLeft.toLocaleString()} drops to the Reaper`}
            </h1>
            <span className="text-muted">
              {summary.drops.got} of {summary.drops.total} drops, {summary.logsComplete} of {catalogue.logs.length} logs
            </span>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-1.5 text-[13px]">
            <span className="text-muted">Drops</span>
            <Meter got={summary.drops.got} total={summary.drops.total} kind="drops" height="h-2.5" />
            <span className="text-muted">Achievements</span>
            <Meter got={summary.tasksDone} total={catalogue.tasks.length} kind="tasks" height="h-2.5" />
          </div>
          <div className="mt-1 flex flex-wrap gap-8 text-muted">
            <span>
              <strong className="text-text">{summary.score.toLocaleString()}</strong> CombatScore of{' '}
              {summary.maxScore.toLocaleString()}
            </span>
            <span>
              <strong className="text-text">
                {summary.blessing ? `War's Blessing ${summary.blessing}` : "No War's Blessing yet"}
              </strong>
              {summary.toNextBlessing !== null && `, ${summary.toNextBlessing} points to ${summary.blessing + 1}`}
            </span>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4 border-line border-y py-1.5">
          <label className="flex min-h-11 items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={!all}
              className="size-[18px] accent-gold"
              onChange={(e) => setSearch({ all: e.target.checked ? undefined : true })}
            />
            Missing only
          </label>
          <label className="flex items-center gap-2 font-semibold">
            Show
            <select
              value={show ?? ''}
              className="rounded border border-line2 bg-surface px-2.5 py-2"
              onChange={(e) => setSearch({ show: SHOW_OPTIONS.find((o) => (o.value ?? '') === e.target.value)?.value })}
            >
              {SHOW_OPTIONS.map((o) => (
                <option key={o.label} value={o.value ?? ''}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 font-semibold">
            Order
            <select
              value={sort ?? ''}
              className="rounded border border-line2 bg-surface px-2.5 py-2"
              onChange={(e) => setSearch({ sort: SORT_OPTIONS.find((o) => (o.value ?? '') === e.target.value)?.value })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.label} value={o.value ?? ''}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="flex flex-col">
          <div className={`${COLUMNS} px-3 pb-2 text-muted text-xs`}>
            <span />
            <span>Boss</span>
            <span>Drops</span>
            <span>Achievements</span>
            <span className="text-right">Points left</span>
          </div>
          {rows.map((s) => {
            const open = s.boss.id === boss
            const line = (
              <Link
                key={s.boss.id}
                to="/$character"
                params={{ character: data.slug }}
                search={(prev) => ({ ...prev, boss: open ? undefined : s.boss.id })}
                resetScroll={false}
                replace
                aria-expanded={open}
                className={`${COLUMNS} px-3 py-1.5 text-text no-underline ${open ? 'py-2' : 'border-line border-t'}`}
              >
                <img src={imageUrl(s.boss)} alt="" className="size-11 object-contain" loading="lazy" />
                <span className={open ? 'font-extrabold text-base' : 'font-semibold'}>
                  {s.boss.name}
                  {s.boss.id !== s.log.id && (
                    <span className="block font-normal text-muted text-xs">{s.log.name} drops</span>
                  )}
                </span>
                <Meter got={s.got} total={s.total} kind="drops" />
                <Meter got={s.tasks.length - s.tasksLeft} total={s.tasks.length} kind="tasks" />
                <span className={`text-right tabular-nums ${open ? 'font-bold' : ''}`}>{s.pointsLeft}</span>
              </Link>
            )
            return open ? (
              <div key={s.boss.id} id={`boss-${s.boss.id}`} className="my-1.5 rounded border-2 border-gold-text">
                {line}
                <BossPanel
                  s={s}
                  progress={progress}
                  kills={data.kills}
                  parts={data.parts}
                  edit={data.owned ? edit.mutate : undefined}
                  show={show ?? 'all'}
                />
              </div>
            ) : (
              <Fragment key={s.boss.id}>{line}</Fragment>
            )
          })}
          {rows.length === 0 && (
            <p className="text-muted">Nothing left here. Turn off Missing only to see every log.</p>
          )}
        </section>
        <footer className="border-line border-t pt-3 text-muted text-xs">
          Boss, drop and achievement data from the{' '}
          <a href="https://runescape.wiki" target="_blank" rel="noreferrer">
            RuneScape Wiki
          </a>
          , CC BY-NC-SA 3.0. Game images are Jagex's. Not affiliated with Jagex.
        </footer>
      </main>
    </>
  )
}

/** Copies the public profile URL and says so for two seconds. */
function CopyLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <HeaderButton
      onClick={async () => {
        await navigator.clipboard.writeText(`${location.origin}/${slug}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      <LinkIcon />
      {copied ? 'Copied' : 'Copy profile link'}
    </HeaderButton>
  )
}
