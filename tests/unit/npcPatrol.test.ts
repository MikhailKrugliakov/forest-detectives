import { describe, expect, it } from "vitest"
import villageJSON from "../../public/assets/maps/forest-village.tmj?raw"
import farmJSON from "../../public/assets/maps/melon-farm.tmj?raw"
import cityJSON from "../../public/assets/maps/krok-city.tmj?raw"
import { KROK_CITY_ROADS, isOnRoad } from "../../src/domain/roads"
import { NPC_WALK_SPEED, npcFootprint, npcRectsOverlap, stepNpcPatrol, type NpcPatrolState, type NpcPoint, type NpcRect } from "../../src/game/animation/NpcPatrol"

const state = (): NpcPatrolState => ({ target: 1, direction: 1, wait: 0, stops: 0 })
const route = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }]

describe("прогулки мирных жителей", () => {
  it("проходит 40 пикселей за секунду без прыжков после долгого кадра", () => {
    const patrol = state()
    let point = route[0]!
    for (let frame = 0; frame < 20; frame++) point = stepNpcPatrol(point, patrol, route, 50, () => true)
    expect(point).toEqual({ x: 100 + NPC_WALK_SPEED, y: 100 })
    expect(stepNpcPatrol(point, patrol, route, 90_000, () => true).x - point.x).toBe(2)
  })

  it("не переступает точку маршрута, отдыхает и разворачивается на конце", () => {
    const patrol = { ...state(), target: 2 }
    expect(stepNpcPatrol({ x: 200, y: 199 }, patrol, route, 50, () => true)).toEqual(route[2])
    expect(patrol.target).toBe(1)
    expect(patrol.direction).toBe(-1)
    expect(patrol.wait).toBeGreaterThanOrEqual(2000)
    expect(patrol.wait).toBeLessThanOrEqual(5000)
    expect(stepNpcPatrol(route[2]!, patrol, route, 50, () => true)).toEqual(route[2])
  })

  it("не толкает препятствие: остаётся на месте и выбирает обратный путь", () => {
    const patrol = state()
    const before = { x: 160, y: 100 }
    expect(stepNpcPatrol(before, patrol, route, 50, () => false)).toBe(before)
    expect(patrol.target).toBe(0)
    expect(patrol.direction).toBe(-1)
    expect(patrol.wait).toBe(2000)
  })

  it("не двигает стационарных NPC и не меняет габариты при смене позы", () => {
    const point = route[0]!
    expect(stepNpcPatrol(point, state(), [], 50, () => true)).toBe(point)
    expect(npcFootprint(point, 100, 140)).toEqual({ x: 79, y: 122.4, width: 42, height: 42 })
    expect(npcRectsOverlap(npcFootprint(point, 100, 140), { x: 90, y: 140, width: 40, height: 40 })).toBe(true)
    expect(npcRectsOverlap(npcFootprint(point, 100, 140), { x: 200, y: 140, width: 40, height: 40 })).toBe(false)
  })
})

interface RouteObject extends NpcPoint { name: string; type?: string; polyline?: NpcPoint[]; width?: number; height?: number }
interface RouteMap { layers: { name: string; objects?: RouteObject[] }[] }

describe("маршруты в объектных картах", () => {
  const maps = [
    { name: "деревня", json: villageJSON, count: 4, width: 105, height: 141.75 },
    { name: "ферма", json: farmJSON, count: 5, width: 122, height: 150 },
    { name: "город", json: cityJSON, count: 12, width: 135, height: 155 },
  ]
  for (const configuration of maps) {
    it(`${configuration.name}: короткие маршруты не пересекают стены и входы`, () => {
      const map = JSON.parse(configuration.json) as RouteMap
      const routes = map.layers.find(({ name }) => name === "npc-routes")!.objects!
      const obstacles = map.layers.find(({ name }) => name === "collisions")!.objects! as NpcRect[]
      const objects = map.layers.find(({ name }) => name === "world-objects")!.objects!
      expect(routes).toHaveLength(configuration.count)
      for (const route of routes) {
        const npc = objects.find(({ name }) => name === (route.name === "watermelon-hero" ? "watermelon" : route.name))!
        expect(npc).toBeDefined()
        expect(["hero", "npc", "resident"]).toContain(npc.type)
        expect(npc.name).not.toBe("aunt-melon")
        const points = route.polyline!.map(({ x, y }) => ({ x: route.x + x, y: route.y + y }))
        expect(points.length).toBeGreaterThanOrEqual(2)
        expect(points.length).toBeLessThanOrEqual(4)
        expect(points[0]).toEqual({ x: npc.x, y: npc.y })
        let length = 0
        for (let index = 1; index < points.length; index++) {
          const start = points[index - 1]!
          const end = points[index]!
          const distance = Math.hypot(end.x - start.x, end.y - start.y)
          length += distance
          for (let step = 0; step <= 20; step++) {
            const point = { x: start.x + (end.x - start.x) * step / 20, y: start.y + (end.y - start.y) * step / 20 }
            const footprint = npcFootprint(point, configuration.width, configuration.height)
            expect(obstacles.some((obstacle) => npcRectsOverlap(footprint, obstacle)), `${route.name}: ${point.x}, ${point.y}`).toBe(false)
            for (const portal of objects.filter(({ type }) => type === "portal")) {
              expect(Math.hypot(portal.x - point.x, portal.y - point.y)).toBeGreaterThan(100)
            }
            if (configuration.name === "город") expect(isOnRoad(KROK_CITY_ROADS, point.x, point.y)).toBe(true)
          }
        }
        expect(length).toBeGreaterThanOrEqual(100)
        expect(length).toBeLessThanOrEqual(300)
      }
    })
  }
})
