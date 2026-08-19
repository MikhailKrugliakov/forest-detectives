import type { GadgetDefinition, GadgetId } from "./types"

export const GADGET_IDS: readonly GadgetId[] = [
  "jetpack",
  "magnetic-glove",
  "gas-mask",
  "pulse-shield",
]

export const GADGETS: Record<GadgetId, GadgetDefinition> = {
  jetpack: {
    id: "jetpack",
    name: "Реактивный ранец",
    description: "Переносит героя между отмеченными площадками над пропастью.",
    price: 12,
    icon: "🚀",
    assetKey: "gadget-jetpack",
    durationMs: 900,
    cooldownMs: 2000,
  },
  "magnetic-glove": {
    id: "magnetic-glove",
    name: "Магнитная перчатка",
    description: "Притягивает отмеченные металлические механизмы на расстоянии.",
    price: 8,
    icon: "🧲",
    assetKey: "gadget-magnetic-glove",
    durationMs: 500,
    cooldownMs: 2500,
  },
  "gas-mask": {
    id: "gas-mask",
    name: "Умный противогаз",
    description: "На восемь секунд полностью защищает от ядовитого газа.",
    price: 8,
    icon: "😷",
    assetKey: "gadget-gas-mask",
    durationMs: 8000,
    cooldownMs: 12000,
  },
  "pulse-shield": {
    id: "pulse-shield",
    name: "Импульсный щит",
    description: "Две секунды ждёт и блокирует следующий удар или залп.",
    price: 10,
    icon: "🔵",
    assetKey: "gadget-pulse-shield",
    durationMs: 2000,
    cooldownMs: 6000,
  },
}

export const TOTAL_GADGET_COST = GADGET_IDS.reduce((sum, id) => sum + GADGETS[id].price, 0)
