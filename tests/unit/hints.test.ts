import { describe, expect, it } from "vitest"
import { buildHint, canAnalyze } from "../../src/domain/rules"

const twoClues = ["parcel-print", "ribbon"] as const

describe("интеллектуальные подсказки", () => {
  it("не анализирует меньше двух улик", () => {
    expect(canAnalyze(["parcel-print"])).toBe(false)
    expect(buildHint(10, ["parcel-print"])).toContain("хотя бы две")
  })

  it("даёт Зайчонку точную связь и направление", () => {
    expect(buildHint(10, twoClues)).toContain("нор")
  })

  it("даёт Лисичке промежуточную подсказку", () => {
    const hint = buildHint(8, twoClues)
    expect(hint).toContain("направление")
    expect(hint).not.toContain("именно там")
  })

  it("не раскрывает ответ героям с интеллектом 5", () => {
    const hint = buildHint(5, twoClues)
    expect(hint).toContain("дорожку")
    expect(hint).not.toContain("норе")
  })
})
