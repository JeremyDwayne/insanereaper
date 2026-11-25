import catalogueJson from './catalogue.json'
import { Catalogue } from './schema.ts'

/** The validated catalogue, bundled into both the Worker and the browser. */
export const catalogue = Catalogue.assert(catalogueJson)

export const logsById = new Map(catalogue.logs.map((log) => [log.id, log]))
export const bossesById = new Map(catalogue.bosses.map((boss) => [boss.id, boss]))
export const itemsById = new Map(catalogue.items.map((item) => [item.id, item]))
export const tasksById = new Map(catalogue.tasks.map((task) => [task.id, task]))
