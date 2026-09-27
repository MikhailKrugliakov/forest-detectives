import { describe, expect, it } from "vitest"
import { GameStore } from "../../src/domain/GameStore"
import { GADGETS, TOTAL_GADGET_COST } from "../../src/domain/gadgets"
import { BUILDING_MATERIALS, TOTAL_BUILDING_MATERIAL_COST } from "../../src/domain/materials"
import { PRODUCE } from "../../src/domain/produce"
import { chapterPrice } from "../../src/domain/economy"
import type { ChapterId } from "../../src/domain/types"

describe("магазин и деревенская экономика", () => {
  it("задаёт цены на четыре гаджета общей стоимостью 38", () => {
    expect(GADGETS.jetpack.price).toBe(12)
    expect(GADGETS["magnetic-glove"].price).toBe(8)
    expect(GADGETS["gas-mask"].durationMs).toBe(8000)
    expect(GADGETS["pulse-shield"].cooldownMs).toBe(6000)
    expect(TOTAL_GADGET_COST).toBe(38)
  })

  it("не начисляет одну награду дважды и не допускает покупку в минус", () => {
    const store = new GameStore()
    store.selectCharacter("fox")
    expect(store.awardGears("test", 12)).toBe(true)
    expect(store.awardGears("test", 12)).toBe(false)
    expect(store.purchaseGadget("jetpack")).toBe(true)
    expect(store.purchaseGadget("jetpack")).toBe(false)
    expect(store.purchaseGadget("pulse-shield")).toBe(false)
    expect(store.state.gears).toBe(0)
    expect(store.state.equippedGadget).toBe("jetpack")
  })

  it("экипирует только купленное устройство", () => {
    const store = new GameStore()
    store.selectCharacter("wolf")
    expect(store.equipGadget("gas-mask")).toBe(false)
    store.awardGears("allowance", 20)
    store.purchaseGadget("gas-mask")
    expect(store.equipGadget("gas-mask")).toBe(true)
    expect(store.state.equippedGadget).toBe("gas-mask")
  })

  it("выдаёт двенадцать шестерёнок за три поручения", () => {
    const store = new GameStore()
    store.selectCharacter("rabbit")
    for (const [id, targets] of [
      ["garden-beds", ["bed-1", "bed-2", "bed-3"]],
      ["bakery-delivery", ["squirrel", "owl"]],
      ["village-lanterns", ["lamp-1", "lamp-2", "lamp-3", "lamp-4"]],
    ] as const) {
      store.acceptErrand(id)
      targets.forEach((target) => store.completeErrandTarget(id, target))
      expect(store.turnInErrand(id)).toBe(true)
    }
    expect(store.state.gears).toBe(12)
  })

  it("выдаёт награды за три поручения западного района только один раз", () => {
    const store = new GameStore()
    store.selectCharacter("sheepwolf")
    for (const [id, targets] of [
      ["mushroom-hunt", ["mushroom-1", "mushroom-2", "mushroom-3"]],
      ["fence-repair", ["fence-1", "fence-2", "fence-3"]],
      ["trail-signs", ["sign-1", "sign-2", "sign-3"]],
    ] as const) {
      expect(store.acceptErrand(id)).toBe(true)
      targets.forEach((target) => expect(store.completeErrandTarget(id, target)).toBe(true))
      expect(store.turnInErrand(id)).toBe(true)
      expect(store.turnInErrand(id)).toBe(false)
    }
    expect(store.state.gears).toBe(12)
    expect(store.state.inventory.filter(({ id }) => ["mushroom-token", "carpenter-ribbon", "trail-compass"].includes(id))).toHaveLength(3)
  })

  it("Бобр продаёт два одноразовых комплекта материалов атомарно", () => {
    expect(BUILDING_MATERIALS["collapsing-floor"].price).toBe(5)
    expect(BUILDING_MATERIALS["falling-wall"].price).toBe(7)
    expect(TOTAL_BUILDING_MATERIAL_COST).toBe(12)

    const store = new GameStore()
    store.selectCharacter("watermelon")
    store.awardGears("materials-budget", 12)
    expect(store.purchaseBuildingMaterial("collapsing-floor")).toBe(true)
    expect(store.purchaseBuildingMaterial("collapsing-floor")).toBe(false)
    expect(store.purchaseBuildingMaterial("falling-wall")).toBe(true)
    expect(store.state.gears).toBe(0)
    expect(store.state.ownedBuildingMaterials).toEqual(["collapsing-floor", "falling-wall"])
    expect(store.state.inventory.filter(({ type }) => type === "building-material")).toHaveLength(2)
  })

  it("покупает овощи пачками, переключает оружие и расходует боезапас", () => {
    expect(PRODUCE.tomato.price).toBe(1)
    expect(PRODUCE.tomato.packSize).toBe(2)
    expect(PRODUCE.tomato.damage).toBe(0.5)

    const store = new GameStore()
    store.selectCharacter("fox")
    expect(store.equipWeapon("tomato")).toBe(false)
    store.awardGears("vegetable-budget", 2)
    expect(store.purchaseProduce("tomato")).toBe(true)
    expect(store.purchaseProduce("tomato")).toBe(true)
    expect(store.purchaseProduce("cucumber")).toBe(false)
    expect(store.state.produceAmmo.tomato).toBe(4)
    expect(store.state.gears).toBe(0)

    expect(store.cycleWeapon()).toBe("tomato")
    for (let shot = 0; shot < 4; shot += 1) expect(store.consumeProduceShot()).toBe("tomato")
    expect(store.state.produceAmmo.tomato).toBe(0)
    expect(store.state.equippedWeapon).toBe("melee")
    expect(store.consumeProduceShot()).toBeNull()
  })
})

