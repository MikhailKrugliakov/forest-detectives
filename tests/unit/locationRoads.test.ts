import { describe, expect, it } from "vitest"
import mountainMap from "../../public/assets/maps/mountain-hollow.tmj?raw"
import birdMap from "../../public/assets/maps/bird-pass.tmj?raw"
import valleyMap from "../../public/assets/maps/snow-valley.tmj?raw"
import cityMap from "../../public/assets/maps/snow-city.tmj?raw"
import { BIRD_PASS_ROADS, KROK_OUTSKIRTS_ROADS, MOUNTAIN_ROADS, SNOW_CITY_ROADS, SNOW_VALLEY_ROADS, carveRoadThroughCollisions, isOnRoad, projectToRoad, type RoadCollisionRect, type RoadNetwork } from "../../src/domain/roads"

interface MapObject extends RoadCollisionRect { name: string; type?: string }
interface ObjectMap { layers: { name: string; objects?: MapObject[] }[] }
const maps: { name: string; network: RoadNetwork; json: string }[] = [
  { name: "mountain-hollow", network: MOUNTAIN_ROADS, json: mountainMap },
  { name: "bird-pass", network: BIRD_PASS_ROADS, json: birdMap },
  { name: "snow-valley", network: SNOW_VALLEY_ROADS, json: valleyMap },
  { name: "snow-city", network: SNOW_CITY_ROADS, json: cityMap },
]

for (const { name, network, json } of maps) {
  describe(`${name}: continuous walkable corridors`, () => {
    const map = JSON.parse(json) as ObjectMap
    const obstacles = carveRoadThroughCollisions(map.layers.find(({ name }) => name === "collisions")!.objects!, network)
    const overlaps = (x: number, y: number) => obstacles.some((rect) =>
      x + 27 > rect.x && x - 27 < rect.x + rect.width &&
      y + 65 > rect.y && y + 20 < rect.y + rect.height)

    it("leaves a full-size hero's feet clear along roads and junctions", () => {
      for (const { from, to } of network.segments) {
        const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 10))
        for (let step = 0; step <= steps; step++) {
          const x = from.x + (to.x - from.x) * step / steps
          const y = from.y + (to.y - from.y) * step / steps
          expect(overlaps(x, y), `road blocked at (${x}, ${y})`).toBe(false)
        }
      }
    })

    it("keeps portals and collectable resources within reach of a road", () => {
      for (const object of map.layers.find(({ name }) => name === "world-objects")!.objects!) {
        if (object.type !== "portal" && !object.type?.startsWith("resource-")) continue
        const projection = projectToRoad(network, object.x, object.y)
        expect(projection.distance - projection.halfWidth, object.name).toBeLessThan(75)
      }
    })

    it("connects every road branch to the western entrance without a scenery barrier", () => {
      const step = 40
      const columns = 120
      const rows = 40
      const open = new Uint8Array(columns * rows)
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const x = column * step + step / 2
          const y = row * step + step / 2
          if (isOnRoad(network, x, y) && !overlaps(x, y)) open[row * columns + column] = 1
        }
      }
      const start = Math.floor(800 / step) * columns + Math.floor(180 / step)
      expect(open[start]).toBe(1)
      const queue = [start]
      const reached = new Set(queue)
      for (let index = 0; index < queue.length; index++) {
        const cell = queue[index]!
        const column = cell % columns
        for (const next of [column > 0 ? cell - 1 : -1, column + 1 < columns ? cell + 1 : -1, cell - columns, cell + columns]) {
          if (next >= 0 && next < open.length && open[next] && !reached.has(next)) { reached.add(next); queue.push(next) }
        }
      }
      for (const { from, to } of network.segments) {
        for (const point of [from, to]) {
          const cell = Math.floor(point.y / step) * columns + Math.floor(point.x / step)
          expect(reached.has(cell), `unreachable branch (${point.x}, ${point.y})`).toBe(true)
        }
      }
    })
  })
}

describe("painted paths are not treated as inaccessible scenery", () => {
  it("includes mountain branches visible on both background segments", () => {
    for (const [x, y] of [[66, 953], [1385, 452], [1093, 1468], [3894, 380], [3948, 311], [3697, 1496]] as const) {
      expect(isOnRoad(MOUNTAIN_ROADS, x, y), `mountain (${x}, ${y})`).toBe(true)
    }
  })
  it("includes the painted main road and side paths of Bird Pass", () => {
    for (const [x, y] of [[1188, 1019], [2973, 1016], [648, 444], [1859, 1353]] as const) {
      expect(isOnRoad(BIRD_PASS_ROADS, x, y), `bird pass (${x}, ${y})`).toBe(true)
    }
  })
  it("includes snowy side paths but keeps fortress walls independent of city streets", () => {
    for (const [x, y] of [[780, 550], [550, 280], [1740, 1250], [3250, 440], [3040, 110], [4320, 1240]] as const) {
      expect(isOnRoad(SNOW_VALLEY_ROADS, x, y), `snow valley (${x}, ${y})`).toBe(true)
    }
    for (const [x, y] of [[1795, 420], [1300, 1510], [2610, 180], [4130, 230], [4080, 1380]] as const) {
      expect(isOnRoad(SNOW_CITY_ROADS, x, y), `city street (${x}, ${y})`).toBe(true)
      expect(isOnRoad(KROK_OUTSKIRTS_ROADS, x, y), `fortress wall (${x}, ${y})`).toBe(false)
    }
  })
  it("does not open sampled rocks, cliffs or houses beside the corrected roads", () => {
    const scenery: { network: RoadNetwork; points: readonly (readonly [number, number])[] }[] = [
      { network: MOUNTAIN_ROADS, points: [[532, 1181], [665, 508], [1474, 254], [3350, 177], [4514, 430], [4083, 1456], [3507, 1457]] },
      { network: BIRD_PASS_ROADS, points: [[109, 391], [1813, 297], [3181, 469], [3244, 1415], [844, 1500], [2140, 1380], [650, 1370]] },
      { network: SNOW_VALLEY_ROADS, points: [[1250, 300], [260, 1300], [3650, 380]] },
      { network: SNOW_CITY_ROADS, points: [[900, 260], [1600, 1350], [3450, 300], [4510, 1430]] },
    ]
    for (const { network, points } of scenery) {
      for (const [x, y] of points) expect(isOnRoad(network, x, y), `solid scenery (${x}, ${y})`).toBe(false)
    }
  })
})
