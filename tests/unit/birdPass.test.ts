import { describe, expect, it } from "vitest"
import { BIRD_PASS_ENEMIES, BIRD_PASS_TURTLE_ID, turtlePhase } from "../../src/domain/birdPass"
import { GameStore } from "../../src/domain/GameStore"

describe("Птичий перевал", () => {
  it("содержит 18 уникальных робоптиц и одного постоянного босса", () => {
    expect(BIRD_PASS_ENEMIES).toHaveLength(19)
    expect(new Set(BIRD_PASS_ENEMIES.map(({ id }) => id)).size).toBe(19)
    expect(BIRD_PASS_ENEMIES.filter(({ type }) => type === "robot-sparrow")).toHaveLength(6)
    expect(BIRD_PASS_ENEMIES.filter(({ type }) => type === "robot-owl")).toHaveLength(6)
    expect(BIRD_PASS_ENEMIES.filter(({ type }) => type === "robot-hawk")).toHaveLength(6)
    expect(BIRD_PASS_ENEMIES.filter(({ rank }) => rank === "weak")).toHaveLength(0)
    expect(BIRD_PASS_ENEMIES.find(({ id }) => id === BIRD_PASS_TURTLE_ID)).toMatchObject({ hp: 45, rank: "boss", respawnMs: null })
  })

  it("использует точные характеристики и таймеры робоптиц", () => {
    expect(BIRD_PASS_ENEMIES.find(({ id }) => id === "sparrow-1")).toMatchObject({ hp: 5, damage: 14, speed: 125, rank: "normal", respawnMs: 60_000 })
    expect(BIRD_PASS_ENEMIES.find(({ id }) => id === "owl-1")).toMatchObject({ hp: 7, damage: 18, speed: 90, rank: "strong", respawnMs: 90_000 })
    expect(BIRD_PASS_ENEMIES.find(({ id }) => id === "hawk-1")).toMatchObject({ hp: 9, damage: 22, speed: 135, rank: "strong", respawnMs: 90_000 })
  })

  it("определяет три фазы Бронепанциря по относительному здоровью", () => {
    expect(turtlePhase(45, 45)).toBe(1)
    expect(turtlePhase(30, 45)).toBe(2)
    expect(turtlePhase(15, 45)).toBe(3)
    expect(turtlePhase(0, 45)).toBe("defeated")
  })

  it("ведёт отдельный счётчик, повторно роняет шестерёнки и завершает главу только черепахой", () => {
    const store = new GameStore()
    store.selectCharacter("sheepwolf")
    store.beginVillageChapter()
    store.acceptQuest("robot-sweep")
    expect(store.defeatEnemy("sparrow-1", 1_000)).toBe(true)
    expect(store.defeatEnemy("sparrow-1", 61_000)).toBe(false)
    expect(store.state.birdPassEnemyDefeats).toBe(2)
    expect(store.state.enemyGearDrops.filter(({ enemyId }) => enemyId === "sparrow-1")).toHaveLength(2)
    expect(store.questProgress("robot-sweep")).toBe(0)
    expect(store.state.chapterTwoCompleted).toBe(false)

    store.defeatEnemy(BIRD_PASS_TURTLE_ID)
    expect(store.state.birdPassCleared).toBe(true)
    expect(store.state.chapterTwoCompleted).toBe(true)
    expect(store.state.gears).toBe(8)
    expect(store.state.inventory.some(({ id }) => id === "bird-pass-badge")).toBe(true)
    expect(store.defeatEnemy(BIRD_PASS_TURTLE_ID)).toBe(false)
    expect(store.state.gears).toBe(8)
    expect(store.beginChapterThree()).toBe(true)
    expect(store.state.chapter).toBe(3)
    expect(store.state.location).toBe("forest-village")
    expect(store.state.entryFrom).toBe("bird-pass")
  })

  it("новая игра сбрасывает сложность, перевал и третью главу", () => {
    const store = new GameStore()
    store.selectCharacter("fox")
    store.setDifficulty("walk")
    store.defeatEnemy(BIRD_PASS_TURTLE_ID)
    store.beginChapterThree()
    store.reset()
    expect(store.state.difficulty).toBe("hard")
    expect(store.state.chapter).toBe(1)
    expect(store.state.birdPassEnemyDefeats).toBe(0)
    expect(store.state.birdPassCleared).toBe(false)
    expect(store.state.birdPassRewardClaimed).toBe(false)
    expect(store.state.chapterTwoCompleted).toBe(false)
  })
})
