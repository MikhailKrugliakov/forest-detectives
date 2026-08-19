import type { ProduceDefinition, ProduceId, WeaponId } from "./types"

export const PRODUCE_IDS: readonly ProduceId[] = ["tomato", "cucumber"]

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
}

export function weaponLabel(id: WeaponId): string {
  return id === "melee" ? "Основное оружие" : PRODUCE[id].name
}
