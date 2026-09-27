import { describe, expect, it, vi } from "vitest"
import { ActionTimeline } from "../../src/game/animation/ActionTimeline"
import { ACTOR_ACTIONS, ACTOR_CATALOG, ACTORS, FACINGS, actorClip, clipFrameIndex, facingFromMovement } from "../../src/game/animation/catalog"
import { CHARACTERS } from "../../src/domain/characters"
import { HERO_RIGS } from "../../src/game/animation/heroRigs"

describe("animation catalog", () => {
  it("covers 5 heroes, 19 enemies and 17 residents without duplicate keys", () => {
    expect(ACTOR_CATALOG).toHaveLength(41)
    expect(ACTORS.size).toBe(41)
    expect(ACTOR_CATALOG.filter(({ family }) => family === "hero")).toHaveLength(5)
    expect(ACTOR_CATALOG.filter(({ family }) => family === "resident")).toHaveLength(17)
    for (const hero of CHARACTERS) expect(ACTORS.has(hero.assetKey)).toBe(true)
  })

  it("has bounded clips in four separately drawn directions", () => {
    for (const facing of FACINGS) {
      for (const action of ACTOR_ACTIONS) {
        const clip = actorClip(action, facing)
        expect(clip.duration).toBeGreaterThan(0)
        expect(clip.frames.every((frame) => Number.isInteger(frame) && frame >= 0 && frame < 96)).toBe(true)
      }
      expect(new Set(actorClip("walk", facing).frames).size).toBe(8)
      expect(new Set(actorClip("idle", facing).frames).size).toBe(4)
    }
    expect(new Set(FACINGS.flatMap((facing) => actorClip("walk", facing).frames)).size).toBe(32)
  })

  it("enables only reviewed hero cutout rigs without replacing combat clips", () => {
    const heroes = ACTOR_CATALOG.filter(({ family }) => family === "hero")
    for (const hero of heroes) expect(Boolean(hero.rigSheet)).toBe(HERO_RIGS.has(hero.key))
    for (const key of HERO_RIGS) expect(ACTORS.get(key)?.family).toBe("hero")
    expect(ACTOR_CATALOG.filter(({ family, rigSheet }) => family !== "hero" && rigSheet)).toHaveLength(0)
    const extras = { motion: true, actions: true, moving: true }
    expect(actorClip("attack", "left", true, extras).sheet).toBe("motion")
    expect(actorClip("throw", "left", true, extras).sheet).toBe("motion")
    expect(actorClip("heal", "left", true, extras).sheet).toBe("utility")
  })

  it("keeps the last facing when stationary and chooses the dominant diagonal", () => {
    expect(facingFromMovement(0, 0, "left")).toBe("left")
    expect(facingFromMovement(10, 2)).toBe("right")
    expect(facingFromMovement(-4, -20)).toBe("up")
    expect(facingFromMovement(-40, 2)).toBe("left")
    expect(facingFromMovement(4, 20)).toBe("down")
  })

  it("aligns contact poses with both short hero windups and long boss telegraphs", () => {
    expect(clipFrameIndex(8, 119, 450, false, 120)).toBe(2)
    expect(clipFrameIndex(8, 120, 450, false, 120)).toBe(3)
    expect(clipFrameIndex(8, 600, 900, false, 600)).toBe(3)
    expect(clipFrameIndex(8, 450, 450, false, 120)).toBe(7)
  })

  it("uses unique utility poses for conversations and falls", () => {
    for (const facing of FACINGS) {
      expect(new Set(actorClip("talk", facing, true).frames).size).toBe(6)
      expect(new Set(actorClip("defeat", facing, true).frames).size).toBe(6)
      expect(actorClip("heal", facing, true).sheet).toBe("utility")
    }
  })

  it("uses separate running, moving-attack, tool and boss-special artwork", () => {
    for (const facing of FACINGS) {
      const moving = { motion: true, moving: true }
      expect(actorClip("run", facing, true, moving).sheet).toBe("motion")
      expect(actorClip("attack", facing, true, moving).sheet).toBe("motion")
      expect(actorClip("attack", facing, true, { ...moving, moving: false }).sheet).toBeUndefined()
      expect(actorClip("throw", facing, true, { actions: true }).sheet).toBe("actions")
      expect(actorClip("mine", facing, true, { actions: true }).frames).toHaveLength(8)
      expect(new Set(actorClip("talk", facing, false, { family: "resident" }).frames).size).toBe(6)
      const tail = actorClip("tail", facing, false, { special: "walrus" })
      const tusks = actorClip("tusks", facing, false, { special: "walrus" })
      expect(tail.sheet).toBe("special")
      expect(tail.frames).not.toEqual(tusks.frames)
      expect(actorClip("core-open", facing, false, { special: "turtle-guardian" }).sheet).toBe("special")
    }
  })
})

describe("scene-time action markers", () => {
  it("hits exactly at120ms once, completes at450ms and does not advance while paused", () => {
    const clock = new ActionTimeline()
    const impact = vi.fn()
    const done = vi.fn()
    clock.start({ duration: 450, impactAt: 120, onImpact: impact, onComplete: done })
    clock.tick(119)
    clock.tick(5000, true)
    expect(impact).not.toHaveBeenCalled()
    clock.tick(1)
    expect(impact).toHaveBeenCalledTimes(1)
    clock.tick(330)
    clock.tick(500)
    expect(done).toHaveBeenCalledTimes(1)
    expect(impact).toHaveBeenCalledTimes(1)
  })

  it("cancels all old markers when replaced, even inside an impact callback", () => {
    const clock = new ActionTimeline()
    const stale = vi.fn()
    const cleanup = vi.fn()
    clock.start({ markers: [{ at: 50, callback: () => clock.start({ duration: 1000 }) }, { at: 51, callback: stale }], onCancel: cleanup })
    clock.tick(500)
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
    expect(clock.elapsed).toBe(0)
  })

  it("runs a volley in chronological order and drops it on disposal", () => {
    const clock = new ActionTimeline()
    const fired: number[] = []
    clock.start({ duration: 800, markers: [600, 200, 400].map((at) => ({ at, callback: () => fired.push(at) })) })
    clock.tick(450)
    expect(fired).toEqual([200, 400])
    clock.cancel()
    clock.tick(5000)
    expect(fired).toEqual([200, 400])
  })

  it("does not duplicate marker side effects on looping gallery/ambient clips", () => {
    const clock = new ActionTimeline()
    const marker = vi.fn()
    clock.start({ loop: true, duration: 800, onImpact: marker })
    clock.tick(10000)
    expect(clock.looping).toBe(true)
    expect(marker).toHaveBeenCalledTimes(1)
  })
})
