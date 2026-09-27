import { describe, expect, it } from "vitest"
import { HeroGait, gaitLeg } from "../../src/game/animation/HeroGait"
import { FACINGS } from "../../src/game/animation/catalog"
import { heroRigLayout } from "../../src/game/animation/heroRigs"

describe("continuous two-foot locomotion", () => {
  it.each(FACINGS)("moves each foot both forward and backward when facing %s", (facing) => {
    const forward = gaitLeg(0, 0, facing, 30, false)
    const backward = gaitLeg(.5, 0, facing, 30, false)
    if (facing === "left" || facing === "right") {
      expect(forward.footX * backward.footX).toBeLessThan(0)
      expect(Math.abs(forward.footX - backward.footX)).toBeGreaterThan(20)
      expect(gaitLeg(0, 1, facing, 30, false).footX).toBeCloseTo(backward.footX)
    } else {
      expect((forward.footY - 30) * (backward.footY - 30)).toBeLessThan(0)
      expect(gaitLeg(0, 1, facing, 30, false).footY).toBeCloseTo(backward.footY)
    }
    expect(gaitLeg(1, 0, facing, 30, false)).toEqual(forward)
    expect(gaitLeg(.25, 0, facing, 30, false).lift).toBe(0)
    expect(gaitLeg(.75, 0, facing, 30, false).lift).toBeGreaterThan(0)
  })

  it("advances only by resolved movement and freezes during pause or against a wall", () => {
    const gait = new HeroGait()
    gait.advance(20, 100, true, false)
    const phase = gait.phase
    gait.advance(0, 1000, false, false)
    expect(gait.phase).toBe(phase)
    expect(gait.amount).toBe(0)
    gait.advance(20, 100, true, false)
    const paused = { phase: gait.phase, amount: gait.amount }
    gait.advance(500, 5000, true, true, 1, true)
    expect({ phase: gait.phase, amount: gait.amount }).toEqual(paused)
    gait.advance(150, 16, true, false)
    expect(gait.phase).toBe(0)
    expect(gait.amount).toBe(0)
  })

  it("keeps phase independent of rendering frequency and preserves it when changing pace", () => {
    const positions = [30, 60, 120, 144].map((hz) => {
      const gait = new HeroGait()
      for (let i = 0; i < hz; i++) gait.advance(160 / hz, 1000 / hz, true, false)
      const before = gait.phase
      gait.advance(0, 0, true, true)
      expect(gait.phase).toBe(before)
      return gait.phase
    })
    for (const phase of positions) expect(phase).toBeCloseTo(positions[0]!, 10)
  })

  it("registers both hips to the same fixed floor in every hero direction", () => {
    for (const hero of ["wolf", "fox", "rabbit", "watermelon", "sheepwolf"]) for (const facing of FACINGS) {
      const layout = heroRigLayout(`hero-${hero}`, facing)
      for (const hip of layout.hips) expect(hip.y + layout.legLength).toBe(118)
      expect(layout.hips[0].x).toBeLessThan(layout.hips[1].x)
    }
  })
})
