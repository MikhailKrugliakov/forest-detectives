import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { VILLAGE_SEA_PATH, VILLAGE_ENTRY_SPAWNS, VILLAGE_OCEAN_OWL } from "../../src/domain/villageLayout"

const map = JSON.parse(readFileSync(new URL("../../public/assets/maps/forest-village.tmj", import.meta.url), "utf8"))
const obstacles = map.layers.find((layer: { name: string }) => layer.name === "collisions").objects as { name: string; x: number; y: number; width: number; height: number }[]
function blockers(x: number, y: number) {
  // Full collision footprint, including the foot offset, with extra clearance.
  return obstacles.filter(rect => x + 30 > rect.x && x - 30 < rect.x + rect.width && y + 52 > rect.y && y - 8 < rect.y + rect.height).map(rect => rect.name)
}
describe("village northern ocean road", () => {
  it("has clear full-body passage along both sides of every segment and at every join", () => {
    for (let segment = 1; segment < VILLAGE_SEA_PATH.length; segment++) {
      const a = VILLAGE_SEA_PATH[segment - 1]!, b = VILLAGE_SEA_PATH[segment]!
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      for (let step = 0; step <= Math.ceil(length / 8); step++) {
        const t = step / Math.ceil(length / 8)
        for (const offset of [-24, 0, 24]) {
          const x = a.x + (b.x - a.x) * t - (b.y - a.y) / length * offset
          const y = a.y + (b.y - a.y) * t + (b.x - a.x) / length * offset
          expect(blockers(x, y), `segment ${segment} at ${x},${y}`).toEqual([])
        }
      }
    }
  })
  it("keeps the returning hero and the story owl outside buildings", () => {
    for (const point of [VILLAGE_ENTRY_SPAWNS.beach!, VILLAGE_OCEAN_OWL]) expect(blockers(point.x, point.y)).toEqual([])
  })
})
