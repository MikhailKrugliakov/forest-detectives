import { describe, expect, it } from "vitest"
import { FACINGS } from "../../src/game/animation/catalog"
import { heroIdleOffsets, heroRunScale } from "../../src/game/animation/locomotionProfiles"

const CALIBRATION = [
  ["hero-wolf", [109, 105, 104, 103], [91.5, 83, 83, 85]],
  ["hero-fox", [108.5, 103, 103, 108], [107.5, 99, 102, 101]],
  ["hero-rabbit", [99, 96, 88, 86], [110, 107.5, 105.5, 106.5]],
  ["hero-watermelon", [83, 81.5, 82, 82], [112, 109.5, 107, 108]],
  ["hero-sheepwolf", [110.5, 112.5, 105, 108], [98, 95.5, 91.5, 91.5]],
] as const

describe("locomotion artwork profiles", () => {
  it.each(CALIBRATION)("calibrates all four run directions of %s with one stable coefficient", (key, walk, run) => {
    for (const [index, facing] of FACINGS.entries()) {
      const scale = heroRunScale(key, facing)
      expect(scale).toBe(walk[index]! / run[index]!)
      expect(scale).toBeGreaterThan(0.7)
      expect(scale).toBeLessThan(1.3)
      expect(heroRunScale(key, facing)).toBe(scale)
      expect(run[index]! * scale).toBeCloseTo(walk[index]!, 10)
    }
  })

  it.each(CALIBRATION)("keeps %s idle selections inside its original four-frame row", (key) => {
    for (const facing of FACINGS) {
      const offsets = heroIdleOffsets(key, facing)
      expect(offsets).toHaveLength(4)
      expect(offsets.every((offset) => Number.isInteger(offset) && offset >= 0 && offset <= 3)).toBe(true)
      expect(new Set(offsets).size).toBeGreaterThanOrEqual(3)
    }
  })

  it("omits the side poses that accidentally turn the character toward the camera", () => {
    expect(heroIdleOffsets("hero-rabbit", "left")).toEqual([0, 1, 2, 1])
    expect(heroIdleOffsets("hero-rabbit", "right")).not.toContain(3)
    expect(heroIdleOffsets("hero-watermelon", "left")).not.toContain(3)
    expect(heroIdleOffsets("hero-sheepwolf", "left")).toEqual([0, 1, 3, 1])
    expect(heroIdleOffsets("hero-sheepwolf", "left")).not.toContain(2)
  })

  it("leaves unaffected idle rows, non-hero scales and unknown actors unchanged", () => {
    for (const facing of FACINGS) {
      expect(heroIdleOffsets("hero-wolf", facing)).toEqual([0, 1, 2, 3])
      expect(heroIdleOffsets("hero-fox", facing)).toEqual([0, 1, 2, 3])
      expect(heroRunScale("robot-hare", facing)).toBe(1)
      expect(heroRunScale("unknown", facing)).toBe(1)
      expect(heroIdleOffsets("unknown", facing)).toEqual([0, 1, 2, 3])
    }
  })
})
