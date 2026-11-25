import { describe, expect, it } from 'vitest'
import { catalogue } from '#/catalogue/index.ts'
import { workbook } from './xlsx.ts'

describe('workbook', () => {
  it('has a row per log entry and per achievement, with totals matching the summary', () => {
    const task = catalogue.tasks[0]
    const [summary, drops, tasks] = workbook(
      catalogue,
      { items: { 'godsword-shard-1': 2 }, tasks: new Set([task.id]) },
      'Tester',
    )
    expect(summary.data).toContainEqual([{ value: 'CombatScore', fontWeight: 'bold' }, task.points])
    expect(drops.data).toHaveLength(catalogue.logs.reduce((n, l) => n + l.entries.length, 0) + 1)
    expect(tasks.data).toHaveLength(catalogue.tasks.length + 1)
    const shardRows = drops.data.filter((row) => row[1] === 'Godsword shard 1')
    expect(shardRows).toHaveLength(4)
    expect(shardRows.every((row) => row[4] === 2 && row[5] === 'Yes')).toBe(true)
  })
})
