import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SNOW_VALLEY_ROADS, carveRoadThroughCollisions, isOnRoad } from "../../src/domain/roads"
import { npcFootprint, npcRectsOverlap, type NpcRect } from "../../src/game/animation/NpcPatrol"

type Point = readonly [number, number]
interface ObjectMap { layers: { name: string; objects?: NpcRect[] }[] }

function collisionRectangles(name: string): NpcRect[] {
  const map = JSON.parse(readFileSync(new URL(`../../public/assets/maps/${name}.tmj`, import.meta.url), "utf8")) as ObjectMap
  return map.layers.find(({ name }) => name === "collisions")!.objects!
}

/** Read JPEG SOF dimensions without a browser or an image-processing dependency. */
function jpegDimensions(file: string): { width: number; height: number } {
  const bytes = readFileSync(new URL(`../../public/assets/world/${file}`, import.meta.url))
  expect(bytes.readUInt16BE(0), `${file} must be JPEG`).toBe(0xffd8)
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error(`Invalid JPEG marker in ${file}`)
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]!
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue
    const length = bytes.readUInt16BE(offset)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) }
    }
    if (length < 2) throw new Error(`Invalid JPEG marker length in ${file}`)
    offset += length
  }
  throw new Error(`No JPEG frame dimensions in ${file}`)
}

function samplePath(points: readonly Point[]): { x: number; y: number }[] {
  return points.slice(1).flatMap(([x1, y1], index) => {
    const [x0, y0] = points[index]!
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5)
    return Array.from({ length: steps + 1 }, (_, step) => ({
      x: x0 + (x1 - x0) * step / steps,
      y: y0 + (y1 - y0) * step / steps,
    }))
  })
}

describe("continuous village and valley backgrounds", () => {
  for (const file of ["forest-village-panorama-v2.jpg", "snow-valley-panorama-v2.jpg"]) {
    it(`${file} is a genuine wide panorama rather than a stretched square tile`, () => {
      const { width, height } = jpegDimensions(file)
      expect(width).toBeGreaterThanOrEqual(height * 3)
      expect(height).toBeGreaterThan(0)
      const preload = readFileSync(new URL("../../src/game/scenes/PreloadScene.ts", import.meta.url), "utf8")
      expect(preload).toContain(`assets/world/${file}`)
      const mapName = file.replace("-panorama-v2.jpg", "")
      const map = JSON.parse(readFileSync(new URL(`../../public/assets/maps/${mapName}.tmj`, import.meta.url), "utf8")) as {
        layers: { type: string; image?: string; x: number; y: number }[]
      }
      const backgrounds = map.layers.filter(({ type }) => type === "imagelayer")
      expect(backgrounds).toHaveLength(1)
      expect(backgrounds[0]).toMatchObject({ image: `../world/${file}`, x: mapName === "forest-village" ? -2400 : 0, y: 0 })
    })
  }

  it("does not stitch the old village west image or cover the valley seam with a bridge sticker", () => {
    const village = readFileSync(new URL("../../src/game/scenes/ForestVillageScene.ts", import.meta.url), "utf8")
    const snow = readFileSync(new URL("../../src/game/scenes/SnowWorldScene.ts", import.meta.url), "utf8")
    expect(village).not.toContain('"forest-village-west-bg"')
    expect(snow).not.toContain('"snow-valley-bridge"')
  })

  for (const y of [700, 1220]) {
    it(`keeps the village street at y=${y} open across the former x=0 seam`, () => {
      const obstacles = collisionRectangles("forest-village")
      for (const point of samplePath([[-450, y], [0, y], [450, y]])) {
        for (const [width, height] of [[102, 140], [96, 112]]) {
          expect(obstacles.some((obstacle) => npcRectsOverlap(npcFootprint(point, width!, height!), obstacle)), `village seam ${point.x},${point.y}`).toBe(false)
        }
      }
    })
  }

  it("keeps the full-width valley passage open across the former x=2400 seam", () => {
    const obstacles = carveRoadThroughCollisions(collisionRectangles("snow-valley"), SNOW_VALLEY_ROADS)
    const path: readonly Point[] = [[1950, 875], [2100, 830], [2300, 800], [2400, 825], [2650, 890], [2850, 940]]
    for (const center of samplePath(path)) {
      // Cover the middle of the path and both shoulders, not just one ideal line.
      for (const offsetY of [-90, 0, 90]) {
        const point = { x: center.x, y: center.y + offsetY }
        expect(isOnRoad(SNOW_VALLEY_ROADS, point.x, point.y), `valley road seam ${point.x},${point.y}`).toBe(true)
        for (const [width, height] of [[102, 140], [96, 112]]) {
          expect(obstacles.some((obstacle) => npcRectsOverlap(npcFootprint(point, width!, height!), obstacle)), `valley collision seam ${point.x},${point.y}`).toBe(false)
        }
      }
    }
    expect(isOnRoad(SNOW_VALLEY_ROADS, 2400, 200)).toBe(false)
    expect(isOnRoad(SNOW_VALLEY_ROADS, 2400, 1450)).toBe(false)
  })
})
