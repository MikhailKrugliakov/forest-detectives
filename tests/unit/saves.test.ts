import { describe, expect, it } from "vitest"
import { GameStore } from "../../src/domain/GameStore"
import { SaveManager, type StorageLike } from "../../src/domain/saves"

function createStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe("сохранение игры", () => {
  it("полностью восстанавливает сессию и актуальное определение героя", () => {
    const storage = createStorage()
    const store = new GameStore()
    const saves = new SaveManager(store, storage)
    store.selectCharacter("rabbit")
    store.beginVillageChapter()
    store.awardGears("test", 7)
    store.defeatEnemy("boar-3")
    store.setLocation("mountain-hollow")
    store.defeatEnemy("beetle-1", Date.now() + 1_000)
    const mineSeed = store.state.mineSeed
    expect(saves.save("slot-1").ok).toBe(true)

    store.reset()
    expect(saves.load("slot-1").ok).toBe(true)
    expect(store.state.character?.id).toBe("rabbit")
    expect(store.state.location).toBe("mountain-hollow")
    expect(store.state.gears).toBe(7)
    expect(store.state.mineSeed).toBe(mineSeed)
    expect(store.state.mountainEnemyDefeats).toBe(1)
    expect(store.state.enemyGearDrops.at(-1)?.location).toBe("mountain-hollow")
  })

  it("автосохраняется при переходах, но не при событиях внутри локации", () => {
    const storage = createStorage()
    const store = new GameStore()
    const saves = new SaveManager(store, storage)
    saves.bindAutosave()
    store.selectCharacter("wolf")
    const selected = saves.read("auto")
    expect(selected?.summary.location).toBe("forest-clearing")
    store.collectClue("ribbon")
    expect(saves.read("auto")?.session.puzzle.foundClues).toEqual([])
    store.beginVillageChapter()
    expect(saves.read("auto")?.summary.location).toBe("forest-village")
    expect(saves.read("auto")?.session.puzzle.foundClues).toEqual(["ribbon"])
  })

  it("хранит три независимых ручных слота и не удаляет их при новой игре", () => {
    const storage = createStorage()
    const store = new GameStore()
    const saves = new SaveManager(store, storage)
    saves.bindAutosave()
    store.selectCharacter("fox")
    expect(saves.save("slot-1").ok).toBe(true)
    store.beginVillageChapter()
    expect(saves.save("slot-2").ok).toBe(true)
    store.setLocation("wild-forest")
    expect(saves.save("slot-3").ok).toBe(true)
    expect(saves.read("auto")).not.toBeNull()
    saves.startNewGame()
    expect(saves.read("auto")).toBeNull()
    expect(saves.read("slot-1")?.summary.location).toBe("forest-clearing")
    expect(saves.read("slot-2")?.summary.location).toBe("forest-village")
    expect(saves.read("slot-3")?.summary.location).toBe("wild-forest")
  })

  it("безопасно отклоняет повреждённое и несовместимое сохранение", () => {
    const storage = createStorage()
    const store = new GameStore()
    const saves = new SaveManager(store, storage)
    storage.setItem("forest-detectives:save:v1:slot-1", "not-json")
    storage.setItem("forest-detectives:save:v1:slot-2", JSON.stringify({ version: 99, slot: "slot-2" }))
    expect(saves.load("slot-1").ok).toBe(false)
    expect(saves.load("slot-2").ok).toBe(false)
    expect(store.state.character).toBeNull()
  })

  it("сбрасывает истёкшие таймеры возрождения при загрузке", () => {
    const storage = createStorage()
    const store = new GameStore()
    const saves = new SaveManager(store, storage)
    store.selectCharacter("fox")
    store.defeatEnemy("beetle-1", Date.now() - 61_000)
    saves.save("slot-1")
    store.reset()
    saves.load("slot-1")
    expect(store.state.enemyRespawnAt["beetle-1"]).toBeUndefined()
  })
})
