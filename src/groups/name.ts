import { type } from 'arktype'

/** A group name: 1 to 32 letters, digits, spaces, hyphens or underscores, keyed and slugged like character names. */
export const GroupName = type('string.trim').to(/^(?=.*[A-Za-z0-9])[A-Za-z0-9 _-]{1,32}$/)
