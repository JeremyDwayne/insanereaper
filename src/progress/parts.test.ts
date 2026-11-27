import { describe, expect, it } from 'vitest'
import { tasksById } from '#/catalogue/index.ts'
import { partEdits, TASK_PARTS } from './parts.ts'

describe('TASK_PARTS', () => {
  it('names catalogue tasks, each part once', () => {
    for (const [taskId, parts = []] of Object.entries(TASK_PARTS)) {
      expect(tasksById.has(taskId), taskId).toBe(true)
      expect(new Set(parts).size, taskId).toBe(parts.length)
    }
  })
})

describe('partEdits', () => {
  const rotations = TASK_PARTS['3863'] ?? []

  it('ticks the achievement with its last open part', () => {
    expect(partEdits('3863', 'The End', true, rotations.slice(0, 5))).toEqual([
      { taskId: '3863', part: 'The End', done: true },
      { taskId: '3863', done: true },
    ])
  })

  it('sends only the part while others are open, or when unticking', () => {
    expect(partEdits('3863', 'Vitalis', true, ['Scopulus'])).toEqual([{ taskId: '3863', part: 'Vitalis', done: true }])
    expect(partEdits('3863', 'The End', false, rotations)).toEqual([{ taskId: '3863', part: 'The End', done: false }])
  })
})
