/** URL of a log or item image: R2 when synced, the wiki otherwise. */
export function imageUrl(x: { image: string; wikiImage: string }): string {
  return x.image ? `https://img.insanereaper.com/${x.image}` : `https://runescape.wiki${x.wikiImage}`
}
