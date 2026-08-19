import { describe, expect, it } from "vitest"
import { ENEMIES, ENEMY_RESPAWN_MS } from "../../src/domain/quests"
import { calculateAttackDamage, calculateMaxHealth } from "../../src/domain/rules"

describe("вторая глава", () => {
  it("содержит десять уникальных робозверей трёх видов", () => {
    expect(ENEMIES).toHaveLength(10)
    expect(new Set(ENEMIES.map(({ id }) => id)).size).toBe(10)
    expect(ENEMIES.filter(({ type }) => type === "robot-hare")).toHaveLength(4)
    expect(ENEMIES.filter(({ type }) => type === "robot-wolf")).toHaveLength(3)
    expect(ENEMIES.filter(({ type }) => type === "robot-boar")).toHaveLength(3)
  })

  it("задаёт баланс здоровья и урона", () => {
    expect(calculateMaxHealth(5)).toBe(100)
    expect(calculateMaxHealth(8)).toBe(124)
    expect(calculateAttackDamage(3)).toBe(1)
    expect(calculateAttackDamage(5)).toBe(2)
    expect(calculateAttackDamage(8)).toBe(3)
  })

  it("делит робозверей по силе и задаёт точные интервалы возрождения", () => {
    expect(ENEMIES.filter(({ rank }) => rank === "weak")).toHaveLength(4)
    expect(ENEMIES.filter(({ rank }) => rank === "normal")).toHaveLength(3)
    expect(ENEMIES.filter(({ rank }) => rank === "strong")).toHaveLength(2)
    const boss = ENEMIES.find(({ rank }) => rank === "boss")
    expect(boss).toMatchObject({ id: "boar-3", hp: 12, damage: 28, respawnMs: null })
    expect(ENEMY_RESPAWN_MS).toEqual({ weak: 30_000, normal: 60_000, strong: 90_000 })
  })
})
