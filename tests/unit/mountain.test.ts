import { describe, expect, it } from "vitest"
import { GameStore } from "../../src/domain/GameStore"
import { MOUNTAIN_ENEMIES, MOUNTAIN_GUARDIAN_IDS } from "../../src/domain/mountain"

describe("Горная Лощина", () => {
  it("содержит 18 насекомых без слабого ранга и двух уникальных боссов", () => {
    expect(MOUNTAIN_ENEMIES).toHaveLength(20)
    expect(new Set(MOUNTAIN_ENEMIES.map(({ id }) => id)).size).toBe(20)
    expect(MOUNTAIN_ENEMIES.filter(({ rank }) => rank === "weak")).toHaveLength(0)
    expect(MOUNTAIN_ENEMIES.filter(({ type }) => type === "robot-beetle")).toHaveLength(6)
    expect(MOUNTAIN_ENEMIES.filter(({ type }) => type === "robot-wasp")).toHaveLength(6)
    expect(MOUNTAIN_ENEMIES.filter(({ type }) => type === "robot-mantis")).toHaveLength(6)
    expect(MOUNTAIN_ENEMIES.filter(({ rank }) => rank === "boss").map(({ id }) => id)).toEqual(MOUNTAIN_GUARDIAN_IDS)
  })

  it("использует заданные характеристики и таймеры возрождения", () => {
    const beetle = MOUNTAIN_ENEMIES.find(({ id }) => id === "beetle-1")!
    const wasp = MOUNTAIN_ENEMIES.find(({ id }) => id === "wasp-1")!
    const mantis = MOUNTAIN_ENEMIES.find(({ id }) => id === "mantis-1")!
    const axe = MOUNTAIN_ENEMIES.find(({ id }) => id === "guardian-axe")!
    const flame = MOUNTAIN_ENEMIES.find(({ id }) => id === "guardian-flamethrower")!
    expect(beetle).toMatchObject({ hp: 4, damage: 15, speed: 105, rank: "normal", respawnMs: 60_000 })
    expect(wasp).toMatchObject({ hp: 4, damage: 12, speed: 130, rank: "normal", respawnMs: 60_000 })
    expect(mantis).toMatchObject({ hp: 7, damage: 22, speed: 90, rank: "strong", respawnMs: 90_000 })
    expect(axe).toMatchObject({ hp: 24, damage: 30, rank: "boss", respawnMs: null })
    expect(flame).toMatchObject({ hp: 22, damage: 8, rank: "boss", respawnMs: null })
  })

  it("не засчитывает горных роботов в задания Совы и Бобра", () => {
    const store = new GameStore()
    store.selectCharacter("fox")
    store.beginVillageChapter()
    store.acceptQuest("robot-sweep")
    store.acceptQuest("robot-parts")
    store.defeatEnemy("beetle-1", 1_000)
    const drop = store.state.enemyGearDrops[0]!
    expect(drop).toMatchObject({ location: "mountain-hollow", containsPart: false })
    expect(store.collectEnemyGearDrop(drop.id)).toBe(true)
    expect(store.state.gears).toBe(1)
    expect(store.state.mountainEnemyDefeats).toBe(1)
    expect(store.state.wildForestEnemyDefeats).toBe(0)
    expect(store.questProgress("robot-sweep")).toBe(0)
    expect(store.questProgress("robot-parts")).toBe(0)
  })

  it("открывает проход после лесного босса и выдаёт горную награду один раз", () => {
    const store = new GameStore()
    store.selectCharacter("sheepwolf")
    expect(store.isMountainUnlocked()).toBe(false)
    store.defeatEnemy("boar-3")
    expect(store.isMountainUnlocked()).toBe(true)
    store.defeatEnemy("guardian-axe")
    expect(store.state.mountainCleared).toBe(false)
    store.defeatEnemy("guardian-flamethrower")
    expect(store.state.mountainCleared).toBe(true)
    expect(store.state.resources.iron).toBe(4)
    expect(store.state.resources.diamond).toBe(2)
    expect(store.state.inventory.some(({ id }) => id === "mountain-hollow-badge")).toBe(true)
    expect(store.defeatEnemy("guardian-flamethrower")).toBe(false)
    expect(store.state.resources.iron).toBe(4)
    expect(store.state.resources.diamond).toBe(2)
  })
})
