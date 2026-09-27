import { describe, expect, it } from "vitest"
import forestMap from "../../public/assets/maps/wild-forest.tmj?raw"
import { MOUNTAIN_ENTRY, WILD_MOUNTAIN_PORTAL } from "../../src/domain/mountain"
import { MINE_ENTRANCES } from "../../src/domain/resources"
import { BIRD_PASS_ENTRY } from "../../src/domain/birdPass"
import { BIRD_PASS_ROADS, MOUNTAIN_ROADS, WILD_FOREST_ROADS, carveRoadThroughCollisions, isOnRoad, projectToRoad, type RoadNetwork } from "../../src/domain/roads"

describe("дорожные сети боевых локаций", () => {
  it("оставляет входы и порталы на проходимой дороге", () => {
    expect(isOnRoad(WILD_FOREST_ROADS, 210, 1390)).toBe(true)
    expect(isOnRoad(WILD_FOREST_ROADS, WILD_MOUNTAIN_PORTAL.x, WILD_MOUNTAIN_PORTAL.y)).toBe(true)
    expect(isOnRoad(MOUNTAIN_ROADS, MOUNTAIN_ENTRY.x, MOUNTAIN_ENTRY.y)).toBe(true)
    expect(isOnRoad(BIRD_PASS_ROADS, BIRD_PASS_ENTRY.x, BIRD_PASS_ENTRY.y)).toBe(true)
    expect(isOnRoad(BIRD_PASS_ROADS, 4660, 800)).toBe(true)
  })

  it("не считает лес, скалы и внешние границы дорогой", () => {
    expect(isOnRoad(WILD_FOREST_ROADS, 100, 100)).toBe(false)
    expect(isOnRoad(WILD_FOREST_ROADS, 1100, 1530)).toBe(false)
    expect(isOnRoad(WILD_FOREST_ROADS, 750, 1490)).toBe(false)
    expect(isOnRoad(WILD_FOREST_ROADS, 600, 1500)).toBe(false)
    expect(isOnRoad(MOUNTAIN_ROADS, 400, 180)).toBe(false)
    expect(isOnRoad(MOUNTAIN_ROADS, 4700, 1500)).toBe(false)
    expect(isOnRoad(BIRD_PASS_ROADS, 2500, 100)).toBe(false)
  })

  it("может вернуть объект к ближайшей оси дороги", () => {
    const projection = projectToRoad(MOUNTAIN_ROADS, 400, 180)
    expect(isOnRoad(MOUNTAIN_ROADS, projection.x, projection.y)).toBe(true)
    expect(projection.distance).toBeGreaterThan(projection.halfWidth)
  })

  it("покрывает видимые центральную, южную, западную и северные тропы леса", () => {
    // Independent landmarks on the background, not points taken from the mask.
    for (const [x, y] of [
      [897, 659], [758, 725], [805, 828], [1050, 1114], [1130, 1136],
      [1161, 1242], [1150, 1347], [1011, 1434], [902, 1456],
      [297, 917], [327, 786], [715, 150], [1667, 206],
    ]) expect(isOnRoad(WILD_FOREST_ROADS, x!, y!), `painted path (${x}, ${y})`).toBe(true)
    for (const { x, y } of MINE_ENTRANCES) {
      expect(isOnRoad(WILD_FOREST_ROADS, x, y), `mine (${x}, ${y})`).toBe(true)
      expect(isOnRoad(WILD_FOREST_ROADS, x, y + 135), `mine return (${x}, ${y + 135})`).toBe(true)
    }
  })

  it("не оставляет статические коллизии на лесных тропах и перекрёстках", () => {
    const map = JSON.parse(forestMap) as { layers: { name: string; objects?: { x: number; y: number; width: number; height: number }[] }[] }
    const rectangles = map.layers.find(({ name }) => name === "collisions")!.objects!
    const carved = carveRoadThroughCollisions(rectangles, WILD_FOREST_ROADS)
    // The collision body is at the hero's feet, below the sprite anchor.
    // Sweep the actual map, not a synthetic rectangle, with a full-size hero.
    for (const segment of WILD_FOREST_ROADS.segments) {
      const steps = Math.ceil(Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y) / 10)
      for (let step = 0; step <= steps; step++) {
        const x = segment.from.x + (segment.to.x - segment.from.x) * step / steps
        const y = segment.from.y + (segment.to.y - segment.from.y) * step / steps
        expect(carved.some((rect) =>
          x + 27 > rect.x && x - 27 < rect.x + rect.width &&
          y + 65 > rect.y && y + 20 < rect.y + rect.height), `blocked road (${x}, ${y})`).toBe(false)
      }
    }
    expect(carved.some((rect) => 120 > rect.x && 120 < rect.x + rect.width && 120 > rect.y && 120 < rect.y + rect.height)).toBe(true)
  })

  it("учитывает широкую площадку даже если узкая дорожка ближе к точке", () => {
    const network: RoadNetwork = {
      segments: [{ from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, halfWidth: 10 }],
      zones: [{ x: 0, y: 100, radius: 100 }],
    }
    expect(isOnRoad(network, 50, 20)).toBe(true)
  })

  it("вырезает непрерывный безопасный проход из коллизии, сохраняя стены вне дороги", () => {
    const network: RoadNetwork = {
      segments: [{ from: { x: 0, y: 200 }, to: { x: 500, y: 200 }, halfWidth: 40 }],
      zones: [],
    }
    const carved = carveRoadThroughCollisions([{ x: 100, y: 0, width: 300, height: 400 }], network)
    const overlaps = (x: number, y: number) => carved.some((rect) =>
      x + 24 > rect.x && x - 24 < rect.x + rect.width &&
      y + 24 > rect.y && y - 24 < rect.y + rect.height)
    for (let x = 100; x <= 400; x += 10) expect(overlaps(x, 200)).toBe(false)
    expect(overlaps(200, 10)).toBe(true)
    expect(overlaps(200, 390)).toBe(true)
  })
})
