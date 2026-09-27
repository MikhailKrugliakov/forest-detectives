import Phaser from "phaser"
import { gameStore } from "../domain/GameStore"
import { rescaleRemainingHealth, scaledEnemyDamage, scaledEnemyHealth } from "../domain/difficulty"
import type { DifficultyId, EnemyDefinition, EnemyGearDrop } from "../domain/types"
import { actorFor, attachActor } from "./animation/AnimatedActor"

export interface CombatEnemyRuntime {
  definition: EnemyDefinition
  sprite: Phaser.Physics.Arcade.Image
  hp: number
  maxHp: number
  healthBack: Phaser.GameObjects.Rectangle
  healthFill: Phaser.GameObjects.Rectangle
  rankText: Phaser.GameObjects.Text
}

export type PlayerDamageResult = "ignored" | "shielded" | "hurt" | "knocked-out"

export class CombatController {
  now = 0
  private lastAttackAt = -1000
  private invulnerableUntil = 0
  private combatStartsAt = 0
  private recoilUntil = new WeakMap<Phaser.Physics.Arcade.Image, number>()

  reset(): void {
    this.now = 0
    this.lastAttackAt = -1000
    this.invulnerableUntil = 0
    this.combatStartsAt = 0
    this.recoilUntil = new WeakMap()
  }

  /** Unlike Clock.now, this clock cannot jump forward while a modal is open. */
  advance(delta: number, paused = false): number {
    if (!paused) this.now += Math.max(0, delta)
    return this.now
  }

  arm(time: number, delay = 1400): void {
    this.combatStartsAt = time + delay
  }

  tryBeginAttack(time: number, cooldown = 450): boolean {
    if (time - this.lastAttackAt < cooldown) return false
    this.lastAttackAt = time
    return true
  }

  canDamagePlayer(time: number): boolean {
    return time >= this.invulnerableUntil && time >= this.combatStartsAt
  }

  damagePlayer(
    scene: Phaser.Scene,
    player: Phaser.Physics.Arcade.Image,
    amount: number,
    sourceX: number,
    sourceY: number,
    time: number,
    shieldActive: boolean,
  ): PlayerDamageResult {
    const scaledDamage = scaledEnemyDamage({ damage: amount }, gameStore.state.difficulty)
    if (scaledDamage === 0) return "ignored"
    if (!this.canDamagePlayer(time)) return "ignored"
    this.invulnerableUntil = time + 1000
    if (shieldActive) return "shielded"

    const result = gameStore.takeDamage(scaledDamage)
    actorFor(player)?.play(result.knockedOut ? "defeat" : "hurt", { duration: result.knockedOut ? 600 : 180 })
    player.setTint(0xff8b72)
    scene.time.delayedCall(180, () => {
      if (player.active) player.clearTint()
    })
    if (result.knockedOut) {
      player.setVelocity(0, 0)
      ;(player.body as Phaser.Physics.Arcade.Body).enable = false
      return "knocked-out"
    }
    const dx = player.x - sourceX
    const dy = player.y - sourceY
    const length = Math.hypot(dx, dy) || 1
    player.setVelocity((dx / length) * 430, (dy / length) * 430)
    return "hurt"
  }

  hitEnemy(
    scene: Phaser.Scene,
    enemy: CombatEnemyRuntime,
    damage: number,
    direction: Phaser.Math.Vector2,
    healthBarWidth: number,
    knockback = 28,
  ): boolean {
    enemy.hp = Math.max(0, enemy.hp - damage)
    enemy.healthFill.width = healthBarWidth * (enemy.hp / enemy.maxHp)
    enemy.sprite.setTint(0xffb3a8)
    scene.time.delayedCall(110, () => {
      if (enemy.sprite.active) enemy.sprite.clearTint()
    })
    // Arcade velocity respects solid colliders. Never tween the physics
    // carrier's coordinates: that bypassed walls and road constraints.
    if (enemy.hp > 0 && enemy.definition.rank !== "boss") {
      actorFor(enemy.sprite)?.face(-direction.x, -direction.y)
      actorFor(enemy.sprite)?.play("hurt", { duration: 180 })
      const length = Math.hypot(direction.x, direction.y)
      if (knockback > 0 && Number.isFinite(knockback) && length > 0 && enemy.definition.speed > 0) {
        const duration = 140
        const speed = knockback / (duration / 1000)
        enemy.sprite.setVelocity(direction.x / length * speed, direction.y / length * speed)
        this.recoilUntil.set(enemy.sprite, this.now + duration)
      }
    }
    return enemy.hp === 0
  }

