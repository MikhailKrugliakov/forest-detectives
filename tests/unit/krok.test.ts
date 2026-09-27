import { describe, expect, it } from "vitest"
import { GameStore } from "../../src/domain/GameStore"
import { scaledDifficultyValue, scaledEnemyHealth } from "../../src/domain/difficulty"
import { healingPotionState } from "../../src/domain/healing"
import { KROK_ERRAND_IDS, KROK_SIEGE_ENEMIES, siegeCleared } from "../../src/domain/krok"
import { PRODUCE } from "../../src/domain/produce"
import { SaveManager, type StorageLike } from "../../src/domain/saves"

function chapterThree(): GameStore {
  const store = new GameStore()
  store.selectCharacter("wolf")
  store.beginVillageChapter()
  store.defeatEnemy("turtle-guardian")
  store.beginChapterThree()
  return store
}

describe("Город Кроков и осада", () => {
  it("размещает ровно шесть снеговиков, четыре голема и три неподвижные катапульты без возрождения и трофеев", () => {
    expect(KROK_SIEGE_ENEMIES).toHaveLength(13)
    expect(new Set(KROK_SIEGE_ENEMIES.map(({ id }) => id)).size).toBe(13)
    expect(KROK_SIEGE_ENEMIES.filter(({ type }) => type === "snowman")).toHaveLength(6)
    expect(KROK_SIEGE_ENEMIES.filter(({ type }) => type === "ice-golem")).toHaveLength(4)
    expect(KROK_SIEGE_ENEMIES.filter(({ type }) => type === "ice-catapult")).toHaveLength(3)
    expect(KROK_SIEGE_ENEMIES.every(({ respawnMs, dropsGear }) => respawnMs === null && dropsGear === false)).toBe(true)
    expect(scaledEnemyHealth(KROK_SIEGE_ENEMIES.at(-1)!, "story")).toBe(6)
    expect(scaledDifficultyValue(18, "impossible")).toBe(27)
  })

  it("открывает ворота только после всех побед и выдаёт единственную награду после поражения", () => {
    const store = chapterThree()
    const startingGears = store.state.gears
    expect(store.canEnterIcePalace()).toBe(false)
    KROK_SIEGE_ENEMIES.slice(0, -1).forEach(({ id }) => store.defeatEnemy(id))
    expect(siegeCleared(store.state.defeatedEnemies)).toBe(false)
    expect(store.state.krokSiegeCleared).toBe(false)
    store.takeDamage(10_000)
    expect(store.state.defeatedEnemies.filter((id) => id.startsWith("siege-"))).toHaveLength(12)
    expect(store.defeatEnemy(KROK_SIEGE_ENEMIES.at(-1)!.id)).toBe(true)
    expect(store.state.krokSiegeCleared).toBe(true)
    expect(store.state.gears).toBe(startingGears + 8)
    expect(store.state.inventory.filter(({ id }) => id === "krok-defender-badge")).toHaveLength(1)
    expect(store.state.enemyGearDrops.filter(({ location }) => location === "krok-outskirts")).toHaveLength(0)
    expect(store.defeatEnemy(KROK_SIEGE_ENEMIES[0]!.id)).toBe(false)
    expect(store.state.gears).toBe(startingGears + 8)
    store.setLocation("ice-palace")
    expect(store.state.location).not.toBe("ice-palace")
  })

  it("выполняет поручения один раз и открывает дворец по поручению Принца", () => {
    const store = chapterThree()
    const startingGears = store.state.gears
    KROK_SIEGE_ENEMIES.forEach(({ id }) => store.defeatEnemy(id))
    expect(store.acceptPrinceQuest()).toBe(true)
    expect(store.canEnterIcePalace()).toBe(true)
    for (const id of KROK_ERRAND_IDS) {
      expect(store.acceptKrokErrand(id)).toBe(true)
      const target = { rivets: 4, tablets: 3, medicine: 3, "street-lamps": 4 }[id]
      for (let index = 1; index <= target; index += 1) expect(store.completeKrokTarget(id, `${id}-${index}`)).toBe(true)
      expect(store.completeKrokTarget(id, `${id}-1`)).toBe(false)
      expect(store.turnInKrokErrand(id)).toBe(true)
      expect(store.turnInKrokErrand(id)).toBe(false)
    }
    expect(store.state.gears).toBe(startingGears + 24)
    store.defeatEnemy("walrus-throne")
    expect(store.state.chapter).toBe(4)
    expect(store.state.princeQuest.status).toBe("ready")
    expect(store.turnInPrinceQuest()).toBe(true)
    expect(store.turnInPrinceQuest()).toBe(false)
    expect(store.state.gears).toBe(startingGears + 32)
    expect(store.state.inventory.filter(({ id }) => id === "krok-prince-seal")).toHaveLength(1)
  })

  it("покупает усиленные овощи и мгновенно восполняет только недостающие зелья", () => {
    const store = chapterThree()
    const startingGears = store.state.gears
    store.awardGears("market-budget", 12)
    expect(PRODUCE["dense-tomato"].damage).toBe(1.5)
    expect(PRODUCE["large-cucumber"].damage).toBe(2)
    expect(store.purchaseProduce("dense-tomato")).toBe(true)
    expect(store.purchaseProduce("large-cucumber")).toBe(true)
    expect(store.state.gears).toBe(startingGears + 1)
    expect(store.state.produceAmmo["dense-tomato"]).toBe(2)
    expect(store.equipWeapon("dense-tomato")).toBe(true)
    expect(store.cycleWeapon()).toBe("large-cucumber")
    expect(store.refillHealingPotions()).toBe(false)
    store.takeDamage(1)
    expect(store.useHealingPotion(1000).used).toBe(true)
    store.takeDamage(1)
    const beforeHealth = store.state.health
    expect(store.refillHealingPotions(1000)).toBe(true)
    expect(store.state.gears).toBe(startingGears - 2)
    expect(store.state.health).toBe(beforeHealth)
    expect(healingPotionState(store.state.healingPotionReadyAt, 1000).ready).toBe(3)
    expect(store.refillHealingPotions(1000)).toBe(false)
  })

  it("мигрирует v3, сохраняет Крок-прогресс в v5 и сбрасывает его новой игрой", () => {
    const values = new Map<string, string>()
    const storage: StorageLike = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
    const store = chapterThree()
    const manager = new SaveManager(store, storage)
    store.defeatEnemy(KROK_SIEGE_ENEMIES[0]!.id)
    manager.save("slot-1")
    const raw = JSON.parse(values.get("forest-detectives:save:v5:slot-1")!)
    raw.version = 3
    delete raw.session.krokSiegeCleared
    delete raw.session.krokSiegeRewardClaimed
    delete raw.session.krokErrands
    delete raw.session.princeQuest
    delete raw.session.produceAmmo["dense-tomato"]
    delete raw.session.produceAmmo["large-cucumber"]
    values.delete("forest-detectives:save:v5:slot-1")
    values.set("forest-detectives:save:v3:slot-1", JSON.stringify(raw))
    store.reset()
    expect(manager.load("slot-1").ok).toBe(true)
    expect(store.state.defeatedEnemies).toContain(KROK_SIEGE_ENEMIES[0]!.id)
    expect(store.state.krokSiegeCleared).toBe(false)
    expect(store.state.princeQuest.status).toBe("available")
    expect(store.state.produceAmmo["large-cucumber"]).toBe(0)
    expect(manager.read("slot-1")?.version).toBe(5)
    manager.startNewGame()
    expect(store.state.krokSiegeCleared).toBe(false)
    expect(store.state.krokErrands.rivets.completedTargets).toEqual([])
    expect(manager.read("slot-1")).not.toBeNull()
  })
})
