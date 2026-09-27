import { describe, expect, it, vi } from "vitest"
import { blendStreetPatch, type StreetPixels } from "../../src/game/KrokStreetSeams"

vi.mock("phaser", () => ({ default: { Scenes: { Events: { SHUTDOWN: "shutdown" } } } }))

function painting(width: number, height: number, seed: number): StreetPixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let channel = 0; channel < 3; channel++) data[(y * width + x) * 4 + channel] = (seed + x * 11 + y * 17 + channel * 29) % 256
    data[(y * width + x) * 4 + 3] = 255
  }
  return { width, height, data }
}
const pixel = (image: StreetPixels, x: number, y: number) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x + 1) * 4)]

describe("Krok street seam blending", () => {
  it("preserves both original vertical strip borders pixel-for-pixel", () => {
    const left = painting(48, 12, 5), right = painting(48, 12, 121)
    const blend = blendStreetPatch([left, right], 2, 1)
    expect([blend.width, blend.height]).toEqual([96, 12])
    for (let y = 0; y < 12; y++) {
      expect(pixel(blend, 0, y)).toEqual(pixel(left, 0, y))
      expect(pixel(blend, 95, y)).toEqual(pixel(right, 47, y))
    }
  })

  it("preserves original horizontal borders and never edits source pixel arrays", () => {
    const top = painting(14, 48, 30), bottom = painting(14, 48, 150)
    const before = [top.data.slice(), bottom.data.slice()]
    const blend = blendStreetPatch([top, bottom], 1, 2)
    expect([blend.width, blend.height]).toEqual([14, 96])
    for (let x = 0; x < 14; x++) {
      expect(pixel(blend, x, 0)).toEqual(pixel(top, x, 0))
      expect(pixel(blend, x, 95)).toEqual(pixel(bottom, x, 47))
    }
    expect(top.data).toEqual(before[0])
    expect(bottom.data).toEqual(before[1])
  })

  it("removes the abrupt middle edge with a gradual blend rather than repeating an opaque hard boundary", () => {
    const left = painting(48, 1, 0), right = painting(48, 1, 0)
    for (let x = 0; x < 48; x++) {
      left.data[x * 4] = 20
      right.data[x * 4] = 220
    }
    const blend = blendStreetPatch([left, right], 2, 1)
    const red = Array.from({ length: 96 }, (_, x) => blend.data[x * 4]!)
    expect(red[0]).toBe(20)
    expect(red[95]).toBe(220)
    expect(red[47]).toBeGreaterThan(110)
    expect(red[48]).toBeLessThan(130)
    expect(Math.abs(red[48]! - red[47]!)).toBeLessThanOrEqual(4)
    expect(red.every((value, i) => !i || value >= red[i - 1]!)).toBe(true)
  })

  it("matches all four neighboring strip borders exactly at a four-sector intersection", () => {
    const a = painting(48, 48, 0), b = painting(48, 48, 40)
    const c = painting(48, 48, 90), d = painting(48, 48, 160)
    const cross = blendStreetPatch([a, b, c, d], 2, 2)
    const top = blendStreetPatch([a, b], 2, 1), bottom = blendStreetPatch([c, d], 2, 1)
    const left = blendStreetPatch([a, c], 1, 2), right = blendStreetPatch([b, d], 1, 2)
    expect([cross.width, cross.height]).toEqual([96, 96])
    for (let position = 0; position < 96; position++) {
      expect(pixel(cross, position, 0)).toEqual(pixel(top, position, 0))
      expect(pixel(cross, position, 95)).toEqual(pixel(bottom, position, 47))
      expect(pixel(cross, 0, position)).toEqual(pixel(left, 0, position))
      expect(pixel(cross, 95, position)).toEqual(pixel(right, 47, position))
    }
  })
})