  /** AI yields briefly to a collision-safe recoil; modal time stays frozen. */
  isEnemyRecoiling(enemy: CombatEnemyRuntime): boolean {
    const until = this.recoilUntil.get(enemy.sprite)
    if (until == null) return false
    if (enemy.sprite.active && this.now < until) return true
    this.recoilUntil.delete(enemy.sprite)
    enemy.sprite.setVelocity(0, 0)
    return false
  }

  rescaleEnemies(
    enemies: readonly CombatEnemyRuntime[],
    previousDifficulty: DifficultyId,
    nextDifficulty: DifficultyId,
  ): void {
    for (const enemy of enemies) {
      if (!enemy.sprite.active) continue
      const previousMax = scaledEnemyHealth(enemy.definition, previousDifficulty)
      const nextMax = scaledEnemyHealth(enemy.definition, nextDifficulty)
      enemy.hp = rescaleRemainingHealth(enemy.hp, previousMax, nextMax)
      enemy.maxHp = nextMax
      const width = Math.max(1, enemy.healthBack.width - 2)
      enemy.healthFill.width = width * (enemy.hp / enemy.maxHp)
    }
  }

  recordDefeat(enemy: CombatEnemyRuntime, x: number, y: number): { firstDefeat: boolean; drop: EnemyGearDrop | null } {
    const firstDefeat = gameStore.defeatEnemy(enemy.definition.id, Date.now(), x, y)
    const latestDrop = gameStore.state.enemyGearDrops.at(-1)
    return {
      firstDefeat,
      drop: latestDrop?.enemyId === enemy.definition.id ? latestDrop : null,
    }
  }

  destroyEnemy(enemy: CombatEnemyRuntime): void {
    this.recoilUntil.delete(enemy.sprite)
    const actor = actorFor(enemy.sprite)
    enemy.sprite.setVelocity(0, 0).setActive(false)
    ;(enemy.sprite.body as Phaser.Physics.Arcade.Body).enable = false
    if (actor) actor.play("defeat", { duration: 500, onComplete: () => {
      actor.dispose()
      enemy.sprite.destroy()
    } })
    else enemy.sprite.destroy()
    enemy.healthBack.destroy()
    enemy.healthFill.destroy()
    enemy.rankText.destroy()
  }

  scheduleRespawn(scene: Phaser.Scene, delay: number, respawn: () => void): void {
    scene.time.delayedCall(delay, respawn)
  }

  addSolidEnemyCollision(
    scene: Phaser.Scene,
    enemy: Phaser.Physics.Arcade.Image,
    player: Phaser.Physics.Arcade.Image,
    onCollision?: () => void,
  ): Phaser.Physics.Arcade.Collider {
    return scene.physics.add.collider(enemy, player, () => onCollision?.())
  }

  configureEnemyBody(enemy: Phaser.Physics.Arcade.Image): void {
    const body = enemy.body as Phaser.Physics.Arcade.Body
    const width = enemy.width * 0.5
    const height = enemy.height * 0.34
    body.setSize(width, height)
    body.setOffset(
      (enemy.width - width) / 2,
      enemy.height - height - enemy.height * 0.07,
    )
    attachActor(enemy.scene, enemy)
  }

  bodiesOverlap(player: Phaser.Physics.Arcade.Image, enemies: readonly CombatEnemyRuntime[]): boolean {
    const playerBody = player.body as Phaser.Physics.Arcade.Body
    return enemies.some(({ sprite }) => {
      if (!sprite.active) return false
      const enemyBody = sprite.body as Phaser.Physics.Arcade.Body
      return playerBody.x < enemyBody.x + enemyBody.width &&
        playerBody.x + playerBody.width > enemyBody.x &&
        playerBody.y < enemyBody.y + enemyBody.height &&
        playerBody.y + playerBody.height > enemyBody.y
    })
  }
}
