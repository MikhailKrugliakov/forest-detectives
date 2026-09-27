import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { ACTOR_CATALOG } from "../../src/game/animation/catalog"

describe("shipped animation atlases", () => {
  for (const actor of ACTOR_CATALOG) {
    it(`${actor.key} has complete transparent 96-frame sheets`, () => {
      for (const path of [actor.sheet, actor.utilitySheet, actor.actionsSheet, actor.motionSheet, actor.specialSheet].filter(Boolean)) {
        const png = readFileSync(resolve("public", path!))
        expect(png.subarray(1, 4).toString()).toBe("PNG")
        expect(png.readUInt32BE(16)).toBe(1024)
        expect(png.readUInt32BE(20)).toBe(1536)
        const transparent = png[25] === 6 || png[25] === 3 && png.includes(Buffer.from("tRNS"))
        expect(transparent, `${path} must retain transparent pixels`).toBe(true)
      }
      if (actor.rigSheet) {
        const png = readFileSync(resolve("public", actor.rigSheet))
        expect(png.subarray(1, 4).toString()).toBe("PNG")
        expect(png.readUInt32BE(16)).toBe(768)
        expect(png.readUInt32BE(20)).toBe(1024)
        expect(png[25] === 6 || png[25] === 3 && png.includes(Buffer.from("tRNS"))).toBe(true)
      }
    })
  }
})
