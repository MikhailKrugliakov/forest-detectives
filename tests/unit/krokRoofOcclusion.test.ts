import type Phaser from "phaser"
import { describe, expect, it, vi } from "vitest"
import { KrokRoofOcclusion } from "../../src/game/KrokRoofOcclusion"

const mock = vi.hoisted(() => {
  type Point = { x: number; y: number }
  type Rectangle = Point & { width: number; height: number }
  class Polygon {
    constructor(readonly points: Point[]) {}
    static Contains(shape: Polygon, x: number, y: number): boolean {
      let inside = false
      for (let i = 0, previous = shape.points.length - 1; i < shape.points.length; previous = i++) {
        const a = shape.points[i]!, b = shape.points[previous]!
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside
      }
      return inside
    }
  }
  class Events {
    private listeners = new Map<string, (() => void)[]>()
    once(event: string, callback: () => void) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]); return this }
    emit(event: string) {
      const callbacks = this.listeners.get(event) ?? []
      this.listeners.delete(event)
      for (const callback of callbacks) callback()
    }
  }
  return { Polygon, Events, intersects: (a: Rectangle, b: Rectangle) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y }
})

vi.mock("phaser", () => ({ default: {
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Geom: { Polygon: mock.Polygon, Intersects: { RectangleToRectangle: mock.intersects } },
} }))

function canvasTexture(width = 1536, height = 1024) {
  const source = { width, height }
  return {
    width, height, getSourceImage: () => source,
    context: {
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn(), drawImage: vi.fn(),
    },
    refresh: vi.fn(),
  }
}

class RoofImage {
  alpha = 1
  visible = true
  origin = .5
  scale = 1
  depth = 0
  destroy = vi.fn()
  constructor(readonly x: number, readonly y: number, readonly textureKey: string, readonly width: number, readonly height: number) {}
  setOrigin(origin: number) { this.origin = origin; return this }
  setScale(scale: number) { this.scale = scale; return this }
  setDepth(depth: number) { this.depth = depth; return this }
  setAlpha(alpha: number) { this.alpha = alpha; return this }
  setVisible(visible: boolean) { this.visible = visible; return this }
  getBounds() { return { x: this.x, y: this.y, width: this.width * this.scale, height: this.height * this.scale } }
}

function fixture() {
  const entries = new Map<string, ReturnType<typeof canvasTexture>>()
  const images: RoofImage[] = []
  const events = new mock.Events()
  const camera = { x: 0, y: 0, width: 1280, height: 720 }
  const textures = {
    exists: (key: string) => entries.has(key),
    get: (key: string) => entries.get(key)!,
    createCanvas: vi.fn((key: string, width: number, height: number) => {
      const texture = canvasTexture(width, height)
      entries.set(key, texture)
      return texture
    }),
    remove: vi.fn((key: string) => entries.delete(key)),
  }
  const scene = {
    events, textures, cameras: { main: { worldView: camera } },
    add: { image: (x: number, y: number, key: string) => {
      const texture = entries.get(key)!
      const image = new RoofImage(x, y, key, texture.width, texture.height)
      images.push(image)
      return image
    } },
  }
  const addSource = (key: string) => entries.set(key, canvasTexture())
  const occlusion = new KrokRoofOcclusion(scene as unknown as Phaser.Scene)
  return { entries, images, events, camera, textures, addSource, occlusion }
}

function player(x: number, y: number, depth = y, displayHeight = 140) {
  return Object.freeze({ x, y, depth, displayHeight, body: Object.freeze({ x: x - 20, y: y + 30, width: 40, height: 40 }) }) as unknown as Phaser.Physics.Arcade.Image
}

