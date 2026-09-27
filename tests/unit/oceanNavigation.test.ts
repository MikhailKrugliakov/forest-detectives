import { describe, expect, it } from "vitest"
import { BEACH_SCRAP, OCEAN_ENEMIES } from "../../src/domain/ocean"
import { isOnRoad } from "../../src/domain/roads"
import { OCEAN_ARENA, OCEAN_BRANCH_POINTS, OCEAN_ENTRY, OCEAN_EXIT, OCEAN_MECHANISM, OCEAN_ROAD_NETWORK, OCEAN_ROUTE_POINTS, OCEAN_ROADS } from "../../src/game/data/oceanLayout"

describe("ocean navigation geometry", () => {
  it("connects every main-road and branch cross section with hero clearance", () => {
    for (const network of Object.values(OCEAN_ROADS)) for (const { from, to } of network.segments) {
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 15)
      for (let step = 0; step <= steps; step++) {
        const x = from.x + (to.x - from.x) * step / steps, y = from.y + (to.y - from.y) * step / steps
        // Test the entire hero footbox, including the body offset below its anchor.
        for (const dx of [-30, 0, 30]) for (const dy of [-20, 0, 55]) expect(isOnRoad(network, x + dx, y + dy)).toBe(true)
      }
    }
    for (const [junction] of OCEAN_BRANCH_POINTS) expect(OCEAN_ROUTE_POINTS.some((point) => point.x === junction!.x && point.y === junction!.y)).toBe(true)
  })
  it("places both ends, loot, enemies and mechanism on the connected playable surface", () => {
    for (const network of Object.values(OCEAN_ROADS)) for (const point of [OCEAN_ENTRY, OCEAN_EXIT, OCEAN_MECHANISM]) expect(isOnRoad(network, point.x, point.y)).toBe(true)
    for (const point of BEACH_SCRAP) expect(isOnRoad(OCEAN_ROADS.beach, point.x, point.y)).toBe(true)
    for (const enemy of OCEAN_ENEMIES) expect(isOnRoad(OCEAN_ROADS[enemy.location as keyof typeof OCEAN_ROADS], enemy.x, enemy.y)).toBe(true)
  })
  it("keeps the boss movement and warning centers inside the open arena", () => {
    for (let x = OCEAN_ARENA.left; x <= OCEAN_ARENA.right; x += 30) for (let y = OCEAN_ARENA.top; y <= OCEAN_ARENA.bottom; y += 30) {
      expect(isOnRoad(OCEAN_ROAD_NETWORK, x, y)).toBe(true)
    }
  })
})
