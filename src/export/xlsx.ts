import type { Row, Sheet } from 'write-excel-file/browser'
import type { Catalogue } from '#/catalogue/schema.ts'
import { type Progress, summarize } from '#/progress/summary.ts'

const bold = (value: string) => ({ value, fontWeight: 'bold' as const })
const header = (...labels: string[]): Row => labels.map(bold)

/** A character's progress as three sheets: Summary, Drops (one row per log entry) and Achievements in game order. */
export function workbook(catalogue: Catalogue, progress: Progress, name: string): Sheet<Blob>[] {
  const s = summarize(catalogue, progress)
  const items = new Map(catalogue.items.map((i) => [i.id, i]))
  const exported = new Date().toISOString().slice(0, 10)

  const summary: Row[] = [
    [bold('Character'), name],
    [bold('Exported'), exported],
    [bold('CombatScore'), s.score],
    [bold("War's Blessing"), s.blessing],
    [bold('Drops obtained'), s.drops.got],
    [bold('Drops total'), s.drops.total],
    [bold('Logs complete'), s.logsComplete],
    [bold('Logs total'), catalogue.logs.length],
    [bold('Achievements done'), s.tasksDone],
    [bold('Achievements total'), catalogue.tasks.length],
    [],
    header('Tier', 'Done', 'Total', 'Points left'),
    ...s.tiers.map((t): Row => [t.tier, t.done, t.total, t.pointsLeft]),
  ]

  const drops: Row[] = [
    header('Log', 'Item', 'Rarity', 'Pet', 'Count', 'Obtained'),
    ...catalogue.logs.flatMap((log) =>
      log.entries.map((e): Row => {
        const count = progress.items[e.itemId] ?? 0
        return [
          log.name,
          items.get(e.itemId)?.name,
          e.rarity,
          items.get(e.itemId)?.pet ? 'Yes' : 'No',
          count,
          count > 0 ? 'Yes' : 'No',
        ]
      }),
    ),
  ]

  const tasks: Row[] = [
    header('Boss', 'Achievement', 'Description', 'Tier', 'Points', 'Members', 'Done'),
    ...catalogue.bosses.flatMap((boss) =>
      catalogue.tasks
        .filter((t) => t.bossId === boss.id)
        .map(
          (t): Row => [
            boss.name,
            t.name,
            t.description,
            t.tier,
            t.points,
            t.members ? 'Yes' : 'No',
            progress.tasks.has(t.id) ? 'Yes' : 'No',
          ],
        ),
    ),
  ]

  return [
    { sheet: 'Summary', data: summary, columns: [{ width: 18 }, { width: 14 }, { width: 8 }, { width: 12 }] },
    { sheet: 'Drops', data: drops, stickyRowsCount: 1, columns: [{ width: 30 }, { width: 34 }, { width: 12 }] },
    { sheet: 'Achievements', data: tasks, stickyRowsCount: 1, columns: [{ width: 30 }, { width: 40 }, { width: 80 }] },
  ]
}

/** Builds the workbook and saves it. The spreadsheet library loads only when this runs. */
export async function downloadXlsx(catalogue: Catalogue, progress: Progress, name: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(workbook(catalogue, progress, name)).toFile(`${name} insanereaper.xlsx`)
}
