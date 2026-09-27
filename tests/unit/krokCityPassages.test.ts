import { describe, expect, it } from "vitest"
import ts from "typescript"
import mapJSON from "../../public/assets/maps/krok-city.tmj?raw"
import citySceneSource from "../../src/game/scenes/KrokCityScene.ts?raw"
import { KROK_CITY_BUILDINGS, KROK_CITY_SECTORS, KROK_CITY_SECTOR_SIZE, KROK_RESIDENTS } from "../../src/domain/krokCityLayout"
import { KROK_CITY_ROADS, isOnRoad } from "../../src/domain/roads"
import { npcFootprint, npcRectsOverlap, type NpcPoint, type NpcRect } from "../../src/game/animation/NpcPatrol"

interface CityObject extends NpcPoint { id: number; name: string; type?: string; width?: number; height?: number; polyline?: NpcPoint[] }
const map = JSON.parse(mapJSON) as { layers: { name: string; objects: CityObject[] }[] }
const objects = map.layers.find(({ name }) => name === "world-objects")!.objects
const collisions = map.layers.find(({ name }) => name === "collisions")!.objects as (CityObject & NpcRect)[]
const patrols = map.layers.find(({ name }) => name === "npc-routes")!.objects
const npcs = objects.filter(({ type }) => ["resident", "quest", "merchant", "prince", "guard"].includes(type ?? ""))
const npcBodies = npcs.map((npc) => npcFootprint(npc, npc.type === "guard" ? 116 : 135, npc.type === "prince" ? 178 : 155))

describe("Krok city architecture and connected streets", () => {
  it("preserves every main street, outer lane and shared sector boulevard", () => {
    // Independent movement contract, not a claim about generated background
    // pixels. Art alignment also needs the in-game visual review below.
    const corridors = [
      ...[800, 2400].map((y) => ({ x: 0, y: y - 170, width: 9600, height: 340 })),
      ...[140, 3060].map((y) => ({ x: 0, y: y - 85, width: 9600, height: 170 })),
      { x: 0, y: 1375, width: 9600, height: 450 },
      ...[1200, 3600, 6000, 8400].map((x) => ({ x: x - 150, y: 0, width: 300, height: 3200 })),
      ...[140, 9460].map((x) => ({ x: x - 85, y: 0, width: 170, height: 3200 })),
      ...[2400, 4800, 7200].map((x) => ({ x: x - 225, y: 0, width: 450, height: 3200 })),
    ]
    for (let y = 0; y <= 3200; y += 20) {
      for (let x = 0; x <= 9600; x += 20) {
        const expectedPassage = corridors.some((rectangle) => x >= rectangle.x && x <= rectangle.x + rectangle.width && y >= rectangle.y && y <= rectangle.y + rectangle.height)
        expect(isOnRoad(KROK_CITY_ROADS, x, y), `street contract ${x},${y}`).toBe(expectedPassage)
      }
    }
    // The former paired perimeter lanes are now one continuous boulevard.
    // Its central strip must not become an invisible barrier or snow island.
    for (let x = 0; x <= 9600; x += 20) expect(isOnRoad(KROK_CITY_ROADS, x, 1600)).toBe(true)
    for (const x of [2400, 4800, 7200]) {
      for (let y = 0; y <= 3200; y += 20) expect(isOnRoad(KROK_CITY_ROADS, x, y)).toBe(true)
    }
  })

  it("keeps four organic background themes and 32 solid footprints in eight sectors", () => {
    expect(KROK_CITY_SECTORS).toHaveLength(8)
    expect(KROK_CITY_SECTOR_SIZE).toEqual({ width: 2400, height: 1600 })
    expect([...new Set(KROK_CITY_SECTORS.map(({ background }) => background))].sort()).toEqual(["crafts", "market", "residential", "royal"])
    expect(KROK_CITY_BUILDINGS).toHaveLength(32)
    expect(collisions).toHaveLength(32)
    for (const building of KROK_CITY_BUILDINGS) {
      expect(collisions.find(({ name }) => name === building.id)).toMatchObject(building.solid)
      expect(isOnRoad(KROK_CITY_ROADS, building.solid.x + building.solid.width / 2, building.solid.y + building.solid.height / 2)).toBe(false)
      expect(building.solid.x).toBeGreaterThanOrEqual(building.art.x)
      expect(building.solid.x + building.solid.width).toBeLessThanOrEqual(building.art.x + building.art.width)
      expect(building.solid.y + building.solid.height).toBe(building.art.y + building.art.height)
    }
    const allIds = map.layers.flatMap(({ objects: layerObjects }) => layerObjects.map(({ id }) => id))
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it("renders whole-sector paintings instead of snow rectangles and detached building sprites", () => {
    // Inspect only this scene's renderer, without importing Phaser's DOM/WebGL
    // runtime into unit tests. Geometry tests do not verify image content.
    const source = ts.createSourceFile("KrokCityScene.ts", citySceneSource, ts.ScriptTarget.Latest, true)
    const scene = source.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === "KrokCityScene")!
    const terrain = scene.members.find((node): node is ts.MethodDeclaration => ts.isMethodDeclaration(node) && node.name.getText(source) === "createCityTerrain")!
    expect(terrain?.body).toBeDefined()
    const factories: string[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === "this.add") {
        factories.push(node.expression.name.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(terrain.body!)
    expect(factories).toEqual(["image"])
    expect(terrain.body!.getText(source)).toContain("KROK_CITY_SECTORS")
    expect(terrain.body!.getText(source)).not.toMatch(/KROK_CITY_BUILDINGS|krok-house-|krok-snow-ground|krok-road/)
    expect(citySceneSource).toContain("organic-v3")
    expect(citySceneSource).not.toMatch(/krok-house-|krok-snow-ground/)
  })

  it("does not put buildings across any upper, lower or cross-sector street", () => {
    for (const segment of KROK_CITY_ROADS.segments) {
      const steps = Math.ceil(Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y) / 20)
      for (let step = 0; step <= steps; step++) {
        const point = { x: segment.from.x + (segment.to.x - segment.from.x) * step / steps, y: segment.from.y + (segment.to.y - segment.from.y) * step / steps }
        // Check both sides of the entire lane, not just a narrow centre line.
        const vertical = segment.from.x === segment.to.x
        for (const side of [-1, 0, 1]) {
          const edge = { x: point.x + (vertical ? side * segment.halfWidth : 0), y: point.y + (vertical ? 0 : side * segment.halfWidth) }
          expect(collisions.some((solid) => npcRectsOverlap(npcFootprint(edge, 102, 140), solid)), `street edge ${edge.x},${edge.y}`).toBe(false)
          expect(isOnRoad(KROK_CITY_ROADS, edge.x, edge.y)).toBe(true)
        }
      }
    }
  })

  it("connects all entrances, quest targets, shops and residents even with solid NPCs", () => {
    const step = 40
    const columns = 9600 / step
    const rows = 3200 / step
    const open = new Uint8Array(columns * rows)
    const pointAt = (cell: number) => ({ x: (cell % columns) * step + 20, y: Math.floor(cell / columns) * step + 20 })
    for (let cell = 0; cell < open.length; cell++) {
      const point = pointAt(cell)
      const feet = npcFootprint(point, 102, 140)
      open[cell] = isOnRoad(KROK_CITY_ROADS, point.x, point.y) && ![...collisions, ...npcBodies].some((solid) => npcRectsOverlap(feet, solid)) ? 1 : 0
    }
    const initial = Math.floor(800 / step) * columns + Math.floor(300 / step)
    expect(open[initial]).toBe(1)
    const queue = [initial]
    open[initial] = 2
    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index]!
      const col = cell % columns
      for (const next of [col ? cell - 1 : -1, col + 1 < columns ? cell + 1 : -1, cell - columns, cell + columns]) {
        if (next >= 0 && next < open.length && open[next] === 1) { open[next] = 2; queue.push(next) }
      }
    }
    const reached = queue.map(pointAt)
    for (const object of objects) {
      expect(reached.some((point) => Math.hypot(point.x - object.x, point.y - object.y) < 130), object.name).toBe(true)
    }
    for (const y of [140, 800, 1600, 2400, 3060]) {
      for (const x of [140, 1200, 2400, 3600, 4800, 6000, 7200, 8400, 9460]) {
        expect(reached.some((point) => Math.hypot(point.x - x, point.y - y) < 80), `junction ${x},${y}`).toBe(true)
      }
    }
  })
})

