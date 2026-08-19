export const HEALING_POTION_CAPACITY = 3
export const HEALING_POTION_RECHARGE_MS = 90_000
export const HEALING_POTION_HEAL_RATIO = 0.33

export interface HealingPotionState {
  ready: number
  nextReadyAt: number | null
}

export function activePotionCooldowns(readyAt: readonly number[], now = Date.now()): number[] {
  return readyAt
    .filter((deadline) => Number.isFinite(deadline) && deadline > now)
    .sort((left, right) => left - right)
    .slice(0, HEALING_POTION_CAPACITY)
}

export function healingPotionState(readyAt: readonly number[], now = Date.now()): HealingPotionState {
  const active = activePotionCooldowns(readyAt, now)
  return {
    ready: HEALING_POTION_CAPACITY - active.length,
    nextReadyAt: active[0] ?? null,
  }
}

export function healingPotionAmount(maxHealth: number): number {
  return Math.max(1, Math.ceil(Math.max(0, maxHealth) * HEALING_POTION_HEAL_RATIO))
}