describe("Krok roof foreground occlusion", () => {
  it("shares 16 transparent runtime textures across eight sectors with four repeated themes", () => {
    const game = fixture()
    const themes = ["homes", "market", "workshops", "palace"]
    for (const key of themes) game.addSource(key)
    for (let sector = 0; sector < 8; sector++) {
      game.occlusion.addSector(themes[sector % 4]!, sector % 4 * 2400, Math.floor(sector / 4) * 1600, 2400)
    }
    expect(game.images).toHaveLength(32)
    expect(game.textures.createCanvas).toHaveBeenCalledTimes(16)
    expect(new Set(game.images.map(({ textureKey }) => textureKey)).size).toBe(16)
    for (let index = 0; index < 16; index++) expect(game.images[index]!.textureKey).toBe(game.images[index + 16]!.textureKey)
    for (const [key, texture] of game.entries) {
      if (!key.includes("-roof-")) continue
      expect(texture.context.clip).toHaveBeenCalledTimes(1)
      expect(texture.context.drawImage).toHaveBeenCalledTimes(1)
      expect(texture.refresh).toHaveBeenCalledTimes(1)
    }
  })

  it("clips only the roof pixels into tight local alpha textures before drawing the original art", () => {
    const game = fixture()
    game.addSource("quarter")
    game.occlusion.addSector("quarter", 0, 0, 1536)
    const first = game.entries.get("quarter-roof-0")!
    expect(game.textures.createCanvas).toHaveBeenCalledWith("quarter-roof-0", 540, 305)
    expect(first.context.beginPath).toHaveBeenCalledTimes(1)
    expect(first.context.moveTo).toHaveBeenCalledWith(0, 305)
    expect(first.context.lineTo).toHaveBeenCalledTimes(14)
    expect(first.context.closePath).toHaveBeenCalledTimes(1)
    expect(first.context.drawImage).toHaveBeenCalledWith(game.entries.get("quarter")!.getSourceImage(), -135, -70)
    expect(first.context.clip.mock.invocationCallOrder[0]!).toBeLessThan(first.context.drawImage.mock.invocationCallOrder[0]!)
  })

  it("scales roof positions and front-edge depths without changing actor coordinates or its physical body", () => {
    const game = fixture()
    game.addSource("quarter")
    game.occlusion.addSector("quarter", 2400, 1600, 2400)
    const scale = 2400 / 1536
    expect(game.images.map(({ depth }) => depth)).toEqual([400, 405, 860, 870].map((front) => 1600 + front * scale - 30))
    expect(game.images[0]!.x).toBe(2400 + 135 * scale)
    expect(game.images[0]!.y).toBe(1600 + 70 * scale)
    expect(game.images.every(({ origin, scale: imageScale }) => origin === 0 && imageScale === scale)).toBe(true)
    const actor = player(3000, 1850)
    const before = JSON.stringify(actor)
    game.occlusion.update(actor)
    expect(JSON.stringify(actor)).toBe(before)
  })

  it("dims an overlapping roof only behind its front edge, using the actor's feet rather than its centre", () => {
    const game = fixture()
    game.addSource("quarter")
    game.occlusion.addSector("quarter", 0, 0, 1536)
    // The centre is above the roof silhouette, but the feet (y=130.2) are inside it.
    game.occlusion.update(player(400, 70))
    expect(game.images.map(({ alpha }) => alpha)).toEqual([.65, 1, 1, 1])
    // Same screen position, but in front in the painter's depth order.
    game.occlusion.update(player(400, 70, 500))
    expect(game.images.every(({ alpha }) => alpha === 1)).toBe(true)
    game.occlusion.update(player(750, 240, 50))
    expect(game.images.every(({ alpha }) => alpha === 1)).toBe(true)
  })

  it("culls roof images outside the camera and restores them when the camera returns", () => {
    const game = fixture()
    game.addSource("quarter")
    game.occlusion.addSector("quarter", 0, 0, 1536)
    const actor = player(750, 300)
    game.occlusion.update(actor)
    expect(game.images.some(({ visible }) => visible)).toBe(true)
    game.camera.x = 4000
    game.occlusion.update(actor)
    expect(game.images.every(({ visible }) => !visible)).toBe(true)
    game.camera.x = 0
    game.occlusion.update(actor)
    expect(game.images[0]!.visible).toBe(true)
  })

  it("destroys all repeated-sector images and removes each owned texture once on shutdown", () => {
    const game = fixture()
    for (const key of ["homes", "market", "workshops", "palace"]) {
      game.addSource(key)
      game.occlusion.addSector(key, 0, 0, 2400)
      game.occlusion.addSector(key, 2400, 1600, 2400)
    }
    game.events.emit("shutdown")
    game.events.emit("shutdown")
    expect(game.images).toHaveLength(32)
    for (const image of game.images) expect(image.destroy).toHaveBeenCalledTimes(1)
    expect(game.textures.remove).toHaveBeenCalledTimes(16)
    expect(new Set(game.textures.remove.mock.calls.map(([key]) => key)).size).toBe(16)
    expect([...game.entries.keys()].sort()).toEqual(["homes", "market", "palace", "workshops"])
    expect(() => game.occlusion.update(player(400, 38))).not.toThrow()
  })

  it("does not remove a pre-existing roof texture that it did not create", () => {
    const game = fixture()
    game.addSource("quarter")
    const borrowed = canvasTexture(540, 305)
    game.entries.set("quarter-roof-0", borrowed)
    game.occlusion.addSector("quarter", 0, 0, 1536)
    game.events.emit("shutdown")
    expect(game.textures.createCanvas).toHaveBeenCalledTimes(3)
    expect(game.textures.remove).toHaveBeenCalledTimes(3)
    expect(game.textures.remove).not.toHaveBeenCalledWith("quarter-roof-0")
    expect(game.entries.get("quarter-roof-0")).toBe(borrowed)
    expect(borrowed.context.drawImage).not.toHaveBeenCalled()
    expect(game.entries.has("quarter")).toBe(true)
  })
})
