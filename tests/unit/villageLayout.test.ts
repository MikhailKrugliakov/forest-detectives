import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { HERO_START_SPAWNS, VILLAGE_DOORS, VILLAGE_ENTRY_SPAWNS, VILLAGE_RESIDENTS, VILLAGE_SQUARE } from "../../src/domain/villageLayout"
import { npcFootprint, npcRectsOverlap, type NpcRect } from "../../src/game/animation/NpcPatrol"

interface MapObject extends NpcRect { name: string; type?: string }
const map = JSON.parse(readFileSync(new URL("../../public/assets/maps/forest-village.tmj", import.meta.url), "utf8")) as {
  layers: { name: string; objects?: MapObject[] }[]
}
const objects = map.layers.find(({ name }) => name === "world-objects")!.objects!
const buildings = map.layers.find(({ name }) => name === "collisions")!.objects!

describe("village panorama ground-level layout", () => {
  it("keeps every door and resident in sync with the scene's shared layout", () => {
    for (const [id, point] of Object.entries({ ...VILLAGE_DOORS, ...VILLAGE_RESIDENTS })) {
      const object = objects.find(({ name }) => name === id)!
      expect({ x: object.x, y: object.y }, id).toEqual(point)
    }
    const spawn = objects.find(({ type }) => type === "spawn")!
    expect({ x: spawn.x, y: spawn.y }).toEqual(VILLAGE_SQUARE)
  })

  it("places doors, chapter arrivals and return points outside the actual building footprints", () => {
    for (const [id, point] of Object.entries({
      square: VILLAGE_SQUARE,
      ...Object.fromEntries(Object.entries(VILLAGE_DOORS).map(([id, point]) => [`door:${id}`, point])),
      ...Object.fromEntries(Object.entries(VILLAGE_ENTRY_SPAWNS).map(([id, point]) => [`return:${id}`, point])),
      ...Object.fromEntries(Object.entries(HERO_START_SPAWNS).map(([id, point]) => [`hero:${id}`, point])),
    })) {
      for (const [width, height] of [[102, 140], [96, 112]]) {
        expect(buildings.filter((building) => npcRectsOverlap(npcFootprint(point, width!, height!), building)).map(({ name }) => name), id).toEqual([])
      }
    }
  })

  it("keeps residents on the ground beside their homes, not inside the moved buildings", () => {
    for (const [id, point] of Object.entries(VILLAGE_RESIDENTS)) {
      const width = ["wolf", "fox", "rabbit", "sheepwolf"].includes(id) ? 105 : id === "robot-sweep" ? 150 : 135
      expect(buildings.filter((building) => npcRectsOverlap(npcFootprint(point, width, width * 1.35), building)).map(({ name }) => name), id).toEqual([])
    }
  })

  it("retains the forest, farm and snowy valley gateways at the existing map edges", () => {
    for (const [id, x, y] of [["wild-forest", 2280, 360], ["melon-farm", 1440, 1500], ["snow-valley", -2250, 810]] as const) {
      const portal = objects.find(({ name }) => name === id)!
      expect([portal.x, portal.y]).toEqual([x, y])
    }
  })
})