describe("цены по достигнутой главе", () => {
  it("считает исходную цену и округляет только окончательный результат", () => {
    expect(([1, 2, 3, 4] as ChapterId[]).map((chapter) => chapterPrice(12, chapter))).toEqual([12, 12, 18, 27])
    expect(([1, 2, 3, 4] as ChapterId[]).map((chapter) => chapterPrice(1, chapter))).toEqual([1, 1, 2, 3])
    expect(chapterPrice(5, 4)).toBe(12)
    expect(chapterPrice(7, 4)).toBe(16)
  })

  it.each([1, 2, 3, 4] as ChapterId[])("проверяет и списывает одинаковую цену всех категорий в главе %i", (chapter) => {
    const store = new GameStore()
    store.selectCharacter("wolf")
    const session = store.exportSerializedSession()
    session.chapter = chapter
    store.restoreSerializedSession(session)
    const purchases = [
      { base: GADGETS.jetpack.price, buy: () => store.purchaseGadget("jetpack") },
      { base: BUILDING_MATERIALS["falling-wall"].price, buy: () => store.purchaseBuildingMaterial("falling-wall") },
      { base: PRODUCE.cucumber.price, buy: () => store.purchaseProduce("cucumber") },
    ]
    purchases.forEach(({ base, buy }, index) => {
      const price = chapterPrice(base, chapter)
      store.awardGears(`budget-${index}`, price - 1)
      expect(buy()).toBe(false)
      store.awardGears(`last-gear-${index}`, 1)
      expect(store.shopPrice(base)).toBe(price)
      expect(buy()).toBe(true)
      expect(store.state.gears).toBe(0)
    })
    const now = Date.now()
    store.takeDamage(10)
    store.useHealingPotion(now)
    store.takeDamage(10)
    store.useHealingPotion(now)
    const refillPrice = chapterPrice(2, chapter) * 2
    expect(store.potionRefillPrice(now)).toBe(refillPrice)
    store.awardGears("refill-budget", refillPrice - 1)
    expect(store.refillHealingPotions(now)).toBe(false)
    store.awardGears("refill-last", 1)
    expect(store.refillHealingPotions(now)).toBe(true)
    expect(store.state.gears).toBe(0)
    expect(store.state.healingPotionReadyAt).toEqual([])
  })
})
