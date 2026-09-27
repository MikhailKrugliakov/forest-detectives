import { describe, expect, it } from "vitest"
import { GameStore } from "../../src/domain/GameStore"
import { scaledEnemyHealth, scaledDifficultyValue } from "../../src/domain/difficulty"
import { SNOW_CITY_ROADS, SNOW_VALLEY_ROADS, isOnRoad } from "../../src/domain/roads"
import {
  ICE_PALACE_ENEMIES,
  SNOW_CITY_ENEMIES,
  SNOW_ENEMIES,
  SNOW_VALLEY_ENEMIES,
  WALRUS,
  WALRUS_ATTACKS,
  WALRUS_ID,
  walrusPhase,
} from "../../src/domain/snow"

describe("снежная цепочка", () => {
  it("содержит нужное число уникальных врагов и ранги", () => {
    expect(SNOW_VALLEY_ENEMIES).toHaveLength(18)
    expect(SNOW_CITY_ENEMIES).toHaveLength(18)
    expect(ICE_PALACE_ENEMIES).toHaveLength(12)
    expect(new Set(SNOW_ENEMIES.map(({ id }) => id)).size).toBe(49)
    expect(SNOW_VALLEY_ENEMIES.filter(({ rank }) => rank === "weak")).toHaveLength(6)
    expect(SNOW_VALLEY_ENEMIES.filter(({ rank }) => rank === "normal")).toHaveLength(6)
    expect(SNOW_VALLEY_ENEMIES.filter(({ rank }) => rank === "strong")).toHaveLength(6)
    expect(SNOW_CITY_ENEMIES.filter(({ rank }) => rank === "strong")).toHaveLength(6)
    expect(ICE_PALACE_ENEMIES.every(({ rank, type }) => rank === "strong" && type === "ice-golem")).toBe(true)
  })

  it("соблюдает характеристики, таймеры и уровень сложности", () => {
    const ball = SNOW_VALLEY_ENEMIES.find(({ type }) => type === "snowball")!
    const man = SNOW_VALLEY_ENEMIES.find(({ type }) => type === "snowman")!
    const bird = SNOW_VALLEY_ENEMIES.find(({ type }) => type === "robot-albatross")!
    const snowGolem = SNOW_CITY_ENEMIES.find(({ type }) => type === "snow-golem")!
    const iceGolem = ICE_PALACE_ENEMIES[0]!
    expect([ball.hp, ball.damage, ball.respawnMs]).toEqual([2, 9, 30_000])
    expect([man.hp, man.damage, man.respawnMs]).toEqual([5, 16, 60_000])
    expect([bird.hp, bird.damage, bird.respawnMs]).toEqual([8, 22, 90_000])
    expect([snowGolem.hp, snowGolem.damage]).toEqual([9, 24])
    expect([iceGolem.hp, iceGolem.damage]).toEqual([13, 28])
    expect(scaledEnemyHealth(WALRUS, "hard")).toBe(78)
    expect(scaledEnemyHealth(WALRUS, "story")).toBe(31)
    expect(scaledDifficultyValue(WALRUS_ATTACKS.tail, "impossible")).toBe(63)
    expect(WALRUS.respawnMs).toBeNull()
  })

  it("только робоальбатросы оставляют физические шестерёнки", () => {
    const store = new GameStore()
    store.selectCharacter("wolf")
    for (const id of ["valley-1", "valley-7", "city-13", "palace-1"]) store.defeatEnemy(id)
    expect(store.state.enemyGearDrops.filter(({ location }) => location === "snow-valley")).toHaveLength(0)
    expect(store.state.snowValleyEnemyDefeats).toBe(2)
    expect(store.state.snowCityEnemyDefeats).toBe(1)
    expect(store.state.icePalaceEnemyDefeats).toBe(1)
    store.defeatEnemy("valley-13")
    store.defeatEnemy("valley-13")
    expect(store.state.enemyGearDrops.filter(({ location }) => location === "snow-valley")).toHaveLength(2)
    expect(store.state.wildForestEnemyDefeats).toBe(0)
  })

  it("Морж переходит через три фазы и запускает главу 4 только один раз", () => {
    expect(walrusPhase(78, 78)).toBe(1)
    expect(walrusPhase(52, 78)).toBe(2)
    expect(walrusPhase(26, 78)).toBe(3)
    expect(walrusPhase(0, 78)).toBe("defeated")
    const store = new GameStore()
    store.selectCharacter("wolf")
    store.beginVillageChapter()
    store.defeatEnemy("turtle-guardian")
    store.beginChapterThree()
    expect(store.defeatEnemy(WALRUS_ID)).toBe(true)
    expect(store.state.chapter).toBe(4)
    expect(store.state.walrusCleared).toBe(true)
    expect(store.state.inventory.filter(({ id }) => id === "ice-palace-badge")).toHaveLength(1)
    expect(store.defeatEnemy(WALRUS_ID)).toBe(false)
    expect(store.beginChapterThree()).toBe(false)
    expect(store.state.chapter).toBe(4)
    expect(store.state.inventory.filter(({ id }) => id === "ice-palace-badge")).toHaveLength(1)
    expect(store.state.enemyGearDrops.some(({ enemyId }) => enemyId === WALRUS_ID)).toBe(false)
  })

  it("дороги начинаются и заканчиваются у переходов", () => {
    for (const road of [SNOW_VALLEY_ROADS, SNOW_CITY_ROADS]) {
      expect(isOnRoad(road, 180, 800)).toBe(true)
      expect(isOnRoad(road, 4620, 800)).toBe(true)
      expect(isOnRoad(road, 1200, 100)).toBe(false)
    }
    expect(isOnRoad(SNOW_VALLEY_ROADS, 2450, 930)).toBe(true)
    expect(isOnRoad(SNOW_VALLEY_ROADS, 2450, 650)).toBe(false)
  })

  it("новая игра сбрасывает снежные победы, Моржа и награду", () => {
    const store = new GameStore()
    store.selectCharacter("wolf")
    store.beginVillageChapter()
    store.defeatEnemy("turtle-guardian")
    store.beginChapterThree()
    store.defeatEnemy("valley-13")
    store.defeatEnemy("city-1")
    store.defeatEnemy("palace-1")
    store.defeatEnemy(WALRUS_ID)
    store.reset()
    expect(store.state.chapter).toBe(1)
    expect([store.state.snowValleyEnemyDefeats, store.state.snowCityEnemyDefeats, store.state.icePalaceEnemyDefeats]).toEqual([0, 0, 0])
    expect(store.state.walrusCleared).toBe(false)
    expect(store.state.walrusRewardClaimed).toBe(false)
    expect(store.state.inventory).toHaveLength(0)
  })
})
