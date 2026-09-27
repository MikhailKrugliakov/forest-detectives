import { describe, expect, it } from "vitest"
import { DIFFICULTIES, rescaleRemainingHealth, scaledDifficultyValue, scaledEnemyDamage, scaledTrapDamage } from "../../src/domain/difficulty"

describe("уровни сложности", () => {
  it("использует заданные множители и округляет минимум до единицы", () => {
    expect(DIFFICULTIES.walk.multiplier).toBe(0.2)
    expect(DIFFICULTIES.story.multiplier).toBe(0.4)
    expect(DIFFICULTIES.hard.multiplier).toBe(1)
    expect(DIFFICULTIES.impossible.multiplier).toBe(1.5)
    expect(scaledDifficultyValue(5, "walk")).toBe(1)
    expect(scaledDifficultyValue(7, "story")).toBe(3)
    expect(scaledDifficultyValue(7, "hard")).toBe(7)
    expect(scaledDifficultyValue(7, "impossible")).toBe(11)
    expect(scaledDifficultyValue(1, "walk")).toBe(1)
  })

  it("масштабирует ловушки и сохраняет процент здоровья живой цели", () => {
    expect(scaledTrapDamage(15, "walk")).toBe(3)
    expect(scaledTrapDamage(15, "story")).toBe(6)
    expect(scaledTrapDamage(15, "impossible")).toBe(23)
    expect(rescaleRemainingHealth(5, 10, 20)).toBe(10)
    expect(rescaleRemainingHealth(1, 10, 3)).toBe(1)
    expect(rescaleRemainingHealth(0, 10, 20)).toBe(0)
  })

  it("отдельно масштабирует урон врагов и усиливает третий уровень на 30 процентов", () => {
    expect(DIFFICULTIES.walk.enemyDamageMultiplier).toBe(0)
    expect(DIFFICULTIES.story.enemyDamageMultiplier).toBe(0.2)
    expect(DIFFICULTIES.hard.enemyDamageMultiplier).toBe(0.975)
    expect(DIFFICULTIES.impossible.enemyDamageMultiplier).toBe(1.5)
    expect(scaledEnemyDamage({ damage: 30 }, "walk")).toBe(0)
    expect(scaledEnemyDamage({ damage: 30 }, "story")).toBe(6)
    expect(scaledEnemyDamage({ damage: 40 }, "hard")).toBe(39)
    expect(scaledEnemyDamage({ damage: 30 }, "impossible")).toBe(45)
    expect(scaledEnemyDamage({ damage: 1 }, "walk")).toBe(0)
    expect(scaledTrapDamage(15, "hard")).toBe(15)
  })
})
