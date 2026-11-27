/** "1 drop", "302 drops". */
export const counted = (n: number, noun: string) => `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`

/** "A", "A and B", "A, B and C". */
export const list = (parts: string[]) => new Intl.ListFormat('en').format(parts)
