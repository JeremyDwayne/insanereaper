import { type } from 'arktype'

/** Site paths that a profile at /<name> would shadow. */
const RESERVED = new Set(['account', 'api', 'login', 'signed in', 'start'])

/** A RuneScape display name: 1 to 12 letters, digits, spaces, hyphens or underscores, and not a site path. */
export const CharacterName = type('string.trim')
  .to(/^[A-Za-z0-9 _-]{1,12}$/)
  .narrow((name, ctx) => !RESERVED.has(nameKey(name)) || ctx.mustBe('a name that is not a site page'))

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
