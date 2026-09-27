import type Phaser from "phaser"
import { describe, expect, it, vi } from "vitest"
import { actorFor, attachActor } from "../../src/game/animation/AnimatedActor"
import { ACTORS } from "../../src/game/animation/catalog"

const mock = vi.hoisted(() => {
  type Listener = { fn: (...args: unknown[]) => void; context?: unknown; once: boolean }
  class Emitter {
    listeners = new Map<string, Listener[]>()
    on(event: string, fn: Listener["fn"], context?: unknown) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), { fn, context, once: false }])
      return this
    }
    once(event: string, fn: Listener["fn"], context?: unknown) {
      this.on(event, fn, context)
      this.listeners.get(event)!.at(-1)!.once = true
      return this
    }
    off(event: string, fn: Listener["fn"], context?: unknown) {
      this.listeners.set(event, (this.listeners.get(event) ?? []).filter((entry) => entry.fn !== fn || entry.context !== context))
      return this
    }
    emit(event: string, ...args: unknown[]) {
      for (const entry of [...(this.listeners.get(event) ?? [])]) {
        if (entry.once) this.off(event, entry.fn, entry.context)
        entry.fn.apply(entry.context, args)
      }
      return this
    }
  }
  return { Emitter }
})

vi.mock("phaser", () => ({ default: {
  Events: { EventEmitter: mock.Emitter },
  Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } },
  GameObjects: { Events: { DESTROY: "destroy" } },
  Textures: { Events: { ADD: "addtexture" } },
  Loader: { Events: { FILE_COMPLETE: "filecomplete", FILE_LOAD_ERROR: "loaderror" } },
  Physics: { Arcade: { Events: { WORLD_STEP: "worldstep" } } },
} }))

function texture(width = 256, height = 384) {
  const frames = new Set<string>()
  return {
    getSourceImage: () => ({ width, height }),
    has: (key: string) => frames.has(key),
    add: vi.fn((key: string, ..._bounds: number[]) => frames.add(key)),
  }
}

class Image extends mock.Emitter {
  x = 300
  y = 300
  active = true
  visible = true
  alpha = 1
  displayWidth = 100
  displayHeight = 140
  originX = 0.5
  originY = 0.5
  depth = 300
  angle = 0
  name = ""
  tintTopLeft = 0xffffff
  tintTopRight = 0xffffff
  tintBottomLeft = 0xffffff
  tintBottomRight = 0xffffff
  frame = { name: "original" }
  texture = { key: "robot-hare" }
  body = {
    width: 42, height: 42, offset: { x: 29, y: 92 }, enable: true, moves: false,
    position: { x: 0, y: 0 }, prevFrame: { x: 0, y: 0 },
  }
  setDisplaySize(width: number, height: number) { this.displayWidth = width; this.displayHeight = height; return this }
  setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this }
  setDepth(depth: number) { this.depth = depth; return this }
  setVisible(visible: boolean) { this.visible = visible; return this }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this }
  setAlpha(alpha: number) { this.alpha = alpha; return this }
  setTint() { return this }
  setAngle(angle: number) { this.angle = angle; return this }
  setRotation(angle: number) { this.angle = angle * 180 / Math.PI; return this }
  setTexture(key: string, frame: string) { this.texture.key = key; this.frame.name = frame; return this }
  destroy() { this.active = false; this.emit("destroy"); return this }
}

function textureManager() {
  const entries = new Map<string, ReturnType<typeof texture>>()
  return Object.assign(new mock.Emitter(), {
    entries,
    exists: (key: string) => entries.has(key),
    get: (key: string) => entries.get(key)!,
    remove: vi.fn((key: string) => { entries.delete(key) }),
  })
}

