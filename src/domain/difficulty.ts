import type { DifficultyId, EnemyDefinition } from "./types"

export interface DifficultyDefinition {
  id: DifficultyId
  name: string
  description: string
  multiplier: number
}

export const DIFFICULTY_IDS: readonly DifficultyId[] = [
  "walk",
  "story",
  "hard",
  "impossible",
]

export const DIFFICULTIES: Record<DifficultyId, DifficultyDefinition> = {
  walk: {
    id: "walk",
    name: "Прогулка",
    description: "20% здоровья и урона врагов и ловушек.",
    multiplier: 0.2,
  },
  story: {
    id: "story",
    name: "История",
    description: "40% здоровья и урона врагов и ловушек.",
    multiplier: 0.4,
  },
  hard: {
    id: "hard",
    name: "Сложный",
    description: "Исходный баланс приключения.",
    multiplier: 1,
  },
  impossible: {
    id: "impossible",
    name: "Невозможный",
    description: "150% здоровья и урона врагов и ловушек.",
    multiplier: 1.5,
  },
}

export function scaledDifficultyValue(base: number, difficulty: DifficultyId): number {
  return Math.max(1, Math.round(base * DIFFICULTIES[difficulty].multiplier))
}

export function scaledEnemyHealth(enemy: Pick<EnemyDefinition, "hp">, difficulty: DifficultyId): number {
  return scaledDifficultyValue(enemy.hp, difficulty)
}

export function scaledEnemyDamage(enemy: Pick<EnemyDefinition, "damage">, difficulty: DifficultyId): number {
  return scaledDifficultyValue(enemy.damage, difficulty)
}

export function scaledTrapDamage(base: number, difficulty: DifficultyId): number {
  return scaledDifficultyValue(base, difficulty)
}

export function rescaleRemainingHealth(current: number, previousMax: number, nextMax: number): number {
  if (current <= 0) return 0
  if (previousMax <= 0) return nextMax
  return Math.max(1, Math.min(nextMax, Math.ceil((current / previousMax) * nextMax)))
}
