import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff?inline'
import inter800 from '@fontsource/inter/files/inter-latin-800-normal.woff?inline'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
import satori, { init } from 'satori/standalone'
import yogaWasm from 'satori/yoga.wasm'
import { imageUrl } from '#/catalogue/images.ts'
import type { BossEmbed } from '#/progress/embed.ts'

const W = 1200
const H = 630
const ROW = 26
const PER_COLUMN = 19
const MAX_ICONS = 15
const C = {
  bg: '#111418',
  surface: '#1b1f25',
  raise: '#232830',
  line: '#2a3039',
  line2: '#5b6370',
  text: '#eef0f3',
  muted: '#aeb4be',
  gold: '#ffc940',
  ach: '#7cc4ff',
}

const fontData = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1] ?? ''), (c) => c.charCodeAt(0)).buffer
const fonts = [
  { name: 'Inter', data: fontData(inter400), weight: 400 as const },
  { name: 'Inter', data: fontData(inter800), weight: 800 as const },
]

let ready: Promise<unknown> | undefined

/** A boss link's embed image as PNG: art, counts and missing drops on the left, achievements left on the right. */
export async function bossImage(b: BossEmbed, name: string): Promise<Uint8Array<ArrayBuffer>> {
  ready ??= Promise.all([init(yogaWasm), initWasm(resvgWasm)])
  const icons = b.missing.length > MAX_ICONS ? b.missing.slice(0, MAX_ICONS - 1) : b.missing
  const [, art, ...iconData] = await Promise.all([
    ready,
    dataUri(imageUrl(b.boss)),
    ...icons.map((i) => dataUri(imageUrl(i))),
  ])
  const svg = await satori(<Card b={b} name={name} art={art} icons={iconData} />, { width: W, height: H, fonts })
  const resvg = new Resvg(svg)
  const image = resvg.render()
  const png = new Uint8Array(image.asPng())
  image.free()
  resvg.free()
  return png
}

