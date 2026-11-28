import { describe, expect, it } from 'vitest'
import type { Task, Tier } from '#/catalogue/schema.ts'
import { tierLists, tierOrder } from './tiers.ts'

const POINTS: Record<Tier, number> = { Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6 }
const task = (id: string, tier: Tier): Task => ({
  id,
  name: id,
  page: '',
  description: '',
  subcategory: 'nex',
  bossId: 'nex',
  logId: 'nex',
  tier,
  points: POINTS[tier],
  members: true,
})

describe('tierOrder', () => {
  it('sorts like the in-game list: no leading "The" or "A", no apostrophes, brackets after letters', () => {
    const names = [
      'Beastmaster Durzag (duo)',
      "Can't Stop Me Meow IV",
      'The Ambassador Master Speed Killer',
      'Amascut, the Devourer (EM) (trio)',
      'A Song of Ice and Ire VII',
      'Canon Event',
      'Beastmaster Durzag Master Speed Killer',
      'Amascut, the Devourer (EM) Master Speed Killer',
      'All Together, Now!',
    ]
    expect(
      names
        .map((name) => ({ name }))
        .sort(tierOrder)
        .map((t) => t.name),
    ).toEqual([
      'All Together, Now!',
      'Amascut, the Devourer (EM) Master Speed Killer',
      'Amascut, the Devourer (EM) (trio)',
      'The Ambassador Master Speed Killer',
      'Beastmaster Durzag Master Speed Killer',
      'Beastmaster Durzag (duo)',
      'Canon Event',
      "Can't Stop Me Meow IV",
      'A Song of Ice and Ire VII',
    ])
  })
})

describe('tierLists', () => {
  it("opens each tier after Easy with the previous tier's mastery, counted but worth no points", () => {
    const tasks = [
      task('e1', 'Easy'),
      task('e2', 'Easy'),
      task('m1', 'Medium'),
      task('m2', 'Medium'),
      task('h1', 'Hard'),
    ]
    const lists = tierLists(tasks, { items: {}, tasks: new Set(['e1', 'e2', 'm1']) })
    expect(lists.map((l) => [l.tier, l.mastery, l.done, l.total, l.points, l.maxPoints])).toEqual([
      ['Easy', null, 2, 2, 2, 2],
      ['Medium', { name: 'Combat Mastery - Easy', done: true }, 2, 3, 2, 4],
      ['Hard', { name: 'Combat Mastery - Medium', done: false }, 0, 2, 0, 3],
    ])
  })
})
