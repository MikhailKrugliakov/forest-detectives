import { describe, expect, it } from "vitest"
import clearingJSON from "../../public/assets/maps/forest-clearing.tmj?raw"
import villageJSON from "../../public/assets/maps/forest-village.tmj?raw"
import farmJSON from "../../public/assets/maps/melon-farm.tmj?raw"
import mineJSON from "../../public/assets/maps/forest-mine.tmj?raw"
import beaverJSON from "../../public/assets/maps/beaver-house.tmj?raw"
import { BEAVER_CHECKPOINTS } from "../../src/domain/beaverLayout"
import { VILLAGE_SQUARE } from "../../src/domain/villageLayout"
import { npcFootprint, npcRectsOverlap, type NpcPoint, type NpcRect } from "../../src/game/animation/NpcPatrol"

interface MapObject extends NpcPoint { name: string; type?: string; width?: number; height?: number }
interface ObjectMap { layers: { name: string; objects?: MapObject[] }[] }
const layer = (json: string, name: string): MapObject[] => (JSON.parse(json) as ObjectMap).layers.find((item) => item.name === name)?.objects ?? []
const collisionRects = (json: string) => layer(json, "collisions") as (NpcRect & { name: string })[]

// Match the stable foot body used by BaseWorldScene, not the large sprite's
// drawing bounds. Twenty-pixel cells are narrower than the narrowest corridor.
function reachable(json: string, width: number, height: number, originX: number, start: NpcPoint, bodyWidth = 112, bodyHeight = 154): NpcPoint[] {
  const obstacles = collisionRects(json)
  const step = 20
  const columns = width / step
  const rows = height / step
  const cells = new Uint8Array(columns * rows)
  const point = (cell: number) => ({ x: originX + (cell % columns) * step + step / 2, y: Math.floor(cell / columns) * step + step / 2 })
  for (let cell = 0; cell < cells.length; cell++) {
    const footprint = npcFootprint(point(cell), bodyWidth, bodyHeight)
    cells[cell] = obstacles.some((obstacle) => npcRectsOverlap(footprint, obstacle)) ? 0 : 1
  }
  const initial = Math.floor(start.y / step) * columns + Math.floor((start.x - originX) / step)
  expect(cells[initial], "spawn must be outside map scenery").toBe(1)
  const queue = [initial]
  cells[initial] = 2
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]!
    const column = cell % columns
    for (const next of [column > 0 ? cell - 1 : -1, column < columns - 1 ? cell + 1 : -1, cell - columns, cell + columns]) {
      if (next >= 0 && next < cells.length && cells[next] === 1) { cells[next] = 2; queue.push(next) }
    }
  }
  return queue.map(point)
}

describe("peaceful map passages", () => {
  for (const config of [
    { name: "clearing", json: clearingJSON, width: 1600, height: 1000, origin: 0, start: { x: 760, y: 785 }, layer: "interactables" },
    { name: "village", json: villageJSON, width: 4800, height: 1600, origin: -2400, start: VILLAGE_SQUARE, layer: "world-objects" },
    { name: "farm", json: farmJSON, width: 2400, height: 1600, origin: 0, start: { x: 430, y: 1375 }, layer: "world-objects" },
    { name: "mine", json: mineJSON, width: 2400, height: 1600, origin: 0, start: { x: 220, y: 1330 }, layer: "world-objects" },
  ]) {
    it(`${config.name}: map scenery does not isolate any entrance, resident, errand or resource`, () => {
      const points = reachable(config.json, config.width, config.height, config.origin, config.start)
      for (const target of layer(config.json, config.layer)) {
        // The burrow is a solid clue location with an intentionally larger
        // interaction distance. Mine ore is mined from beside the rock face.
        const radius = target.name === "burrow" ? 145 : target.type === "ore-slot" ? 115 : 100
        expect(points.some((point) => Math.hypot(point.x - target.x, point.y - target.y) < radius), target.name).toBe(true)
      }
    })
  }

  it("keeps the mine's painted central and southern passages clear without making the rocks passable", () => {
    const obstacles = collisionRects(mineJSON)
    const route: [number, number][] = [[740, 540], [740, 820], [800, 960], [1260, 960], [1260, 1340], [900, 1360], [1400, 1380], [1840, 1380]]
    for (let index = 1; index < route.length; index++) {
      const [x0, y0] = route[index - 1]!
      const [x1, y1] = route[index]!
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5)
      for (let step = 0; step <= steps; step++) {
        const point = { x: x0 + (x1 - x0) * step / steps, y: y0 + (y1 - y0) * step / steps }
        expect(obstacles.some((obstacle) => npcRectsOverlap(npcFootprint(point, 102, 140), obstacle)), `${point.x},${point.y}`).toBe(false)
      }
    }
    for (const point of [{ x: 1040, y: 740 }, { x: 900, y: 1470 }, { x: 1600, y: 1170 }]) {
      expect(obstacles.some((obstacle) => npcRectsOverlap(npcFootprint(point, 102, 140), obstacle))).toBe(true)
    }
  })
})

describe("Beaver House checkpoint passages", () => {
  const checkpoints = Object.entries(BEAVER_CHECKPOINTS).map(([name, point]) => ({ name, ...point }))
  const obstacles = [...collisionRects(beaverJSON), { name: "chasm", x: 1755, y: 650, width: 150, height: 870 }]

  it("places every restoration point outside walls and the chasm for both hero body sizes", () => {
    expect(checkpoints).toHaveLength(6)
    for (const checkpoint of checkpoints) {
      for (const height of [104, 124]) {
        expect(obstacles.filter((obstacle) => npcRectsOverlap(npcFootprint(checkpoint, 90, height), obstacle)).map(({ name }) => name), checkpoint.name).toEqual([])
      }
    }
  })

  it("allows movement from the launcher checkpoint into the next room and back to the entrance", () => {
    const checkpoint = checkpoints.find(({ name }) => name === "launchers")!
    const points = reachable(beaverJSON, 2400, 1600, 0, checkpoint, 90, 124)
    for (const target of [{ x: 1660, y: 400 }, { x: 1510, y: 1050 }, { x: 520, y: 1110 }]) {
      expect(points.some((point) => Math.hypot(point.x - target.x, point.y - target.y) < 35)).toBe(true)
    }
  })
})