describe("Krok residents live by homes throughout the city", () => {
  it("has twelve named residents with varied dialogue and keeps service NPCs stationary", () => {
    expect(npcs).toHaveLength(23)
    const residents = objects.filter(({ type }) => type === "resident")
    expect(residents).toHaveLength(12)
    expect(Object.keys(KROK_RESIDENTS).sort()).toEqual(residents.map(({ name }) => name).sort())
    expect(patrols.map(({ name }) => name).sort()).toEqual(residents.map(({ name }) => name).sort())
    expect(new Set(residents.map(({ x, y }) => Math.floor(x / 2400) + Math.floor(y / 1600) * 4)).size).toBe(8)
    for (const resident of residents) {
      expect(KROK_RESIDENTS[resident.name]!.lines.length).toBeGreaterThanOrEqual(2)
      expect(KROK_RESIDENTS[resident.name]!.name).not.toBe("Житель Кроков")
      // The first waypoint is a doorstep, not a point in the middle of a road.
      expect(KROK_CITY_BUILDINGS.some(({ art }) => Math.hypot(resident.x - art.x - art.width / 2, resident.y - art.y - art.height - 40) < 30), resident.name).toBe(true)
    }
    const sideStreetServices = npcs.filter(({ type }) => type === "quest" || type === "merchant")
    expect(sideStreetServices.every(({ y }) => [140, 1460, 1740, 3060].includes(y))).toBe(true)
  })

  it("keeps all door-to-street patrols short, walkable and clear of buildings, portals and stationary NPCs", () => {
    const stationary = npcs.filter(({ type }) => type !== "resident").map((npc) => npcFootprint(npc, npc.type === "guard" ? 116 : 135, npc.type === "prince" ? 178 : 155))
    for (const patrol of patrols) {
      const points = patrol.polyline!.map(({ x, y }) => ({ x: patrol.x + x, y: patrol.y + y }))
      expect(points.length).toBeGreaterThanOrEqual(2)
      expect(points.length).toBeLessThanOrEqual(4)
      let length = 0
      for (let index = 1; index < points.length; index++) {
        const from = points[index - 1]!
        const to = points[index]!
        length += Math.hypot(to.x - from.x, to.y - from.y)
        for (let step = 0; step <= 40; step++) {
          const point = { x: from.x + (to.x - from.x) * step / 40, y: from.y + (to.y - from.y) * step / 40 }
          expect(isOnRoad(KROK_CITY_ROADS, point.x, point.y), patrol.name).toBe(true)
          expect([...collisions, ...stationary].some((solid) => npcRectsOverlap(npcFootprint(point, 135, 155), solid)), patrol.name).toBe(false)
          expect(objects.filter(({ type }) => type === "portal").every((portal) => Math.hypot(portal.x - point.x, portal.y - point.y) > 140)).toBe(true)
        }
      }
      expect(length).toBeGreaterThanOrEqual(100)
      expect(length).toBeLessThanOrEqual(300)
    }
  })
})
