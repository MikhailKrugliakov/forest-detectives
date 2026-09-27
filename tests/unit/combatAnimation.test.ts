import type Phaser from "phaser"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CombatController, type CombatEnemyRuntime } from "../../src/game/CombatController"
import { ENEMIES } from "../../src/domain/quests"
import { gameStore } from "../../src/domain/GameStore"
import { ActionTimeline } from "../../src/game/animation/ActionTimeline"
import { clipFrameIndex } from "../../src/game/animation/catalog"

const animation = vi.hoisted(() => ({ play: vi.fn(), face: vi.fn(), dispose: vi.fn(), attach: vi.fn() }))
vi.mock("phaser", () => ({ default: {} }))
vi.mock("../../src/game/animation/AnimatedActor", () => ({
  actorFor: () => animation,
  attachActor: animation.attach,
}))

function fixtures(boss = false) {
  const sprite = {
    active: true, x: 200, y: 300, width: 200, height: 300,
    body: { enable: true, setSize: vi.fn(), setOffset: vi.fn() },
    scene: {},
    setTint: vi.fn().mockReturnThis(), clearTint: vi.fn(),
    setVelocity: vi.fn().mockReturnThis(),
    setActive: vi.fn(function (this: { active: boolean }, active: boolean) { this.active = active; return this }),
    destroy: vi.fn(),
  }
  const enemy = {
    definition: { ...ENEMIES[0]!, rank: boss ? "boss" : "normal" },
    sprite, hp: 6, maxHp: 6,
    healthBack: { width: 72, destroy: vi.fn() },
    healthFill: { width: 70, destroy: vi.fn() },
    rankText: { destroy: vi.fn() },
  }
  const scene = { time: { delayedCall: vi.fn() }, tweens: { add: vi.fn() } }
  return { sprite, enemy, scene, runtime: enemy as unknown as CombatEnemyRuntime }
}

