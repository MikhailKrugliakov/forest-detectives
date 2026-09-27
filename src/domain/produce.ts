import type { ProduceDefinition, ProduceId, WeaponId } from "./types"

export const FARM_PRODUCE_IDS: readonly ProduceId[] = ["tomato", "cucumber"]
export const KROK_MARKET_PRODUCE_IDS: readonly ProduceId[] = ["dense-tomato", "large-cucumber"]
export const PRODUCE_IDS: readonly ProduceId[] = [...FARM_PRODUCE_IDS, ...KROK_MARKET_PRODUCE_IDS]

export const PRODUCE: Record<ProduceId, ProduceDefinition> = {
  tomato: {
    id: "tomato",
    name: "Помидор",
    description: "Мягкий метательный снаряд. Робозайцу понадобится четыре точных попадания.",
    price: 1,
    packSize: 2,
    damage: 0.5,
    icon: "🍅",
  },
  cucumber: {
    id: "cucumber",
    name: "Огурец",
    description: "Лёгкий метательный снаряд с тем же слабым, но безопасным уроном.",
    price: 1,
    packSize: 2,
    damage: 0.5,
    icon: "🥒",
  },
  "dense-tomato": {
    id: "dense-tomato", name: "Плотные помидоры", description: "Усиленные помидоры с рынка Кроков.",
    price: 3, packSize: 2, damage: 1.5, icon: "🍅",
  },
  "large-cucumber": {
    id: "large-cucumber", name: "Большие огурцы", description: "Тяжёлые огурцы с рынка Кроков.",
    price: 4, packSize: 2, damage: 2, icon: "🥒",
  },
}

export function weaponLabel(id: WeaponId): string {
  return id === "melee" ? "Основное оружие" : PRODUCE[id].name
}
