import type { ClueId, InventoryItem } from "./types"

export const CLUES: Readonly<Record<ClueId, InventoryItem>> = {
  "parcel-print": {
    id: "parcel-print",
    type: "clue",
    name: "След от коробки",
    description: "На мягком мху остался квадратный отпечаток. Здесь точно стояла посылка.",
    icon: "▣",
  },
  ribbon: {
    id: "ribbon",
    type: "clue",
    name: "Синяя лента",
    description: "Обрывок упаковочной ленты зацепился за куст на пути от пня к норе.",
    icon: "🎗️",
  },
  cardboard: {
    id: "cardboard",
    type: "clue",
    name: "Кусочек картона",
    description: "На краю картона виден тот же синий след от упаковочной ленты.",
    icon: "◫",
  },
}

export const CLUE_ORDER: readonly ClueId[] = ["parcel-print", "ribbon", "cardboard"]
