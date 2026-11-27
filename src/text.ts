/** "1 drop", "302 drops". */
export const counted = (n: number, noun: string) => `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`

/** Joins as "A", "A and B", "A, B and C", without a comma before "and", as the site's copy does. */
export const listFormat = new Intl.ListFormat('en-GB')

/** "A", "A and B", "A, B and C". */
export const list = (parts: string[]) => listFormat.format(parts)
