import type { EnemyDefinition, ErrandDefinition, KrokErrandId, InventoryItem } from "./types"

export const KROK_OUTSKIRTS_SIZE = { width: 4800, height: 1600 } as const
export const KROK_CITY_SIZE = { width: 9600, height: 3200 } as const
export const KROK_ERRAND_IDS: readonly KrokErrandId[] = ["rivets", "tablets", "medicine", "street-lamps"]
export const KROK_ERRANDS: Record<KrokErrandId, Omit<ErrandDefinition, "id"> & { id: KrokErrandId }> = {
  rivets: { id: "rivets", npcName: "Кузнец Брон", title: "Потерянные заклёпки", description: "Собрать четыре заклёпки в городе.", target: 4, icon: "🔩", reward: 4 },
  tablets: { id: "tablets", npcName: "Архивариус Кер", title: "Каменные таблички", description: "Найти три таблички в кварталах.", target: 3, icon: "📜", reward: 4 },
  medicine: { id: "medicine", npcName: "Лекарь Лира", title: "Аптечки для стражи", description: "Доставить три аптечки отмеченным стражникам.", target: 3, icon: "🧰", reward: 4 },
  "street-lamps": { id: "street-lamps", npcName: "Фонарщик Грей", title: "Свет на улицах", description: "Зажечь четыре фонаря.", target: 4, icon: "🏮", reward: 4 },
}

export const KROK_SIEGE_REWARD: InventoryItem = {
  id: "krok-defender-badge", type: "reward", name: "Знак защитника Кроков",
  description: "Крепостные ворота освобождены от осады.", icon: "🛡️",
}
export const KROK_PRINCE_REWARD: InventoryItem = {
  id: "krok-prince-seal", type: "reward", name: "Печать Кроков",
  description: "Благодарность Принца за победу над Моржом.", icon: "👑",
}

const snowmen: readonly [number, number][] = [[480, 750], [860, 920], [1270, 700], [1620, 940], [2050, 750], [2480, 880]]
const golems: readonly [number, number][] = [[2890, 720], [3230, 920], [3550, 730], [3850, 910]]
const catapults: readonly [number, number][] = [[1160, 1040], [2630, 1040], [4050, 1050]]

export const KROK_SIEGE_ENEMIES: readonly EnemyDefinition[] = [
  ...snowmen.map(([x, y], index): EnemyDefinition => ({ id: `siege-snowman-${index + 1}`, type: "snowman", assetKey: "snowman", location: "krok-outskirts", behavior: "snow-throw", x, y, hp: 5, damage: 16, speed: 90, rank: "normal", respawnMs: null, dropsGear: false })),
  ...golems.map(([x, y], index): EnemyDefinition => ({ id: `siege-golem-${index + 1}`, type: "ice-golem", assetKey: "ice-golem", location: "krok-outskirts", behavior: "ice-slam", x, y, hp: 13, damage: 28, speed: 88, rank: "strong", respawnMs: null, dropsGear: false })),
  ...catapults.map(([x, y], index): EnemyDefinition => ({ id: `siege-catapult-${index + 1}`, type: "ice-catapult", assetKey: "ice-catapult", location: "krok-outskirts", behavior: "ice-catapult", x, y, hp: 16, damage: 18, speed: 0, rank: "strong", respawnMs: null, dropsGear: false })),
]

export function siegeCleared(defeated: readonly string[]): boolean {
  return KROK_SIEGE_ENEMIES.every(({ id }) => defeated.includes(id))
}