function fixtures(textures = textureManager(), withPhysics = false, withLocomotion = false) {
  let loading = false
  const load = Object.assign(new mock.Emitter(), {
    image: vi.fn(),
    isLoading: () => loading,
    start: vi.fn(() => { loading = true }),
  })
  const events = new mock.Emitter()
  const world = Object.assign(new mock.Emitter(), { fps: 60, fixedStep: true, timeScale: 1, _elapsed: 0 })
  const scene = {
    events, textures, load,
    physics: withPhysics ? { world } : undefined,
    add: { sprite: () => new Image(), ellipse: () => new Image() },
    cameras: { main: { worldView: { x: 0, y: 0, right: 1280, bottom: 720 } } },
  }
  const create = (key = "robot-hare") => {
    const carrier = new Image()
    carrier.texture.key = key
    const definition = ACTORS.get(key)
    // Exercise the optional loader independently of which reviewed artwork has
    // shipped. The actor retains its own definition; restore the shared catalog.
    if (withLocomotion && definition) ACTORS.set(key, { ...definition, rigSheet: `assets/animations/${key}-rig.png` })
    const actor = attachActor(scene as unknown as Phaser.Scene, carrier as unknown as Phaser.GameObjects.Image)
    if (definition) ACTORS.set(key, definition)
    return { carrier, actor }
  }
  const complete = (key: string, width?: number, height?: number) => {
    textures.entries.set(key, texture(width, height))
    textures.emit("addtexture", key)
    load.emit(`filecomplete-image-${key}`)
    load.emit("filecomplete", key)
    loading = false
  }
  const step = (carrier: Image, dx: number, dy = 0, seconds = 1 / 60) => {
    carrier.body.position.x += dx
    carrier.body.position.y += dy
    world.emit("worldstep", seconds)
  }
  const sync = (carrier: Image) => {
    carrier.x += carrier.body.position.x - carrier.body.prevFrame.x
    carrier.y += carrier.body.position.y - carrier.body.prevFrame.y
    carrier.body.prevFrame = { ...carrier.body.position }
  }
  return { scene, textures, load, events, world, create, complete, step, sync }
}

