// Copies a progress export into a character's progress, claimed or tracked by a group. Never lowers a drop count.
// Usage: pnpm import:progress <export.json> <character name> [--remote]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Catalogue } from '../src/catalogue/schema.ts'
import { nameKey } from '../src/characters/name.ts'
import { matchExport, ProgressExport } from '../src/progress/import.ts'

const [file, name, flag] = process.argv.slice(2)
if (!file || !name) throw new Error('Usage: pnpm import:progress <export.json> <character name> [--remote]')
const where = flag === '--remote' ? '--remote' : '--local'
const WRANGLER = new URL('../node_modules/.bin/wrangler', import.meta.url).pathname
const d1 = (...args: string[]) =>
  execFileSync(WRANGLER, ['d1', 'execute', 'insanereaper', where, ...args], { encoding: 'utf8' })

const catalogue = Catalogue.assert(
  JSON.parse(readFileSync(new URL('../src/catalogue/catalogue.json', import.meta.url), 'utf8')),
)
const match = matchExport(catalogue, ProgressExport.assert(JSON.parse(readFileSync(file, 'utf8'))))

const sql = (s: string) => `'${s.replaceAll("'", "''")}'`
const character = `(SELECT id FROM character WHERE name_key = ${sql(nameKey(name))})`
const [{ results }] = JSON.parse(d1('--json', '--command', `SELECT ${character} AS id`))
if (!results[0]?.id) throw new Error(`No character is named ${name} yet. Claim it or add it to a group first.`)

const statements = [
  ...Object.entries(match.items).map(
    ([itemId, count]) =>
      `INSERT INTO item_progress (character_id, item_id, count) VALUES (${character}, ${sql(itemId)}, ${count}) ON CONFLICT DO UPDATE SET count = max(count, excluded.count);`,
  ),
  ...match.tasks.map(
    (taskId) => `INSERT OR IGNORE INTO task_progress (character_id, task_id) VALUES (${character}, ${sql(taskId)});`,
  ),
]
const out = join(mkdtempSync(join(tmpdir(), 'insanereaper-')), 'import.sql')
writeFileSync(out, statements.join('\n'))
d1('--file', out)

const points = match.tasks.reduce((sum, id) => sum + (catalogue.tasks.find((t) => t.id === id)?.points ?? 0), 0)
console.log(
  `${name}: ${Object.keys(match.items).length} drops and ${match.tasks.length} achievements (${points} points) imported ${where}`,
)
if (match.unmatched.tasks.length) console.log(`Achievements not found: ${match.unmatched.tasks.join(', ')}`)
if (match.unmatched.drops.length) console.log(`Drops not found: ${match.unmatched.drops.join(', ')}`)
