import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { catalogue } from '#/catalogue/index.ts'
import { Header } from '#/components/Header.tsx'
import achievements from '#/landing/achievements.webp'
import boss from '#/landing/boss.webp'
import overview from '#/landing/overview.webp'
import search from '#/landing/search.webp'
import { getMe } from '#/server/characters.ts'

/** The achievement total for the landing copy, read on the server so the page does not download the catalogue. */
const getTaskCount = createServerFn().handler(() => catalogue.tasks.length)

/** Home is the landing page when signed out. Signed in, it sends you to your first character, or to claim one. */
export const Route = createFileRoute('/')({
  loader: async () => {
    const me = await getMe()
    if (!me) return { tasks: await getTaskCount() }
    const [first] = me.characters
    throw first ? redirect({ to: '/$character', params: { character: first.slug } }) : redirect({ to: '/start' })
  },
  head: () => ({ meta: [{ title: 'Insane Reaper, RS3 Combat Mastery and boss log tracker' }] }),
  component: Landing,
})

const button = 'inline-flex min-h-11 items-center rounded px-5 font-bold no-underline'
const primary = `${button} bg-gold text-on-gold`
const shot = 'h-auto w-full rounded border border-line2'

function Landing() {
  const { tasks } = Route.useLoaderData()
  return (
    <>
      <Header signedIn={false} />
      <main className="mx-auto max-w-[1160px] px-4 text-[15px] leading-normal sm:px-8">
        <section className="grid items-center gap-5 py-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 md:py-14">
          <div>
            <h1 className="text-balance font-extrabold text-[clamp(30px,4.2vw,46px)] leading-[1.1]">
              Track your Combat Mastery achievements and boss logs
            </h1>
            <p className="mt-4 mb-6 max-w-[46ch] text-[17px] text-muted">
              A free RuneScape 3 tracker for all {tasks} combat achievements and every boss drop on the way to The
              Insane Reaper. Tick what you have and see what is left.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/start" className={primary}>
                Start tracking
              </Link>
              <Link
                to="/$character"
                params={{ character: 'jeremydwayne' }}
                className={`${button} border border-line2 text-text`}
              >
                See an example profile
              </Link>
            </div>
          </div>
          <img
            src={overview}
            width={1600}
            height={1075}
            alt="A profile listing each boss with a drops bar and an achievements bar"
            className={shot}
          />
        </section>
        <Feature
          title="Every combat achievement, in the game's order"
          text="Bosses and achievements are listed in the same order as the in-game Combat Mastery list, so checking yours against the game is quick. Each boss shows its tiers and the points you have left. Your CombatScore and the points to your next War's Blessing sit at the top."
        >
          <img
            src={achievements}
            width={1600}
            height={983}
            alt="Arch-Glacor opened, showing 6 of 12 achievements done by tier with 33 points left"
            className={shot}
            loading="lazy"
          />
        </Feature>
        <Feature
          title="Open a boss to see which drops are missing"
          text="Missing drops come first with their drop rate. Add your kill count to see your chance of having each one by now."
        >
          <img
            src={boss}
            width={1600}
            height={914}
            alt="Nex opened, showing 8 missing drops at 48% by now and 13 obtained"
            className={shot}
            loading="lazy"
          />
        </Feature>
        <Feature
          title="Search by the names you use"
          text="AoD, zbow, corp. Search knows the nicknames and forgives typos, across bosses, drops and achievements."
        >
          <img
            src={search}
            width={976}
            height={500}
            alt="Searching aod finds Nex, Angel of Death"
            className={`${shot} max-w-[488px]`}
            loading="lazy"
          />
        </Feature>
        <Feature
          title="Share it or take it with you"
          text="Every profile has a public link at insanereaper.com/yourname that only you can edit. Export everything to a spreadsheet at any time."
        >
          <p className="max-w-[60ch] text-muted">
            Jagex has no API for boss logs or Combat Mastery, so you tick things off yourself. The list of bosses, drops
            and achievements comes from the RuneScape Wiki and is updated when a boss ships.
          </p>
        </Feature>
        <section className="flex flex-wrap items-center justify-between gap-5 border-line border-t pt-10">
          <h2 className="font-extrabold text-2xl">See what you have left.</h2>
          <Link to="/start" className={primary}>
            Start tracking
          </Link>
        </section>
        <footer className="mt-14 border-line border-t pt-4 pb-10 text-muted text-xs">
          Free and <a href="https://github.com/JeremyDwayne/insanereaper">open source</a>. Data from the{' '}
          <a href="https://runescape.wiki">RuneScape Wiki</a>, CC BY-NC-SA 3.0. Game images are Jagex's. Not affiliated
          with Jagex.
        </footer>
      </main>
    </>
  )
}

/** A landing row: a claim on the left, its screenshot or note on the right. */
function Feature({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="grid items-center gap-5 border-line border-t py-9 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-10">
      <div>
        <h2 className="text-balance font-extrabold text-2xl leading-tight">{title}</h2>
        <p className="mt-2.5 max-w-[44ch] text-muted">{text}</p>
      </div>
      {children}
    </section>
  )
}
