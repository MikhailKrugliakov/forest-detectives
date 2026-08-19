import type { ResourceDefinition, ResourceId, SurfaceResourceId } from "./types"

export const SURFACE_RESOURCE_IDS: readonly SurfaceResourceId[] = ["stone", "stick", "rope", "scrap"]

export const RESOURCES: Readonly<Record<ResourceId, ResourceDefinition>> = {
  stone: {
    id: "stone",
    name: "Камень",
    description: "Крепкий камень для простых инструментов.",
    icon: "🪨",
  },
  stick: {
    id: "stick",
    name: "Палка",
    description: "Прочная лесная палка — хорошая рукоять.",
    icon: "🪵",
  },
  rope: {
    id: "rope",
    name: "Верёвка",
    description: "Моток верёвки для крепления деталей.",
    icon: "🧶",
  },
  scrap: {
    id: "scrap",
    name: "Хлам",
    description: "Коробочки, механизмы и россыпь старых шестерёнок.",
    icon: "🧰",
  },
  iron: {
    id: "iron",
    name: "Железо",
    description: "Железная руда, добытая в лесной шахте.",
    icon: "⛓️",
  },
  diamond: {
    id: "diamond",
    name: "Алмаз",
    description: "Редкий сверкающий кристалл из глубины шахты.",
    icon: "💎",
  },
}

export const PICKAXE_RECIPE: Readonly<Record<SurfaceResourceId, number>> = {
  stone: 3,
  stick: 2,
  rope: 1,
  scrap: 1,
}

export const PICKAXE_ITEM = {
  id: "pickaxe",
  type: "tool" as const,
  name: "Каменная кирка",
  description: "Позволяет добывать железо и алмазы в шахте.",
  icon: "⛏️",
}

export const SCRAP_GEAR_REWARD = 10

export const MINE_ENTRANCES = [
  { x: 355, y: 725 },
  { x: 1310, y: 1060 },
  { x: 2090, y: 930 },
] as const

export interface MineOreNode {
  id: string
  resourceId: "iron" | "diamond"
}

export function createMineOreLayout(seed: number, nodeIds: readonly string[]): MineOreNode[] {
  const shuffled = [...nodeIds]
  const random = seededRandom(seed)
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!]
  }
  return shuffled.map((id, index) => ({ id, resourceId: index < 3 ? "diamond" : "iron" }))
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296
  }
}