/** A picture as a data URI for satori, or null when it can't be fetched so the image still renders. */
async function dataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    let binary = ''
    for (const byte of new Uint8Array(await res.arrayBuffer())) binary += String.fromCharCode(byte)
    return `data:${res.headers.get('content-type') ?? 'image/png'};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

type Group = { title: string; note: string; names: string[] }
type Row =
  | { kind: 'title'; title: string; note: string }
  | { kind: 'name'; name: string }
  | { kind: 'gap' }
  | { kind: 'more'; count: number }

/** Achievements left by tier; once none are left, the missing drops, so the list is never empty while work remains. */
function groups(b: BossEmbed): Group[] {
  if (b.tasksLeft > 0) {
    return b.tiers.map((t) => ({
      title: t.tier,
      note: `${t.tasks.length} left`,
      names: t.tasks.map((task) => task.name),
    }))
  }
  if (!b.missing.length) return []
  return [{ title: 'Drops missing', note: `${b.missing.length} of ${b.total}`, names: b.missing.map((i) => i.name) }]
}

/**
 * Groups as rows that fill columns top to bottom, cut to fit with a "more" row. A blank row parts groups inside a
 * column, and a group's title never ends one.
 */
function columnRows(list: Group[]): { rows: Row[]; columns: number } {
  const rows: Row[] = []
  for (const g of list) {
    if (rows.length % PER_COLUMN) rows.push({ kind: 'gap' })
    if (rows.length % PER_COLUMN === PER_COLUMN - 1) rows.push({ kind: 'gap' })
    rows.push({ kind: 'title', title: g.title, note: g.note })
    for (const name of g.names) rows.push({ kind: 'name', name })
  }
  const columns = rows.length <= 2 * PER_COLUMN ? 2 : 3
  const room = columns * PER_COLUMN
  if (rows.length <= room) return { rows, columns }
  const hidden = rows.slice(room - 1).filter((r) => r.kind === 'name').length
  return { rows: [...rows.slice(0, room - 1), { kind: 'more', count: hidden }], columns }
}

const nowrap = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const

function Card({ b, name, art, icons }: { b: BossEmbed; name: string; art: string | null; icons: (string | null)[] }) {
  const { rows, columns } = columnRows(groups(b))
  const width = (770 - 28 * (columns - 1)) / columns
  const doneTasks = b.tasks.length - b.tasksLeft
  return (
    <div style={{ width: W, height: H, display: 'flex', background: C.bg, color: C.text, fontFamily: 'Inter' }}>
      <div
        style={{
          width: 350,
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: C.surface,
          borderRight: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            height: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: C.raise,
            borderRadius: 4,
          }}
        >
          {art && <img src={art} alt="" width={280} height={142} style={{ objectFit: 'contain' }} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 19, color: C.muted }}>{name}</span>
          <span style={{ fontSize: b.boss.name.length > 14 ? 30 : 42, fontWeight: 800, lineHeight: 1.05 }}>
            {b.boss.name}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15 }}>
          {b.tasks.length > 0 && (
            <Meter label="Achievements" got={doneTasks} total={b.tasks.length} color={C.ach} segmented />
          )}
          <Meter label="Drops" got={b.got} total={b.total} color={C.gold} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>
            {b.missing.length ? 'Missing drops' : 'Every drop obtained'}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {icons.map((src, i) => (
              <Icon key={b.missing[i]?.id}>{src && <img src={src} alt="" width={36} height={36} />}</Icon>
            ))}
            {b.missing.length > icons.length && (
              <Icon>
                <span style={{ fontSize: 15, color: C.muted }}>+{b.missing.length - icons.length}</span>
              </Icon>
            )}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '34px 40px 30px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, height: 40 }}>
          <span style={{ fontSize: 30, fontWeight: 800 }}>
            {b.tasks.length === 0
              ? 'No combat achievements'
              : b.tasksLeft === 0
                ? `All ${b.tasks.length} achievements done`
                : `${b.tasksLeft} achievement${b.tasksLeft === 1 ? '' : 's'} left`}
          </span>
          {b.tasksLeft > 0 && <span style={{ fontSize: 19, color: C.muted }}>{b.pointsLeft} points</span>}
        </div>
        <div
          style={{
            height: PER_COLUMN * ROW,
            display: 'flex',
            flexDirection: 'column',
            flexWrap: 'wrap',
            columnGap: 28,
          }}
        >
          {rows.map((r, i) =>
            r.kind === 'title' ? (
              <div
                key={r.title}
                style={{
                  width,
                  height: ROW,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderBottom: `2px solid ${C.line2}`,
                }}
              >
                <span style={{ fontSize: 17, fontWeight: 800 }}>{r.title}</span>
                <span style={{ fontSize: 15, color: C.muted }}>{r.note}</span>
              </div>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are rebuilt for each render and never reorder.
              <div key={i} style={{ width, height: ROW, display: 'flex', alignItems: 'center' }}>
                <span style={{ ...nowrap, fontSize: 16, color: r.kind === 'more' ? C.muted : C.text }}>
                  {r.kind === 'name' ? r.name : r.kind === 'more' ? `and ${r.count} more` : ''}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

/** A progress bar like the site's: solid for drops, segmented for achievements. */
function Meter(props: { label: string; got: number; total: number; color: string; segmented?: boolean }) {
  const segments = props.segmented
    ? {
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 9px, ${C.surface} 9px, ${C.surface} 10px)`,
      }
    : {}
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 106, color: C.muted }}>{props.label}</span>
      <div style={{ flex: 1, height: 10, display: 'flex', background: C.line }}>
        <div
          style={{
            width: `${props.total ? (props.got / props.total) * 100 : 0}%`,
            height: 10,
            backgroundColor: props.color,
            ...segments,
          }}
        />
      </div>
      <span>
        {props.got}/{props.total}
      </span>
    </div>
  )
}

/** A missing drop's square with a dashed outline, as on the site's missing drop tiles. */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 50,
        height: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px dashed ${C.line2}`,
        borderRadius: 4,
        background: C.bg,
      }}
    >
      {children}
    </div>
  )
}
