import { describe, expect, it } from "vitest"
import { facingFromMovement } from "../../src/game/animation/catalog"
import { ResolvedMotion } from "../../src/game/animation/ResolvedMotion"

describe("collision-resolved visual motion", () => {
  it("clamps interpolation and never extrapolates beyond either solved position", () => {
    const motion = new ResolvedMotion(10, 20)
    motion.capture(14, 22)
    motion.render(14, 22, -1)
    expect(motion.position).toEqual({ x: 10, y: 20 })
    motion.render(14, 22, 0.5)
    expect(motion.position).toEqual({ x: 12, y: 21 })
    motion.render(14, 22, 2)
    expect(motion.position).toEqual({ x: 14, y: 22 })
  })

  it("snaps a manual correction and a teleport without changing the camera target object", () => {
    const motion = new ResolvedMotion(10, 20)
    const target = motion.position
    motion.capture(14, 22)
    motion.render(15, 22, 0.1)
    expect(motion.position).toEqual({ x: 15, y: 22 })
    motion.capture(500, 600)
    motion.render(500, 600, 0)
    expect(motion.position).toBe(target)
    expect(motion.position).toEqual({ x: 500, y: 600 })
  })

  it("keeps the facing axis stable on diagonal noise but responds to a real turn", () => {
    let facing = facingFromMovement(3, 0, "down")
    for (const [x, y] of [[3, 3.00001], [3.00001, 3], [2.9, 3.1], [3.1, 2.9]]) {
      facing = facingFromMovement(x!, y!, facing)
      expect(facing).toBe("right")
    }
    expect(facingFromMovement(1, 3, facing)).toBe("down")
    expect(facingFromMovement(-3, 3.00001, facing)).toBe("left")
    expect(facingFromMovement(0, 0, "left")).toBe("left")
  })
})
