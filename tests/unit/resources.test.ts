import { afterEach, describe, expect, it, vi } from "vitest"
import { GameStore } from "../../src/domain/GameStore"
import { createMineOreLayout, MINE_ENTRANCES, PICKAXE_RECIPE, SCRAP_GEAR_REWARD } from "../../src/domain/resources"

describe("ресурсы и лесная шахта", () => {
  afterEach(() => vi.restoreAllMocks())

  it("выдаёт за каждый уникальный тайник хлама десять шестерёнок", () => {
    const store = new GameStore()
    store.selectCharacter("fox")
    expect(SCRAP_GEAR_REWARD).toBe(10)
    expect(store.collectResource("scrap-a", "scrap")).toBe(true)
    expect(store.collectResource("scrap-a", "scrap")).toBe(false)
    expect(store.state.resources.scrap).toBe(1)
    expect(store.state.gears).toBe(10)
  })

  it("создаёт кирку только по полному рецепту и атомарно списывает материалы", () => {
    expect(PICKAXE_RECIPE).toEqual({ stone: 3, stick: 2, rope: 1, scrap: 1 })
    const store = new GameStore()
    store.selectCharacter("rabbit")
    expect(store.craftPickaxe()).toBe(false)
    for (let index = 1; index <= 3; index += 1) store.collectResource(`stone-${index}`, "stone")
    for (let index = 1; index <= 2; index += 1) store.collectResource(`stick-${index}`, "stick")
    store.collectResource("rope-1", "rope")
    store.collectResource("scrap-1", "scrap")
    expect(store.canCraftPickaxe()).toBe(true)
    expect(store.craftPickaxe()).toBe(true)
    expect(store.craftPickaxe()).toBe(false)
    expect(store.state.resources).toMatchObject({ stone: 0, stick: 0, rope: 0, scrap: 0 })
    expect(store.state.hasPickaxe).toBe(true)
    expect(store.state.inventory.filter(({ id }) => id === "pickaxe")).toHaveLength(1)
  })

  it("не позволяет добыть руду без кирки", () => {
    const store = new GameStore()
    store.selectCharacter("wolf")
    expect(store.collectResource("ore-1", "iron")).toBe(false)
    expect(store.collectResource("ore-2", "diamond")).toBe(false)
    for (let index = 1; index <= 3; index += 1) store.collectResource(`rock-${index}`, "stone")
    for (let index = 1; index <= 2; index += 1) store.collectResource(`branch-${index}`, "stick")
    store.collectResource("cord", "rope")
    store.collectResource("junk", "scrap")
    store.craftPickaxe()
    expect(store.collectResource("ore-1", "iron")).toBe(true)
    expect(store.collectResource("ore-2", "diamond")).toBe(true)
  })

  it("стабильно перемешивает три алмазные и восемь железных жил по seed", () => {
    const ids = Array.from({ length: 11 }, (_, index) => `ore-${index + 1}`)
    const first = createMineOreLayout(123, ids)
    const repeated = createMineOreLayout(123, ids)
    const another = createMineOreLayout(987, ids)
    expect(first).toEqual(repeated)
    expect(first).not.toEqual(another)
    expect(first.filter(({ resourceId }) => resourceId === "diamond")).toHaveLength(3)
    expect(first.filter(({ resourceId }) => resourceId === "iron")).toHaveLength(8)
  })

  it("выбирает вход в шахту заново при генерации новой игры", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    const first = new GameStore()
    expect(first.state.mineEntranceIndex).toBe(0)
    vi.mocked(Math.random).mockReturnValue(0.999999)
    const second = new GameStore()
    expect(second.state.mineEntranceIndex).toBe(MINE_ENTRANCES.length - 1)
  })
})
