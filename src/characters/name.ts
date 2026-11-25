import { type } from 'arktype'

/** A RuneScape display name: 1 to 12 letters, digits, spaces, hyphens or underscores. */
export const CharacterName = type('string.trim').to(/^[A-Za-z0-9 _-]{1,12}$/)

/**
 * The uniqueness key for a name. The game treats case, spaces, hyphens and underscores as
 * the same, so "Iron_Man" and "iron man" share a key.
 */
export function nameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
}

/** Profile path segment: the key with spaces as underscores, as the game's own URLs do. */
export function nameSlug(name: string): string {
  return nameKey(name).replaceAll(' ', '_')
}
