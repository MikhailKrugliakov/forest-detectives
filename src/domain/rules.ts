import type { ClueId, Stats } from "./types"

export const SPRINT_MULTIPLIER = 1.4
export const STAMINA_DRAIN_PER_SECOND = 28
export const STAMINA_RECOVERY_PER_SECOND = 20

export function calculateWalkSpeed(agility: number): number {
  return 150 + agility * 6
}

export function calculateMaxStamina(endurance: number): number {
  return 50 + endurance * 10
}

export function calculateMaxHealth(endurance: number): number {
  return 60 + endurance * 8
}

export function calculateAttackDamage(strength: number): number {
  return 1 + Math.floor(strength / 4)
}

export function canAnalyze(clues: readonly ClueId[]): boolean {
  return clues.length >= 2
}

export function buildHint(intelligence: number, clues: readonly ClueId[]): string {
  if (!canAnalyze(clues)) {
    return "Нужно найти хотя бы две улики, чтобы сделать вывод."
  }

  if (intelligence >= 9) {
    return "След начинается у пня, лента ведёт через кусты, а картон лежит у норы. Посылку нужно искать именно там!"
  }

  if (intelligence >= 7) {
    return "Лента с коробки зацепилась за куст. Сравни направление от пня с местом второй улики."
  }

  return "Все улики лежат не случайно. Посмотри, какую дорожку они образуют от пня."
}

export function validateStats(stats: Stats): boolean {
  return Object.values(stats).every((value) => Number.isInteger(value) && value >= 1 && value <= 10)
}
