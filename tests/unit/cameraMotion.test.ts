import { describe, expect, it } from "vitest"
import { cameraFollowLerp } from "../../src/game/CameraMotion"

describe("camera motion", () => {
  it("keeps the same response at 30, 60, 120 and 144 Hz", () => {
    const residual = (hz: number) => Math.pow(1 - cameraFollowLerp(1000 / hz), hz)
    for (const hz of [30, 60, 120, 144]) expect(residual(hz)).toBeCloseTo(residual(60), 12)
    expect(cameraFollowLerp(1000 / 60)).toBeCloseTo(0.09, 12)
  })

  it("freezes on pause and never overshoots after a slow frame", () => {
    expect(cameraFollowLerp(5000, true)).toBe(0)
    for (const delta of [0, -1, NaN, Infinity]) expect(cameraFollowLerp(delta)).toBe(0)
    expect(cameraFollowLerp(1000)).toBeGreaterThan(0)
    expect(cameraFollowLerp(1000)).toBeLessThanOrEqual(1)
  })
})
