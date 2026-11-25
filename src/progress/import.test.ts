import { describe, expect, it } from 'vitest'
import type { Catalogue } from '#/catalogue/schema.ts'
import { matchExport, ProgressExport } from './import.ts'

const catalogue: Catalogue = {
  logs: [],
  bosses: [],
  items: [
    { id: 'zaryte-bow', name: 'Zaryte bow', pet: false, wikiImage: '', image: '', aliases: ['Zbow'] },
    { id: 'omens-helm', name: 'Helm of omens', pet: false, wikiImage: '', image: '', aliases: ['Omens helm'] },
  ],
  tasks: [
    {
      id: '3745',
      name: 'Nex Master Speed Killer',
      description: 'Defeat Nex solo in less than 01:21.',
      subcategory: 'Nex',
      bossId: 'nex',
      logId: 'nex',
      tier: 'Master',
      points: 5,
      members: true,
    },
  ],
}

// A synthetic export with extra fields the matcher ignores.
const data = ProgressExport.assert({
  character: { characterId: 'someone-1' },
  combatAchievements: [
    { id: '1', name: 'nex master speed killer', completed: true, difficulty: 'master' },
    { id: '2', name: 'Retired Task', completed: true },
    { id: '3', name: 'Not Done Yet', completed: false },
  ],
  drops: [
    { id: 'Zaryte bow', count: 2 },
    { id: 'Omens helm', count: 1 },
    { id: 'Mystery item', count: 1 },
    { id: 'Never got it', count: 0 },
  ],
})

describe('matchExport', () => {
  it('matches by name and nickname and lists what it could not match', () => {
    expect(matchExport(catalogue, data)).toEqual({
      items: { 'zaryte-bow': 2, 'omens-helm': 1 },
      tasks: ['3745'],
      unmatched: { tasks: ['Retired Task'], drops: ['Mystery item'] },
    })
  })
})