describe("animated actor runtime", () => {
  it.each(["wolf", "fox", "rabbit", "watermelon", "sheepwolf"])("%s articulates both feet in opposite directions without changing its body", async (hero) => {
    const game = fixtures(undefined, false, true)
    const { actor, carrier } = game.create(`hero-${hero}`)
    const key = `animation:hero-${hero}`
    game.complete(key, 1024, 1536)
    game.complete(`${key}:motion`, 1024, 1536)
    game.complete(`${key}:rig`, 768, 1024)
    expect(actor.locomotionReady).toBe(true)
    const texture = game.textures.get(`${key}:rig`)
    expect(texture.add).toHaveBeenCalledTimes(12)
    expect(texture.add).toHaveBeenLastCalledWith("11", 0, 512, 768, 256, 256)
    const physical = JSON.stringify(carrier.body)
    carrier.name = "gallery"
    for (const [direction, vector] of [["down", [0, 1]], ["up", [0, -1]], ["left", [-1, 0]], ["right", [1, 0]]] as const) {
      actor.face(vector[0], vector[1])
      for (const action of ["walk", "run"] as const) {
        actor.play(action, { loop: true, facing: direction })
        const feet = []
        for (let frame = 0; frame < 24; frame++) {
          actor.update(40, false)
          expect(actor.gaitSnapshot!.active).toBe(true)
          expect(actor.visual.visible).toBe(false)
          feet.push(actor.gaitSnapshot!.feet.map((foot) => ({ ...foot })))
          expect(JSON.stringify(carrier.body)).toBe(physical)
        }
        const axis = direction === "left" || direction === "right" ? "x" : "y"
        for (const leg of [0, 1]) {
          const positions = feet.map((sample) => sample[leg]![axis])
          expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(axis === "x" ? 8 : 6)
        }
        const beforePause = actor.gaitSnapshot
        actor.update(5000, true)
        expect(actor.gaitSnapshot).toEqual(beforePause)
        expect(actor.visual.visible).toBe(false)
      }
    }
    actor.play("attack")
    actor.update(20, false)
    expect(actor.gaitSnapshot!.active).toBe(false)
    expect(actor.visual.visible).toBe(true)
    actor.dispose()
    await Promise.resolve()
    expect(game.textures.exists(`${key}:rig`)).toBe(false)
    expect(game.load.listeners.get(`filecomplete-image-${key}:rig`)).toHaveLength(0)
  })

  it("keeps idle proportions on the base sheet without replacing utility actions", () => {
    const game = fixtures()
    const { actor } = game.create("hero-sheepwolf")
    game.complete("animation:hero-sheepwolf")
    game.complete("animation:hero-sheepwolf:utility")
    actor.face(-1, 0)
    actor.update(800, false)
    expect(actor.visual.texture.key).toBe("animation:hero-sheepwolf")
    expect(actor.visual.frame.name).toBe("83")
    actor.play("heal")
    actor.update(100, false)
    expect(actor.visual.texture.key).toBe("animation:hero-sheepwolf:utility")
    actor.dispose()
  })

  it("uses a constant run-row scale and restores the base scale without changing physics", () => {
    const game = fixtures()
    const { actor, carrier } = game.create("hero-watermelon")
    game.complete("animation:hero-watermelon")
    game.complete("animation:hero-watermelon:motion")
    const body = JSON.stringify(carrier.body)
    const baseHeight = actor.visual.displayHeight
    actor.setRunning(true)
    for (let frame = 0; frame < 8; frame++) {
      carrier.x += 12
      actor.update(50, false)
      expect(actor.visual.displayHeight).toBeCloseTo(baseHeight * 82 / 108)
    }
    actor.setRunning(false)
    carrier.x += 9
    actor.update(50, false)
    expect(actor.visual.displayHeight).toBe(baseHeight)
    expect(JSON.stringify(carrier.body)).toBe(body)
    actor.dispose()
  })

  it.each([120, 144])("keeps a continuous walk on a %i Hz display with 60 Hz physics", (renderHz) => {
    const game = fixtures(undefined, true)
    const { actor, carrier } = game.create("hero-wolf")
    carrier.body.moves = true
    game.complete("animation:hero-wolf")
    game.complete("animation:hero-wolf:motion")
    const frames = new Set<string>()
    let stepped = false
    for (let render = 0; render < renderHz; render++) {
      const delta = 1000 / renderHz
      game.world._elapsed += delta
      while (game.world._elapsed >= 1000 / 60) {
        game.world._elapsed -= 1000 / 60
        game.step(carrier, 3)
        stepped = true
      }
      game.sync(carrier)
      game.events.emit("postupdate", 0, delta)
      if (stepped) {
        expect(actor.action).toBe("walk")
        expect(actor.visual.texture.key).toBe("animation:hero-wolf")
        frames.add(actor.visual.frame.name)
      }
    }
    expect(frames.size).toBe(8)
    actor.dispose()
    game.events.emit("shutdown")
    expect(game.world.listeners.get("worldstep")).toHaveLength(0)
  })

  it("samples the simulation duration, not irregular render-frame duration", () => {
    const game = fixtures(undefined, true)
    const { actor, carrier } = game.create("robot-hare")
    carrier.body.moves = true
    game.complete("animation:robot-hare")
    for (const delta of [18, 10, 22, 13, 21, 15, 19, 8, 8, 24, 33]) {
      game.world._elapsed += delta
      while (game.world._elapsed >= 1000 / 60) {
        game.world._elapsed -= 1000 / 60
        game.step(carrier, 3)
      }
      game.sync(carrier)
      game.events.emit("postupdate", 0, delta)
      expect(actor.action).toBe("walk")
    }
    actor.dispose()
  })

  it("keeps moving-attack artwork on render-only frames and stops at a real collision", () => {
    const game = fixtures(undefined, true)
    const { actor, carrier } = game.create("hero-sheepwolf")
    carrier.body.moves = true
    game.complete("animation:hero-sheepwolf")
    game.complete("animation:hero-sheepwolf:motion")
    game.step(carrier, 3)
    game.sync(carrier)
    game.events.emit("postupdate", 0, 1000 / 60)
    actor.play("attack", { duration: 450, impactAt: 120 })
    for (let render = 0; render < 6; render++) {
      if (render % 2) { game.step(carrier, 3); game.sync(carrier) }
      game.events.emit("postupdate", 0, 1000 / 120)
      expect(actor.visual.texture.key).toBe("animation:hero-sheepwolf:motion")
    }
    actor.cancel()
    game.events.emit("postupdate", 0, 1000 / 120)
    expect(actor.action).toBe("walk")
    game.step(carrier, 0)
    game.sync(carrier)
    game.events.emit("postupdate", 0, 1000 / 120)
    expect(actor.action).toBe("idle")
    actor.dispose()
  })

  it("uses the hero sprint signal and preserves gait phase when changing speed", () => {
    const game = fixtures()
    const { actor, carrier } = game.create("hero-wolf")
    game.complete("animation:hero-wolf")
    game.complete("animation:hero-wolf:motion")
    carrier.x += 40.5
    actor.update(270, false)
    expect(Number(actor.visual.frame.name) % 8).toBe(3)
    actor.setRunning(true)
    carrier.x += 0.24
    actor.update(1, false)
    expect(actor.action).toBe("run")
    expect(Number(actor.visual.frame.name) % 8).toBe(3)
    actor.setRunning(false)
    carrier.x += 0.3
    actor.update(1, false)
    expect(actor.action).toBe("walk")
    expect(Number(actor.visual.frame.name) % 8).toBe(3)
    actor.dispose()
  })

  it("interpolates collision-resolved samples without moving the physical body", () => {
    const game = fixtures(undefined, true)
    const { actor, carrier } = game.create()
    carrier.body.moves = true
    const before = JSON.stringify({ width: carrier.body.width, height: carrier.body.height, offset: carrier.body.offset })
    game.step(carrier, 3)
    game.sync(carrier)
    game.events.emit("postupdate", 0, 1000 / 60)
    expect(actor.renderPosition.x).toBe(300)
    expect(carrier.x).toBe(303)
    game.world._elapsed = 1000 / 120
    game.events.emit("postupdate", 0, 1000 / 120)
    expect(actor.renderPosition.x).toBe(301.5)
    expect(actor.visual.x).toBe(301.5)
    expect(carrier.x).toBe(303)
    // A long browser frame may include a corner. Only the LAST two solved
    // positions form the interpolation segment; never cut across the corner.
    game.step(carrier, 3)
    game.step(carrier, 0, 3)
    game.sync(carrier)
    game.events.emit("postupdate", 0, 1000 / 30)
    expect(actor.renderPosition).toEqual({ x: 306, y: 301.5 })
    expect(carrier.x).toBe(306)
    expect(carrier.y).toBe(303)
    expect(JSON.stringify({ width: carrier.body.width, height: carrier.body.height, offset: carrier.body.offset })).toBe(before)
    actor.dispose()
  })

  it("freezes the interpolated position on pause and resets on teleport or defeat", () => {
    const game = fixtures(undefined, true)
    const { actor, carrier } = game.create()
    carrier.body.moves = true
    game.complete("animation:robot-hare")
    game.step(carrier, 3)
    game.sync(carrier)
    game.events.emit("postupdate", 0, 1000 / 60)
    game.world._elapsed = 1000 / 120
    game.events.emit("postupdate", 0, 1000 / 120)
    expect(actor.renderPosition.x).toBe(301.5)
    const frame = actor.visual.frame.name
    for (const alpha of [0, 0.5, 1]) {
      actor.update(5000, true, { deltaMs: 0, alpha, fixed: true })
      expect(actor.renderPosition.x).toBe(301.5)
      expect(actor.action).toBe("walk")
      expect(actor.visual.frame.name).toBe(frame)
    }
    carrier.x = 800
    game.events.emit("postupdate", 0, 1000 / 120)
    expect(actor.renderPosition.x).toBe(800)
    expect(actor.action).toBe("idle")
    actor.play("defeat")
    carrier.body.enable = false
    game.events.emit("postupdate", 0, 1000 / 120)
    expect(actor.renderPosition.x).toBe(800)
    expect(actor.action).toBe("defeat")
    actor.dispose()
  })

  it("keeps manually patrolled residents moving on every render frame", () => {
    const game = fixtures(undefined, true)
    const { actor, carrier } = game.create("krok-resident")
    carrier.body.moves = false
    game.complete("animation:krok-resident")
    for (let render = 0; render < 12; render++) {
      carrier.x += 40 / 120
      game.events.emit("postupdate", 0, 1000 / 120)
      expect(actor.action).toBe("walk")
      expect(actor.renderPosition.x).toBe(carrier.x)
    }
    actor.dispose()
  })

  it("removes loader listeners on shutdown, including failed pending extra sheets", () => {
    const game = fixtures()
    game.create("hero-fox")
    expect(game.load.listeners.get("filecomplete")).toHaveLength(1)
    game.events.emit("shutdown")
    expect(game.load.listeners.get("filecomplete")).toHaveLength(0)
    expect(game.load.listeners.get("loaderror")).toHaveLength(0)
    for (const entries of game.load.listeners.values()) expect(entries).toHaveLength(0)
  })

  it("selects the moving attack atlas after collisions and keeps the same contact marker", () => {
    const game = fixtures()
    const { actor, carrier } = game.create("hero-wolf")
    for (const suffix of ["", ":utility", ":actions", ":motion"]) game.complete(`animation:hero-wolf${suffix}`)
    const hit = vi.fn()
    actor.play("attack", { duration: 450, impactAt: 120, onImpact: hit })
    carrier.x += 8
    actor.update(60, false)
    expect(actor.visual.texture.key).toBe("animation:hero-wolf:motion")
    actor.update(60, false)
    expect(hit).toHaveBeenCalledOnce()
    expect(actor.visual.texture.key).toBe("animation:hero-wolf")
    expect(carrier.body.width).toBe(42)
    actor.dispose()
  })
  it("deduplicates shared sheets and only releases after the last actor", async () => {
    const game = fixtures()
    const first = game.create()
    const second = game.create()
    expect(game.load.image).toHaveBeenCalledTimes(1)
    game.complete("animation:robot-hare")
    expect(first.actor.ready).toBe(true)
    expect(first.actor.visual.originY).toBe(118 / 128)
    expect(second.actor.ready).toBe(true)
    first.actor.dispose()
    await Promise.resolve()
    expect(game.textures.exists("animation:robot-hare")).toBe(true)
    second.actor.dispose()
    await Promise.resolve()
    expect(game.textures.exists("animation:robot-hare")).toBe(false)
  })

  it("does not remove a texture retained by the next scene before cleanup runs", async () => {
    const old = fixtures()
    const first = old.create()
    old.complete("animation:robot-hare")
    first.actor.dispose()
    const next = fixtures(old.textures)
    const second = next.create()
    await Promise.resolve()
    expect(second.actor.ready).toBe(true)
    expect(next.textures.exists("animation:robot-hare")).toBe(true)
    expect(next.load.image).not.toHaveBeenCalled()
    second.actor.dispose()
  })

  it("releases an orphan texture decoded after its actor was already disposed", async () => {
    const game = fixtures()
    const { actor } = game.create()
    actor.dispose()
    await Promise.resolve()
    game.complete("animation:robot-hare")
    await Promise.resolve()
    expect(game.textures.exists("animation:robot-hare")).toBe(false)
    expect(actor.ready).toBe(false)
  })

  it("keeps idle animation advancing when callers repeat setState(idle)", () => {
    const game = fixtures()
    const { actor } = game.create()
    game.complete("animation:robot-hare")
    for (let frame = 0; frame < 6; frame++) {
      actor.setState("idle")
      actor.update(100, false)
    }
    expect(actor.visual.frame.name).toBe("65")
    actor.dispose()
  })

  it("keeps physics dimensions fixed, latches attack facing, and pauses its marker", () => {
    const game = fixtures()
    const { actor, carrier } = game.create()
    game.complete("animation:robot-hare")
    const before = JSON.stringify(carrier.body)
    const hit = vi.fn()
    actor.face(1, 0)
    actor.play("attack", { duration: 450, impactAt: 120, onImpact: hit })
    actor.face(-1, 0)
    actor.update(119, false)
    expect(actor.facing).toBe("right")
    actor.update(5000, true)
    expect(hit).not.toHaveBeenCalled()
    actor.update(1, false)
    expect(hit).toHaveBeenCalledOnce()
    expect(actor.visual.frame.name).toBe("59")
    actor.update(330, false)
    expect(actor.facing).toBe("left")
    expect(JSON.stringify(carrier.body)).toBe(before)
    actor.dispose()
  })

  it("uses the loaded utility clip duration and restores the carrier on detach", () => {
    const game = fixtures()
    const { actor, carrier } = game.create("hero-fox")
    game.complete("animation:hero-fox")
    game.complete("animation:hero-fox:utility")
    actor.play("interact")
    expect(actor.timeline.duration).toBe(450)
    expect(carrier.visible).toBe(false)
    actor.dispose()
    expect(carrier.visible).toBe(true)
    expect(actorFor(carrier as unknown as Phaser.GameObjects.Image)).toBeUndefined()
    const replacement = attachActor(game.scene as unknown as Phaser.Scene, carrier as unknown as Phaser.GameObjects.Image)
    replacement.update(16, false)
    expect(replacement.visual.visible).toBe(true)
    replacement.dispose()
  })

  it("keeps hovering wings moving and rolls a snowball without rotating its body", () => {
    const game = fixtures()
    const bird = game.create("robot-sparrow")
    game.complete("animation:robot-sparrow")
    bird.actor.update(160, false)
    expect(bird.actor.action).toBe("idle")
    expect(bird.actor.clip.frames).toHaveLength(8)
    expect(bird.actor.visual.frame.name).toBe("2")
    const ball = game.create("snowball")
    game.complete("animation:snowball")
    ball.carrier.x += 15
    ball.actor.update(100, false)
    expect(ball.actor.action).toBe("walk")
    expect(ball.actor.visual.angle).not.toBe(0)
    expect(ball.carrier.angle).toBe(0)
    bird.actor.dispose()
    ball.actor.dispose()
  })

  it("cancels pending impacts on scene shutdown and on defeat", () => {
    const game = fixtures()
    const { actor, carrier } = game.create()
    const hit = vi.fn()
    actor.play("attack", { duration: 450, impactAt: 120, onImpact: hit })
    actor.play("defeat", { duration: 500 })
    actor.play("walk")
    actor.update(200, false)
    expect(actor.action).toBe("defeat")
    expect(hit).not.toHaveBeenCalled()
    game.events.emit("shutdown")
    expect(actorFor(carrier as unknown as Phaser.GameObjects.Image)).toBeUndefined()
    expect(actor.visual.active).toBe(false)
    actor.update(1000, false)
    expect(hit).not.toHaveBeenCalled()
  })
})