describe("combat animation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gameStore.reset()
    gameStore.selectCharacter("wolf")
  })

  it("attaches artwork only after establishing a fixed physics footprint", () => {
    const combat = new CombatController()
    const { sprite } = fixtures()
    combat.configureEnemyBody(sprite as unknown as Phaser.Physics.Arcade.Image)
    expect(sprite.body.setSize).toHaveBeenCalledWith(100, 102.00000000000001)
    expect(animation.attach).toHaveBeenCalledWith(sprite.scene, sprite)
    expect(sprite.body.setOffset).toHaveBeenCalledOnce()
  })

  it("shows hurt without tweening the collision body through roads or walls", () => {
    const combat = new CombatController()
    const { runtime, scene, sprite, enemy } = fixtures()
    expect(combat.hitEnemy(scene as unknown as Phaser.Scene, runtime, 2, { x: 1, y: 0 } as Phaser.Math.Vector2, 70)).toBe(false)
    expect(enemy.hp).toBe(4)
    expect(enemy.healthFill.width).toBeCloseTo(70 * 4 / 6)
    expect(animation.play).toHaveBeenCalledWith("hurt", { duration: 180 })
    expect(scene.tweens.add).not.toHaveBeenCalled()
    expect([sprite.x, sprite.y]).toEqual([200, 300])
    expect(sprite.setVelocity.mock.calls[0]![0]).toBeCloseTo(200)
    expect(sprite.setVelocity.mock.calls[0]![1]).toBe(0)
    expect(combat.isEnemyRecoiling(runtime)).toBe(true)
  })

  it("lets physics handle recoil for 140 active milliseconds without AI overwriting it", () => {
    const combat = new CombatController()
    const { runtime, scene, sprite } = fixtures()
    combat.hitEnemy(scene as unknown as Phaser.Scene, runtime, 1, { x: 3, y: 4 } as Phaser.Math.Vector2, 70, 14)
    expect(sprite.setVelocity.mock.calls[0]![0]).toBeCloseTo(60)
    expect(sprite.setVelocity.mock.calls[0]![1]).toBeCloseTo(80)
    combat.advance(90)
    expect(combat.isEnemyRecoiling(runtime)).toBe(true)
    combat.advance(5000, true)
    expect(combat.isEnemyRecoiling(runtime)).toBe(true)
    combat.advance(50)
    expect(combat.isEnemyRecoiling(runtime)).toBe(false)
    expect(sprite.setVelocity).toHaveBeenLastCalledWith(0, 0)
    expect([sprite.x, sprite.y]).toEqual([200, 300])
  })

  it("does not interrupt a boss phase timeline on every small hit", () => {
    const { runtime, scene, sprite } = fixtures(true)
    const combat = new CombatController()
    combat.hitEnemy(scene as unknown as Phaser.Scene, runtime, 1, { x: 1, y: 0 } as Phaser.Math.Vector2, 70)
    expect(animation.play).not.toHaveBeenCalled()
    expect(sprite.setVelocity).not.toHaveBeenCalled()
    expect(combat.isEnemyRecoiling(runtime)).toBe(false)
  })

  it("does not displace anchored siege engines or leave recoil after reset", () => {
    const combat = new CombatController()
    const { runtime, scene, sprite } = fixtures()
    runtime.definition = { ...runtime.definition, speed: 0 }
    combat.hitEnemy(scene as unknown as Phaser.Scene, runtime, 1, { x: 1, y: 0 } as Phaser.Math.Vector2, 70)
    expect(sprite.setVelocity).not.toHaveBeenCalled()
    expect(combat.isEnemyRecoiling(runtime)).toBe(false)
    runtime.definition = { ...runtime.definition, speed: 100 }
    combat.hitEnemy(scene as unknown as Phaser.Scene, runtime, 1, { x: 1, y: 0 } as Phaser.Math.Vector2, 70)
    expect(combat.isEnemyRecoiling(runtime)).toBe(true)
    combat.reset()
    expect(combat.isEnemyRecoiling(runtime)).toBe(false)
  })

  it("disables combat immediately but keeps the defeat artwork until its final frame", () => {
    const { runtime, sprite, enemy } = fixtures()
    new CombatController().destroyEnemy(runtime)
    expect(sprite.active).toBe(false)
    expect(sprite.body.enable).toBe(false)
    expect(enemy.healthFill.destroy).toHaveBeenCalledOnce()
    expect(sprite.destroy).not.toHaveBeenCalled()
    const [action, options] = animation.play.mock.calls[0]!
    expect(action).toBe("defeat")
    options.onComplete()
    expect(sprite.destroy).toHaveBeenCalledOnce()
    expect(animation.dispose).toHaveBeenCalledOnce()
  })

  it("keeps the 450 ms player attack cooldown", () => {
    const combat = new CombatController()
    expect(combat.tryBeginAttack(1000)).toBe(true)
    expect(combat.tryBeginAttack(1119)).toBe(false)
    expect(combat.tryBeginAttack(1449)).toBe(false)
    expect(combat.tryBeginAttack(1450)).toBe(true)
  })

  it("keeps immediate enemy contacts on their impact pose with one zero-time marker", () => {
    const timeline = new ActionTimeline()
    const damage = vi.fn()
    timeline.start({ duration: 450, impactAt: 0, onImpact: damage })
    expect(clipFrameIndex(8, 0, 450, false, timeline.impactAt)).toBe(3)
    timeline.tick(0, true)
    expect(damage).not.toHaveBeenCalled()
    timeline.tick(0)
    expect(damage).toHaveBeenCalledOnce()
    timeline.tick(16)
    timeline.tick(450)
    expect(damage).toHaveBeenCalledOnce()
  })

  it("freezes combat deadlines during modal time and resets them on scene reentry", () => {
    const combat = new CombatController()
    expect(combat.advance(16)).toBe(16)
    expect(combat.advance(5000, true)).toBe(16)
    expect(combat.advance(16)).toBe(32)
    combat.reset()
    expect(combat.now).toBe(0)
  })

  it("starts defeat rather than hurt when the player loses all health", () => {
    const combat = new CombatController()
    const { scene, sprite } = fixtures()
    const result = combat.damagePlayer(scene as unknown as Phaser.Scene, sprite as unknown as Phaser.Physics.Arcade.Image, 1000, 100, 300, 1000, false)
    expect(result).toBe("knocked-out")
    expect(animation.play).toHaveBeenCalledWith("defeat", { duration: 600 })
    expect(sprite.body.enable).toBe(false)
    expect(sprite.setVelocity).toHaveBeenCalledWith(0, 0)
  })
})
