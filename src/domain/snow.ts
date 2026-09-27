import { ENEMY_RESPAWN_MS } from "./quests"
import type { EnemyDefinition, EnemyType, InventoryItem, LocationId } from "./types"

export type SnowLocationId = Extract<LocationId, "snow-valley" | "snow-city" | "krok-outskirts" | "ice-palace" | "ice-throne">

export const SNOW_WORLD_SIZES: Record<SnowLocationId, { width: number; height: number }> = {
  "snow-valley": { width: 4800, height: 1600 },
  "snow-city": { width: 4800, height: 1600 },
  "krok-outskirts": { width: 4800, height: 1600 },
  "ice-palace": { width: 2400, height: 1600 },
  "ice-throne": { width: 1280, height: 900 },
}

export const WALRUS_ID = "walrus-throne" as const
export const WALRUS_AGGRO_RADIUS = 420
export const WALRUS_ATTACKS = { icicle: 24, tail: 42, tusk: 26 } as const

const valleyPositions = [
  [450, 740], [760, 900], [1080, 700], [1390, 940], [1740, 750], [2070, 900],
  [2390, 710], [2710, 920], [3040, 730], [3360, 890], [3710, 720], [4010, 920],
  [4270, 730], [4450, 940], [1600, 1050], [2600, 540], [3500, 1090], [3900, 550],
] as const
const cityPositions = [
  [470, 720], [760, 890], [1090, 700], [1400, 920], [1710, 740], [2010, 900],
  [2330, 710], [2640, 930], [2960, 730], [3280, 900], [3580, 720], [3910, 910],
  [4140, 700], [4370, 940], [1510, 1050], [2520, 540], [3450, 1080], [4050, 550],
] as const
const palacePositions = [
  [380, 720], [550, 930], [720, 690], [890, 950], [1060, 730], [1220, 910],
  [1400, 700], [1570, 930], [1740, 720], [1910, 950], [2070, 700], [2190, 920],
] as const

function snowEnemy(id: string, type: EnemyType, location: SnowLocationId, x: number, y: number): EnemyDefinition {
  const common = { id, type, assetKey: type, location, x, y, dropsGear: type === "robot-albatross" }
  if (type === "snowball") return { ...common, behavior: "snow-rush", hp: 2, damage: 9, speed: 140, rank: "weak", respawnMs: ENEMY_RESPAWN_MS.weak }
  if (type === "snowman") return { ...common, behavior: "snow-throw", hp: 5, damage: 16, speed: 90, rank: "normal", respawnMs: ENEMY_RESPAWN_MS.normal }
  if (type === "robot-albatross") return { ...common, behavior: "feather-fan", hp: 8, damage: 22, speed: 130, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong }
  if (type === "snow-golem") return { ...common, behavior: "ice-slam", hp: 9, damage: 24, speed: 75, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong }
  return { ...common, behavior: "ice-slam", hp: 13, damage: 28, speed: 88, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong }
}

export const SNOW_VALLEY_ENEMIES: readonly EnemyDefinition[] = valleyPositions.map(([x, y], index) =>
  snowEnemy(`valley-${index + 1}`, index < 6 ? "snowball" : index < 12 ? "snowman" : "robot-albatross", "snow-valley", x, y),
)
export const SNOW_CITY_ENEMIES: readonly EnemyDefinition[] = cityPositions.map(([x, y], index) =>
  snowEnemy(`city-${index + 1}`, index < 6 ? "snowball" : index < 12 ? "snowman" : "snow-golem", "snow-city", x, y),
)
export const ICE_PALACE_ENEMIES: readonly EnemyDefinition[] = palacePositions.map(([x, y], index) =>
  snowEnemy(`palace-${index + 1}`, "ice-golem", "ice-palace", x, y),
)
export const WALRUS: EnemyDefinition = {
  id: WALRUS_ID,
  type: "walrus",
  assetKey: "walrus",
  location: "ice-throne",
  behavior: "walrus",
  x: 1040,
  y: 450,
  hp: 78,
  damage: WALRUS_ATTACKS.tail,
  speed: 78,
  rank: "boss",
  respawnMs: null,
  dropsGear: false,
}

export const SNOW_ENEMIES: readonly EnemyDefinition[] = [
  ...SNOW_VALLEY_ENEMIES,
  ...SNOW_CITY_ENEMIES,
  ...ICE_PALACE_ENEMIES,
  WALRUS,
]

export type WalrusPhase = 1 | 2 | 3 | "defeated"
export function walrusPhase(health: number, maxHealth: number): WalrusPhase {
  if (health <= 0) return "defeated"
  if (health / maxHealth > 2 / 3) return 1
  if (health / maxHealth > 1 / 3) return 2
  return 3
}

export const WALRUS_REWARD: InventoryItem = {
  id: "ice-palace-badge",
  type: "reward",
  name: "Знак Ледяного дворца",
  description: "За победу над Моржом и завершение третьей главы.",
  icon: "❄️",
}
