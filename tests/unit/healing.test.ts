import { describe, expect, it } from "vitest"
import { GameStore } from "../../src/domain/GameStore"
import {
  HEALING_POTION_RECHARGE_MS,
  healingPotionAmount,
  healingPotionState,
} from "../../src/domain/healing"

describe("лечебные зелья", () => {
  it("восстанавливает 33 процента максимального здоровья", () => {
    expect(healingPotionAmount(100)).toBe(33)
    expect(healingPotionAmount(92)).toBe(31)
  })

  it("имеет три независимо восстанавливающихся заряда", () => {
    const store = new GameStore()
    store.selectCharacter("sheepwolf")
    store.beginVillageChapter()
    store.takeDamage(99)
    const startedAt = Date.now() + 10_000

    expect(store.useHealingPotion(startedAt)).toMatchObject({ used: true, healed: 33, ready: 2 })
    expect(store.useHealingPotion(startedAt + 10_000)).toMatchObject({ used: true, healed: 33, ready: 1 })
    expect(store.useHealingPotion(startedAt + 20_000)).toMatchObject({ used: true, healed: 33, ready: 0 })

    store.takeDamage(10)
    expect(store.useHealingPotion(startedAt + 30_000)).toMatchObject({ used: false, reason: "recharging", ready: 0 })
    expect(healingPotionState(store.state.healingPotionReadyAt, startedAt + HEALING_POTION_RECHARGE_MS + 1)).toMatchObject({ ready: 1 })
  })

  it("не расходует заряд при полном здоровье", () => {
    const store = new GameStore()
    store.selectCharacter("fox")
    const result = store.useHealingPotion(Date.now())
    expect(result).toMatchObject({ used: false, reason: "full-health", ready: 3 })
    expect(store.state.healingPotionReadyAt).toEqual([])
  })
})
