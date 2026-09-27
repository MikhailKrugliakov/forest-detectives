import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

/** Read JPEG frame dimensions without adding an image library to the game. */
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) throw new Error("Expected a JPEG image")
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error("Invalid JPEG marker")
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]!
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue
    if (offset + 2 > bytes.length) break
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) throw new Error("Truncated JPEG segment")
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 8) throw new Error("Invalid JPEG frame")
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) }
    }
    offset += length
  }
  throw new Error("JPEG frame dimensions were not found")
}

describe("shipped organic Krok city backgrounds", () => {
  for (const style of ["residential", "crafts", "market", "royal"] as const) {
    it(`${style} exists as a real 3:2 JPEG`, () => {
      const filename = `krok-city-${style}-organic-v3.jpg`
      const path = resolve("public/assets/world", filename)
      expect(existsSync(path), `${filename} is required by KrokCityScene.preload`).toBe(true)
      const { width, height } = jpegDimensions(readFileSync(path))
      expect(width, filename).toBeGreaterThan(0)
      expect(height, filename).toBeGreaterThan(0)
      expect(width * 2, `${filename} must match the 2400×1600 sector without distortion`).toBe(height * 3)
    })
  }
})
