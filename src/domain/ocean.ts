import { ENEMY_RESPAWN_MS } from "./quests"
import type { EnemyDefinition, GameSession, InventoryItem, LocationId, OceanState } from "./types"

export type OceanLocationId = Extract<LocationId, "beach" | "sea" | "trench">
export const OCEAN_WORLD_SIZES: Record<OceanLocationId, { width: number; height: number }> = {
  beach: { width: 4800, height: 1600 },
  sea: { width: 4800, height: 1600 },
  trench: { width: 4800, height: 1600 },
}
export const OCEAN_LOCATION_NAMES: Record<OceanLocationId, string> = { beach: "Пляж", sea: "Море", trench: "Впадина" }
export const SCUBA_PRICE = 40
export const SCUBA_ITEM: InventoryItem = {
  id: "scuba", type: "equipment", name: "Акваланг", icon: "🤿",
  description: "Позволяет свободно плавать и сражаться под водой. Работает автоматически и не занимает место устройства.",
}
export const OCEAN_REWARD: InventoryItem = {
  id: "coast-saviour-badge", type: "reward", name: "Спаситель побережья", icon: "🌊",
  description: "Памятный знак за отключение древнего приливного механизма и спасение деревни.",
}
export const TIGER_SHARK_ID = "tiger-shark"
export const ICHTHYOSAUR_ID = "ichthyosaur"
export const MEDUSA_SCHOOL_RESPAWN_MS = 60_000
export const BEACH_SCRAP = [
  { id: "beach-scrap-1", x: 1300, y: 1050 },
  { id: "beach-scrap-2", x: 2850, y: 570 },
] as const
export const BEACH_SCRAP_GEARS = 10

const beachPositions = [
  [420, 730], [650, 960], [880, 680], [1110, 850], [1340, 730], [1570, 970],
  [1800, 680], [2030, 890], [2260, 720], [2490, 960], [2720, 720], [2950, 920],
  [730, 780], [1200, 940], [1680, 780], [2160, 980], [2640, 790], [3100, 720], [3300, 970], [3440, 780],
] as const
export const BEACH_ENEMIES: readonly EnemyDefinition[] = beachPositions.map(([x, y], index) => {
  const crab = index < 12
  const type = crab ? "robot-crab" : "beach-albatross"
  return { id: `beach-${crab ? "crab" : "albatross"}-${crab ? index + 1 : index - 11}`, type, assetKey: type,
    location: "beach", behavior: "melee", x, y, hp: crab ? 10 : 8, damage: 22, speed: crab ? 92 : 138,
    rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong, dropsGear: true }
})
const fishPositions = [
  [440, 760], [700, 860], [970, 770], [1230, 870], [1500, 660], [1760, 880],
  [2030, 740], [2290, 880], [2550, 700], [2820, 860], [3080, 800], [3400, 880],
] as const
export const PREDATORY_FISH: readonly EnemyDefinition[] = fishPositions.map(([x, y], index) => ({
  id: `sea-fish-${index + 1}`, type: "predatory-fish", assetKey: "predatory-fish", location: "sea", behavior: "melee",
  x, y, hp: 12, damage: 26, speed: 138, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong, dropsGear: false,
}))
export const MEDUSA_SCHOOLS = [[1100, 570], [2000, 800], [3020, 580]].map(([x, y], index) => ({
  id: `medusa-school-${index + 1}`, x: x!, y: y!, enemyIds: [1, 2, 3].map((number) => `medusa-${index + 1}-${number}`),
}))
export const MEDUSAS: readonly EnemyDefinition[] = MEDUSA_SCHOOLS.flatMap((school) => school.enemyIds.map((id, index) => ({
  id, type: "jellyfish", assetKey: "jellyfish", location: "sea", behavior: "jellyfish",
  x: school.x + (index - 1) * 80, y: school.y + (index === 1 ? 75 : 0), hp: 8, damage: 18, speed: 85,
  rank: "normal", respawnMs: MEDUSA_SCHOOL_RESPAWN_MS, dropsGear: false,
})))
export const SPINY_FISH: readonly EnemyDefinition[] = fishPositions.map(([x, y], index) => ({
  id: `trench-fish-${index + 1}`, type: "spiny-fish", assetKey: "spiny-fish", location: "trench", behavior: "spiny-slam",
  x, y, hp: 18, damage: 32, speed: 105, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong, dropsGear: false,
}))
export const TIGER_SHARK: EnemyDefinition = {
  id: TIGER_SHARK_ID, type: "tiger-shark", assetKey: "tiger-shark", location: "sea", behavior: "tiger-shark",
  x: 4260, y: 800, hp: 90, damage: 32, speed: 125, rank: "boss", respawnMs: null, dropsGear: false,
}
export const ICHTHYOSAUR: EnemyDefinition = {
  id: ICHTHYOSAUR_ID, type: "ichthyosaur", assetKey: "ichthyosaur", location: "trench", behavior: "ichthyosaur",
  x: 4260, y: 800, hp: 110, damage: 34, speed: 105, rank: "boss", respawnMs: null, dropsGear: false,
}
export const SEA_ENEMIES = [...PREDATORY_FISH, ...MEDUSAS, TIGER_SHARK] as const
export const TRENCH_ENEMIES = [...SPINY_FISH, ICHTHYOSAUR] as const
export const OCEAN_ENEMIES = [...BEACH_ENEMIES, ...SEA_ENEMIES, ...TRENCH_ENEMIES] as const

export function emptyOceanState(): OceanState {
  return { introSeen: false, beachVisited: false, returnToMole: false, hasScuba: false, sharkCleared: false,
    ichthyosaurCleared: false, mechanismDisabled: false,
    schools: Object.fromEntries(MEDUSA_SCHOOLS.map(({ id }) => [id, { aggressive: false, defeatedEnemies: [], respawnAt: null }])),
  }
}
export function medusaSchool(enemyId: string) {
  return MEDUSA_SCHOOLS.find(({ enemyIds }) => enemyIds.includes(enemyId))
}
export function oceanObjective(state: Readonly<GameSession>): string {
  const ocean = state.ocean
  if (!ocean.introSeen) return "Вернуться в деревню и поговорить с Совой"
  if (!ocean.beachVisited) return "Исследовать побережье — проход на севере деревни"
  if (!ocean.hasScuba) return ocean.returnToMole ? "Вернуться к кроту" : `Собрать 40 шестерёнок для акваланга (${state.gears}/40)`
  if (!ocean.sharkCleared) return "Погрузиться в море и победить Тигровую акулу"
  if (!ocean.ichthyosaurCleared) return "Исследовать Впадину и победить Ихтиозавра"
  if (!ocean.mechanismDisabled) return "Отключить древний приливный механизм"
  return "Деревня спасена от наводнения!"
}
