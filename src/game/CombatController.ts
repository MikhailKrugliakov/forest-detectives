import Phaser from "phaser"
import { gameStore } from "../domain/GameStore"
import type { EnemyDefinition, EnemyGearDrop } from "../domain/types"

export interface CombatEnemyRuntime {
  definition: EnemyDefinition
  sprite: Phaser.Physics.Arcade.Image
  hp: number
  healthBack: Phaser.GameObjects.Rectangle
  healthFill: Phaser.GameObjects.Rectangle
  rankText: Phaser.GameObjects.Text
}

export type PlayerDamageResult = "ignored" | "shielded" | "hurt" | "knocked-out"

export class CombatController {
  private lastAttackAt = -1000
  private invulnerableUntil = 0
  private combatStartsAt = 0

  reset(): void {
    this.lastAttackAt = -1000
    this.invulnerableUntil = 0
    this.combatStartsAt = 0
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
    if (!this.canDamagePlayer(time)) return "ignored"
    this.invulnerableUntil = time + 1000
    if (shieldActive) return "shielded"

    const result = gameStore.takeDamage(amount)
    player.setTint(0xff8b72)
    scene.time.delayedCall(180, () => {
      if (player.active) player.clearTint()
    })
    const dx = player.x - sourceX
    const dy = player.y - sourceY
    const length = Math.hypot(dx, dy) || 1
    player.setVelocity((dx / length) * 430, (dy / length) * 430)
    return result.knockedOut ? "knocked-out" : "hurt"
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
    enemy.healthFill.width = healthBarWidth * (enemy.hp / enemy.definition.hp)
    enemy.sprite.setTint(0xffffff)
    scene.time.delayedCall(110, () => {
      if (enemy.sprite.active) enemy.sprite.clearTint()
    })
    scene.tweens.add({
      targets: enemy.sprite,
      x: enemy.sprite.x + direction.x * knockback,
      duration: 90,
      yoyo: true,
    })
    return enemy.hp === 0
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
    enemy.sprite.destroy()
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
