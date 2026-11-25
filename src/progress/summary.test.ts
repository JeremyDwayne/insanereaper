import { describe, expect, it } from 'vitest'
import type { Catalogue, Task, Tier } from '#/catalogue/schema.ts'
import { type Progress, summarize } from './summary.ts'

const item = (id: string, pet = false) => ({ id, name: id, pet, wikiImage: '', image: '', aliases: [] })
const log = (id: string, itemIds: string[]) => ({
  id,
  name: id,
  title: id,
  page: id,
  wikiImage: '',
  image: '',
  aliases: [],
  entries: itemIds.map((itemId) => ({ itemId, rarity: '1/1' })),
})
const POINTS: Record<Tier, number> = { Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6 }
const task = (id: string, logId: string, tier: Tier): Task => ({
  id,
  name: id,
  description: '',
  subcategory: logId,
  logId,
  tier,
  points: POINTS[tier],
  members: true,
})

const catalogue: Catalogue = {
  items: [item('shard'), item('helm'), item('pet', true), item('bow')],
  logs: [log('kree', ['shard', 'helm']), log('kril', ['shard', 'pet']), log('nex', ['bow'])],
  tasks: [
    task('t1', 'kree', 'Easy'),
    task('t2', 'kree', 'Master'),
    task('t3', 'kril', 'Grandmaster'),
    task('t4', 'nex', 'Elite'),
  ],
}
const progress = (items: Record<string, number>, tasks: string[]): Progress => ({ items, tasks: new Set(tasks) })

describe('summarize', () => {
  it('scores done tasks and picks the blessing from points alone', () => {
    const big: Catalogue = {
      ...catalogue,
      tasks: Array.from({ length: 30 }, (_, i) => task(`g${i}`, 'nex', 'Grandmaster')),
    }
    const s = summarize(
      big,
      progress(
        {},
        Array.from({ length: 26 }, (_, i) => `g${i}`),
      ),
    )
    expect([s.score, s.blessing, s.toNextBlessing]).toEqual([156, 2, 514])
    expect(s.tiers).toEqual([{ tier: 'Grandmaster', done: 26, total: 30, pointsLeft: 24, complete: false }])
  })

  it('counts one drop in every log that lists it', () => {
    const s = summarize(catalogue, progress({ shard: 1, helm: 2, bow: 0 }, []))
    expect(s.logs.map((l) => [l.log.id, l.got, l.total, l.complete])).toEqual([
      ['kree', 2, 2, true],
      ['kril', 1, 2, false],
      ['nex', 0, 1, false],
    ])
    expect(s.drops).toEqual({ got: 2, total: 4 })
  })

  it('marks a log done only with every drop and task, and the Reaper with every log', () => {
    const almost = summarize(catalogue, progress({ shard: 1, helm: 1, pet: 1, bow: 1 }, ['t1']))
    expect(almost.logs.map((l) => [l.log.id, l.tasksLeft, l.pointsLeft, l.done])).toEqual([
      ['kree', 1, 5, false],
      ['kril', 1, 6, false],
      ['nex', 1, 4, false],
    ])
    expect([almost.logsComplete, almost.insaneReaper]).toEqual([3, true])
  })

  it('reports no next blessing at Blessing 4', () => {
    const tasks = Array.from({ length: 290 }, (_, i) => task(`m${i}`, 'nex', 'Master'))
    const s = summarize(
      { ...catalogue, tasks },
      progress(
        {},
        tasks.map((t) => t.id),
      ),
    )
    expect([s.score, s.blessing, s.toNextBlessing]).toEqual([1450, 4, null])
  })
})
