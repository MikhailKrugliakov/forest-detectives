import { describe, expect, it } from "vitest"
import { MOUNTAIN_ENTRY, WILD_MOUNTAIN_PORTAL } from "../../src/domain/mountain"
import { BIRD_PASS_ENTRY } from "../../src/domain/birdPass"
import { BIRD_PASS_ROADS, MOUNTAIN_ROADS, WILD_FOREST_ROADS, isOnRoad, projectToRoad } from "../../src/domain/roads"

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
    expect(isOnRoad(WILD_FOREST_ROADS, 1100, 1450)).toBe(false)
    expect(isOnRoad(MOUNTAIN_ROADS, 400, 180)).toBe(false)
    expect(isOnRoad(MOUNTAIN_ROADS, 4700, 1500)).toBe(false)
    expect(isOnRoad(BIRD_PASS_ROADS, 2500, 100)).toBe(false)
  })

  it("может вернуть объект к ближайшей оси дороги", () => {
    const projection = projectToRoad(MOUNTAIN_ROADS, 400, 180)
    expect(isOnRoad(MOUNTAIN_ROADS, projection.x, projection.y)).toBe(true)
    expect(projection.distance).toBeGreaterThan(projection.halfWidth)
  })
})
