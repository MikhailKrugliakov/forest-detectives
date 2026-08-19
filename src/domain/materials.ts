import type { BuildingMaterialDefinition, BuildingMaterialId } from "./types"

export const BUILDING_MATERIAL_IDS: readonly BuildingMaterialId[] = [
  "collapsing-floor",
  "falling-wall",
]

export const BUILDING_MATERIALS: Record<BuildingMaterialId, BuildingMaterialDefinition> = {
  "collapsing-floor": {
    id: "collapsing-floor",
    name: "Проваливающийся пол",
    description: "Готовый безопасный модуль с возвратной пружиной для учебной ловушки.",
    price: 5,
    icon: "🪤",
  },
  "falling-wall": {
    id: "falling-wall",
    name: "Падающая стена",
    description: "Складная декорационная стена с мягким стопором и рычагом перезапуска.",
    price: 7,
    icon: "🧱",
  },
}

export const TOTAL_BUILDING_MATERIAL_COST = BUILDING_MATERIAL_IDS.reduce(
  (total, id) => total + BUILDING_MATERIALS[id].price,
  0,
)
