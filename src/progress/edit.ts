import { type } from 'arktype'
import { KILL_KINDS } from './kills.ts'

/** One change to a character's progress: a drop count, an achievement or part tick, or a typed-in kill count. */
export const Edit = type({ itemId: 'string', count: '0 <= number.integer <= 65535' })
  .or({ taskId: 'string', part: 'string', done: 'boolean' })
  .or({ taskId: 'string', done: 'boolean' })
  .or({ bossId: 'string', kind: type.enumerated(...KILL_KINDS), value: '0 <= number.integer <= 100000000' })

export type Edit = typeof Edit.infer
