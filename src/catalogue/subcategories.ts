/**
 * Combat Mastery subcategories whose name is not a boss log heading, mapped to the log id
 * they belong to. Any other subcategory must slug to a log id, or the catalogue build fails.
 */
export const SUBCATEGORY_LOGS: Record<string, string> = {
  Amascut: 'amascut-the-devourer',
  Ambassador: 'the-shadow-reef',
  'Crassian Leviathan': 'the-shadow-reef',
  Taraket: 'the-shadow-reef',
  Astellarn: 'dragonkin-laboratory',
  'Verak Lith': 'dragonkin-laboratory',
  'Black Stone Dragon': 'dragonkin-laboratory',
  'Sanctum Guardian': 'temple-of-aminishi',
  Masuta: 'temple-of-aminishi',
  Seiryu: 'temple-of-aminishi',
  'Boss Dungeon: Sanctum of Rebirth': 'sanctum-of-rebirth',
  Vermyx: 'sanctum-of-rebirth',
  Kezalam: 'sanctum-of-rebirth',
  Nakatra: 'sanctum-of-rebirth',
  'Barrows Brothers': 'barrows',
  'Barrows: Rise of the Six': 'rise-of-the-six',
  'Beastmaster Durzag': 'liberation-of-mazcab',
  Yakamaru: 'liberation-of-mazcab',
  'Raid: Liberation of Mazcab': 'liberation-of-mazcab',
  'Ghrazi Blood Knights': 'the-ghrazi-blood-knights',
  'Har-Aken': 'tztok-jad-and-har-aken',
  'TzTok-Jad': 'tztok-jad-and-har-aken',
  Hermod: 'hermod-the-spirit-of-war',
  Magister: 'the-magister',
  Rasial: 'rasial-the-first-necromancer',
  Zamorak: 'zamorak-lord-of-chaos',
}

/** Boss pages from the wiki's titles table that have no boss image, mapped to a page that does. */
export const LOG_PAGES: Record<string, string> = {
  'Fight Kiln': 'TzTok-Jad',
}

/** Achievement groups the game lists after every boss, in its order. They draw on their log's page and drops. */
export const GROUP_PREFIXES = ['Elite Dungeon: ', 'Boss Dungeon: ', 'Raid: ']

/** Split bosses whose subcategory name is not their wiki page. */
export const BOSS_PAGES: Record<string, string> = {}
