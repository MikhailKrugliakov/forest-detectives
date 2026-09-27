import type { CharacterId, LocationId } from "./types"

/** Ground-level door approaches in forest-village-panorama-v2.jpg.
 * The panorama is 4800×1600 in world coordinates, starting at x=-2400.
 * Keep these entrances in sync with forest-village.tmj; portraits/roofs are
 * deliberately not used as interaction or return positions.
 */
export const VILLAGE_DOORS = {
  "wolf-home": { x: 380, y: 600 },
  "fox-home": { x: 2220, y: 820 },
  "rabbit-home": { x: 825, y: 1450 },
  "sheepwolf-home": { x: 2180, y: 1420 },
  "mole-shop": { x: 1710, y: 730 },
  "beaver-house": { x: 950, y: 1080 },
} as const

export const VILLAGE_SQUARE = { x: 1440, y: 980 } as const

export const VILLAGE_ENTRY_SPAWNS: Partial<Record<LocationId, { x: number; y: number }>> = {
  beach: { x: 1240, y: 230 },
  trench: { x: 1440, y: 980 },
  "wild-forest": { x: 2180, y: 455 },
  "melon-farm": { x: 1440, y: 1390 },
  "mole-shop": { x: 1620, y: 820 },
  "beaver-house": { x: 970, y: 1080 },
  "wolf-home": { x: 390, y: 660 },
  "fox-home": { x: 2240, y: 940 },
  "rabbit-home": { x: 940, y: 1450 },
  "sheepwolf-home": { x: 2100, y: 1420 },
  "snow-valley": { x: -2180, y: 810 },
}

export const HERO_START_SPAWNS: Record<CharacterId, { x: number; y: number }> = {
  wolf: { x: 390, y: 660 },
  fox: { x: 2240, y: 940 },
  rabbit: { x: 940, y: 1450 },
  sheepwolf: { x: 2100, y: 1420 },
  watermelon: { x: 1440, y: 1390 },
}

export const VILLAGE_RESIDENTS = {
  "lost-letters": { x: 970, y: 480 },
  "robot-parts": { x: 650, y: 1080 },
  "robot-sweep": { x: 1900, y: 490 },
  "garden-beds": { x: 1440, y: 360 },
  "bakery-delivery": { x: 1910, y: 1070 },
  "village-lanterns": { x: 1320, y: 1370 },
  "mushroom-hunt": { x: -1730, y: 570 },
  "fence-repair": { x: -1150, y: 850 },
  "trail-signs": { x: -1200, y: 1410 },
  wolf: { x: 140, y: 650 },
  fox: { x: 2310, y: 950 },
  rabbit: { x: 1080, y: 1430 },
  sheepwolf: { x: 2295, y: 1445 },
} as const

/** Single continuous northern lane, between the post office and Tim's house. */
export const VILLAGE_SEA_PATH = [
  { x: 1440, y: 980 }, { x: 1405, y: 900 }, { x: 1375, y: 700 },
  { x: 1290, y: 420 }, { x: 1220, y: 130 },
] as const
export const VILLAGE_SEA_PORTAL = { x: 1220, y: 130 } as const
export const VILLAGE_OCEAN_OWL = { x: 1540, y: 880 } as const
