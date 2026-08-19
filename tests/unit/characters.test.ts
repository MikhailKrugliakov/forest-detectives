import { describe, expect, it } from "vitest"
import { CHARACTERS, getCharacter } from "../../src/domain/characters"
import { calculateMaxStamina, calculateWalkSpeed, validateStats } from "../../src/domain/rules"

describe("герои", () => {
  it("содержит пять валидных наборов характеристик", () => {
    expect(CHARACTERS).toHaveLength(5)
    expect(CHARACTERS.every((character) => validateStats(character.stats))).toBe(true)
  })

  it("делает Зайчонка самым умным и ловким", () => {
    const rabbit = getCharacter("rabbit")
    expect(rabbit.stats.intelligence).toBe(10)
    expect(rabbit.stats.agility).toBe(10)
    expect(Math.max(...CHARACTERS.filter(({ id }) => id !== "rabbit").map(({ stats }) => stats.intelligence))).toBe(8)
  })

  it("использует заданные характеристики Арбузика", () => {
    expect(getCharacter("watermelon").stats).toEqual({
      strength: 3,
      agility: 9,
      endurance: 5,
      intelligence: 5,
    })
  })

  it("использует заданные характеристики Овцеволка", () => {
    expect(getCharacter("sheepwolf").stats).toEqual({
      strength: 5,
      agility: 7,
      endurance: 5,
      intelligence: 1,
    })
  })

  it("рассчитывает скорость и запас бега", () => {
    expect(calculateWalkSpeed(10)).toBe(210)
    expect(calculateWalkSpeed(5)).toBe(180)
    expect(calculateMaxStamina(8)).toBe(130)
    expect(calculateMaxStamina(5)).toBe(100)
  })
})
