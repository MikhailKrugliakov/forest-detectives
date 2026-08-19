import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { gameStore } from "../../domain/GameStore"
import { GADGETS } from "../../domain/gadgets"
import { MOUNTAIN_ENEMIES, MOUNTAIN_ENTRY, MOUNTAIN_GUARDIAN_IDS, MOUNTAIN_HEIGHT, MOUNTAIN_WIDTH } from "../../domain/mountain"
import { PRODUCE } from "../../domain/produce"
import { ENEMY_RANK_LABELS } from "../../domain/quests"
import { RESOURCES } from "../../domain/resources"
import { calculateAttackDamage } from "../../domain/rules"
import { MOUNTAIN_ROADS } from "../../domain/roads"
import type { EnemyDefinition, ProduceId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { CombatController } from "../CombatController"
import { RoadCollisionController } from "../RoadCollisionController"
import { addResourceNode, collectResourceNode, resourceIdFromObjectType, resourcePrompt, type RuntimeResourceNode } from "../WorldResources"
import { COLORS, FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"

interface RuntimeEnemy {
  definition: EnemyDefinition
  sprite: Phaser.Physics.Arcade.Image
  hp: number
  homeX: number
  homeY: number
  patrolAngle: number
  healthBack: Phaser.GameObjects.Rectangle
  healthFill: Phaser.GameObjects.Rectangle
  rankText: Phaser.GameObjects.Text
  nextSpecialAt: number
}

interface GearPickup {
  id: string
  x: number
  y: number
  marker: Phaser.GameObjects.Container
}

const AI_RADIUS_SQ = 1_000_000

export class MountainHollowScene extends BaseWorldScene {
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private enemies: RuntimeEnemy[] = []
  private pickups: GearPickup[] = []
  private resources: RuntimeResourceNode[] = []
  private nearestPickup: GearPickup | null = null
  private nearestResource: RuntimeResourceNode | null = null
  private atExit = false
  private lastPrompt = ""
  private readonly combat = new CombatController()
  private readonly roadCollision = new RoadCollisionController(MOUNTAIN_ROADS)
  private shieldUntil = 0
  private shieldLastUsed = -10000
  private returningToVillage = false
  private enemyPlayerCollisions = 0

  constructor() {
    super("mountain-hollow")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("main-menu")
      return
    }
    gameStore.setLocation("mountain-hollow")
    this.resetRuntimeState()
    this.cameras.main.setBackgroundColor("#243b3f")
    this.add.image(1200, 800, "mountain-hollow-west-bg").setDisplaySize(2400, 1600).setDepth(0)
    this.add.image(3600, 800, "mountain-hollow-east-bg").setDisplaySize(2400, 1600).setDepth(0)
    const debugParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
    const debugX = Number(debugParams?.get("x"))
    const debugY = Number(debugParams?.get("y"))
    const spawn = Number.isFinite(debugX) && Number.isFinite(debugY) && debugParams?.has("x") && debugParams.has("y")
      ? { x: Phaser.Math.Clamp(debugX, 80, MOUNTAIN_WIDTH - 80), y: Phaser.Math.Clamp(debugY, 80, MOUNTAIN_HEIGHT - 80) }
      : MOUNTAIN_ENTRY
    this.setupWorld(
      character,
      MOUNTAIN_WIDTH,
      MOUNTAIN_HEIGHT,
      spawn.x,
      spawn.y,
      character.id === "watermelon" ? 96 : 102,
      character.id === "watermelon" ? 112 : 140,
    )
    this.roadCollision.track(this.player, true)
    this.obstacles = this.loadMapCollisions("mountain-hollow-map")
    this.createEnemies()
    this.createPickups()
    this.createResources()
    this.createExit()
    EventBus.on("debug-damage-enemy", this.handleDebugDamageEnemy, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off("debug-damage-enemy", this.handleDebugDamageEnemy, this)
    })
    this.combat.arm(this.time.now)
    this.updateDiagnostics()
    updateGameStatus("mountain-hollow", `Горная Лощина. Побед: ${gameStore.state.mountainEnemyDefeats}.`)
    this.cameras.main.fadeIn(300, 20, 38, 43)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.time.delayedCall(350, () => {
      EventBus.emit(
        GameEvents.showMessage,
        gameStore.state.mountainCleared
          ? "Горная Лощина свободна. Можно собрать оставшиеся ресурсы."
          : "Впереди робонасекомые и арена двух медведей-стражников.",
        4800,
      )
    })
  }

  update(time: number, delta: number): void {
    if (!this.player?.body || this.returningToVillage) return
    const playerOnRoad = this.roadCollision.constrain(this.player)
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) status.dataset.playerOnRoad = String(playerOnRoad)
    const stableDelta = Math.min(delta, 50)
    this.updateWorldInput(stableDelta)
    if (this.modalOpen) return
    this.updateEnemies(time, stableDelta)
    this.updateNearest()
    if (this.gadgetPressed()) this.useGadget(time)
    if (this.attackPressed() && this.combat.tryBeginAttack(time)) this.attack()
    if (!this.interactionPressed()) return
    if (this.nearestResource) this.collectSurfaceResource(this.nearestResource)
    else if (this.nearestPickup) this.collectPickup(this.nearestPickup)
    else if (this.atExit) this.transitionTo("wild-forest", "wild-forest")
  }

  private resetRuntimeState(): void {
    this.enemies = []
    this.pickups = []
    this.resources = []
    this.nearestPickup = null
    this.nearestResource = null
    this.atExit = false
    this.lastPrompt = ""
    this.combat.reset()
    this.shieldUntil = 0
    this.shieldLastUsed = -10000
    this.returningToVillage = false
    this.enemyPlayerCollisions = 0
  }

  private createEnemies(): void {
    const now = Date.now()
    const axeDefeated = gameStore.state.defeatedEnemies.includes("guardian-axe")
    MOUNTAIN_ENEMIES.forEach((definition, index) => {
      if (definition.id === "guardian-flamethrower" && !axeDefeated) return
      if (definition.rank === "boss" && gameStore.state.defeatedEnemies.includes(definition.id)) return
      const remaining = Math.max(0, (gameStore.state.enemyRespawnAt[definition.id] ?? 0) - now)
      if (remaining > 0) this.scheduleRespawn(definition, index, remaining)
      else this.spawnEnemy(definition, index)
    })
  }

  private spawnEnemy(definition: EnemyDefinition, index: number): void {
    if (this.enemies.some(({ definition: active }) => active.id === definition.id)) return
    if (definition.rank === "boss" && gameStore.state.defeatedEnemies.includes(definition.id)) return
    const sprite = this.physics.add.image(definition.x, definition.y, definition.assetKey)
    const size: readonly [number, number] = definition.rank === "boss"
      ? [205, 205]
      : definition.type === "robot-mantis"
        ? [125, 125]
        : definition.type === "robot-wasp"
          ? [130, 92]
          : [120, 100]
    sprite.setDisplaySize(size[0], size[1]).setDepth(definition.y + 20).setCollideWorldBounds(true)
    this.roadCollision.track(sprite, true)
    this.combat.configureEnemyBody(sprite)
    const barY = sprite.y - (definition.rank === "boss" ? 118 : 72)
    const healthBack = this.add.rectangle(sprite.x, barY, definition.rank === "boss" ? 112 : 72, 10, 0x281916, 0.92)
    const healthFill = this.add.rectangle(sprite.x - (definition.rank === "boss" ? 55 : 35), barY, definition.rank === "boss" ? 110 : 70, 8, definition.rank === "boss" ? 0xb94cff : COLORS.coral, 1).setOrigin(0, 0.5)
    const rankText = this.add.text(sprite.x, barY + 13, ENEMY_RANK_LABELS[definition.rank], {
      fontFamily: FONT,
      fontSize: definition.rank === "boss" ? "14px" : "11px",
      fontStyle: "bold",
      color: definition.rank === "boss" ? "#f2b5ff" : definition.rank === "strong" ? "#ffb38f" : "#fff4cf",
      backgroundColor: "#173f38dd",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0)
    healthBack.setDepth(3000)
    healthFill.setDepth(3001)
    rankText.setDepth(3002)
    this.enemies.push({ definition, sprite, hp: definition.hp, homeX: sprite.x, homeY: sprite.y, patrolAngle: index * 1.27, healthBack, healthFill, rankText, nextSpecialAt: this.time.now + 800 + index * 90 })
    this.physics.add.collider(sprite, this.obstacles)
    this.combat.addSolidEnemyCollision(this, sprite, this.player, () => {
      this.enemyPlayerCollisions += 1
    })
    this.updateDiagnostics()
  }

  private scheduleRespawn(definition: EnemyDefinition, index: number, delay: number): void {
    this.combat.scheduleRespawn(this, delay, () => this.spawnEnemy(definition, index))
  }

  private updateEnemies(time: number, delta: number): void {
    const deltaSeconds = delta / 1000
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue
      this.roadCollision.constrain(enemy.sprite)
      const dx = this.player.x - enemy.sprite.x
      const dy = this.player.y - enemy.sprite.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq > AI_RADIUS_SQ) {
        enemy.sprite.setVelocity(0, 0)
        this.positionEnemyUi(enemy)
        continue
      }
      const distance = Math.sqrt(distanceSq) || 1
      const nx = dx / distance
      const ny = dy / distance
      const behavior = enemy.definition.behavior
      if (behavior === "ranged") {
        const move = distance < 210 ? -1 : distance > 340 ? 1 : 0
        enemy.sprite.setVelocity(nx * enemy.definition.speed * move, ny * enemy.definition.speed * move)
        if (distance < 520 && time >= enemy.nextSpecialAt) this.fireWaspSting(enemy, time)
      } else if (behavior === "dash") {
        enemy.sprite.setVelocity(nx * enemy.definition.speed, ny * enemy.definition.speed)
        if (distance < 300 && time >= enemy.nextSpecialAt) this.warnMantisDash(enemy, time)
      } else if (behavior === "axe") {
        enemy.sprite.setVelocity(nx * enemy.definition.speed, ny * enemy.definition.speed)
        if (distance < 205 && time >= enemy.nextSpecialAt) this.warnAxeSwing(enemy, time)
      } else if (behavior === "flamethrower") {
        const move = distance < 260 ? -1 : distance > 390 ? 1 : 0
        enemy.sprite.setVelocity(nx * enemy.definition.speed * move, ny * enemy.definition.speed * move)
        if (distance < 560 && time >= enemy.nextSpecialAt) this.warnFlameCone(enemy, time)
      } else if (distance < 430) {
        const burst = behavior === "rush" && time % 1900 < 380 ? 1.9 : 1
        enemy.sprite.setVelocity(nx * enemy.definition.speed * burst, ny * enemy.definition.speed * burst)
      } else {
        enemy.patrolAngle += deltaSeconds * 0.55
        const tx = enemy.homeX + Math.cos(enemy.patrolAngle) * 100
        const ty = enemy.homeY + Math.sin(enemy.patrolAngle * 0.82) * 85
        const pdx = tx - enemy.sprite.x
        const pdy = ty - enemy.sprite.y
        const plen = Math.hypot(pdx, pdy) || 1
        enemy.sprite.setVelocity((pdx / plen) * enemy.definition.speed * 0.42, (pdy / plen) * enemy.definition.speed * 0.42)
      }
      const velocityX = (enemy.sprite.body as Phaser.Physics.Arcade.Body).velocity.x
      enemy.sprite.setFlipX(velocityX < 0).setDepth(enemy.sprite.y + 20)
      this.positionEnemyUi(enemy)
      if (enemy.definition.rank !== "boss" && distanceSq < 5184 && this.combat.canDamagePlayer(time)) {
        this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y, time)
      }
    }
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) {
      status.dataset.enemyPlayerCollisions = String(this.enemyPlayerCollisions)
      status.dataset.enemyPlayerOverlap = String(this.combat.bodiesOverlap(this.player, this.enemies))
      status.dataset.enemyPositions = this.enemies
        .map(({ definition, sprite }) => `${definition.id}:${Math.round(sprite.x)}:${Math.round(sprite.y)}`)
        .join(",")
    }
  }

  private positionEnemyUi(enemy: RuntimeEnemy): void {
    const offset = enemy.definition.rank === "boss" ? 118 : 72
    const width = enemy.definition.rank === "boss" ? 110 : 70
    enemy.healthBack.setPosition(enemy.sprite.x, enemy.sprite.y - offset)
    enemy.healthFill.setPosition(enemy.sprite.x - width / 2, enemy.sprite.y - offset)
    enemy.rankText.setPosition(enemy.sprite.x, enemy.sprite.y - offset + 13)
  }

  private fireWaspSting(enemy: RuntimeEnemy, time: number): void {
    enemy.nextSpecialAt = time + 1800
    const targetX = this.player.x
    const targetY = this.player.y
    const warning = this.add.circle(targetX, targetY, 38, COLORS.yellow, 0.2).setStrokeStyle(2, COLORS.yellow, 0.9).setDepth(2500)
    this.tweens.add({ targets: warning, scale: 1.25, alpha: 0, duration: 450, onComplete: () => warning.destroy() })
    const bolt = this.add.text(enemy.sprite.x, enemy.sprite.y, "✦", { fontFamily: FONT, fontSize: "26px", color: "#f7c948" }).setOrigin(0.5).setDepth(2600)
    this.tweens.add({
      targets: bolt,
      x: targetX,
      y: targetY,
      duration: 520,
      onComplete: () => {
        bolt.destroy()
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY) < 62) {
          this.damagePlayer(enemy.definition.damage, targetX, targetY, this.time.now)
        }
      },
    })
  }

  private warnMantisDash(enemy: RuntimeEnemy, time: number): void {
    enemy.nextSpecialAt = time + 2400
    const warning = this.add.circle(enemy.sprite.x, enemy.sprite.y, 95, 0xffb38f, 0.18).setStrokeStyle(3, 0xffb38f, 0.9).setDepth(2400)
    enemy.sprite.setTint(0xffd1a8)
    this.time.delayedCall(600, () => {
      warning.destroy()
      if (!enemy.sprite.active) return
      enemy.sprite.clearTint()
      const dx = this.player.x - enemy.sprite.x
      const dy = this.player.y - enemy.sprite.y
      const len = Math.hypot(dx, dy) || 1
      enemy.sprite.setVelocity((dx / len) * 420, (dy / len) * 420)
      if (len < 180) this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y, this.time.now)
    })
  }

  private warnAxeSwing(enemy: RuntimeEnemy, time: number): void {
    enemy.nextSpecialAt = time + 2600
    const warning = this.add.circle(enemy.sprite.x, enemy.sprite.y, 190, 0xff8b72, 0.13).setStrokeStyle(4, 0xff8b72, 0.9).setDepth(2400)
    EventBus.emit(GameEvents.showMessage, "Стражник заносит топор — отойди от красного круга!", 1300)
    this.time.delayedCall(750, () => {
      warning.destroy()
      if (!enemy.sprite.active) return
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y) < 190) {
        this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y, this.time.now)
      }
    })
  }

  private warnFlameCone(enemy: RuntimeEnemy, time: number): void {
    enemy.nextSpecialAt = time + 4300
    const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
    const direction = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle))
    const warning = this.add.arc(enemy.sprite.x, enemy.sprite.y, 410, Phaser.Math.RadToDeg(angle) - 27, Phaser.Math.RadToDeg(angle) + 27, false, 0xff8b2f, 0.16).setDepth(2400)
    warning.setStrokeStyle(3, 0xffb347, 0.9)
    EventBus.emit(GameEvents.showMessage, "Огнемёт заряжается — выйди из оранжевого сектора!", 1500)
    this.time.delayedCall(900, () => {
      if (!enemy.sprite.active) {
        warning.destroy()
        return
      }
      warning.setFillStyle(0xff6a21, 0.34)
      for (let pulse = 0; pulse < 3; pulse += 1) {
        this.time.delayedCall(pulse * 1000, () => {
          if (!enemy.sprite.active) return
          const dx = this.player.x - enemy.sprite.x
          const dy = this.player.y - enemy.sprite.y
          const distance = Math.hypot(dx, dy) || 1
          const dot = (dx / distance) * direction.x + (dy / distance) * direction.y
          if (distance < 410 && dot > Math.cos(Phaser.Math.DegToRad(27))) {
            this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y, this.time.now)
          }
        })
      }
      this.time.delayedCall(2100, () => warning.destroy())
    })
  }

  private damagePlayer(amount: number, sourceX: number, sourceY: number, time: number): void {
    if (this.returningToVillage) return
    const result = this.combat.damagePlayer(this, this.player, amount, sourceX, sourceY, time, time < this.shieldUntil)
    if (result === "ignored") return
    if (result === "shielded") {
      this.shieldUntil = 0
      this.player.clearTint()
      EventBus.emit(GameEvents.showMessage, "Импульсный щит отразил удар!", 1600)
      return
    }
    if (result !== "knocked-out") return
    this.returningToVillage = true
    EventBus.emit(GameEvents.showMessage, "Жители помогли вернуться из Горной Лощины в деревню.", 2400)
    this.cameras.main.shake(250, 0.012)
    this.time.delayedCall(700, () => this.scene.start("forest-village"))
  }

  private attack(): void {
    const character = gameStore.state.character
    if (!character) return
    const weapon = gameStore.state.equippedWeapon
    if (weapon !== "melee") {
      this.throwProduce(weapon)
      return
    }
    const centerX = this.player.x + this.lastDirection.x * 72
    const centerY = this.player.y + this.lastDirection.y * 72
    const arc = this.add.arc(centerX, centerY, 75, Phaser.Math.RadToDeg(this.lastDirection.angle()) - 58, Phaser.Math.RadToDeg(this.lastDirection.angle()) + 58, false, COLORS.yellow, 0.42).setDepth(3200)
    this.tweens.add({ targets: arc, alpha: 0, scale: 1.18, duration: 180, onComplete: () => arc.destroy() })
    const target = this.findAttackTarget(155, -0.05)
    if (target) this.hitEnemy(target, calculateAttackDamage(character.stats.strength))
  }

  private throwProduce(expected: ProduceId): void {
    const produceId = gameStore.consumeProduceShot()
    if (!produceId) {
      EventBus.emit(GameEvents.showMessage, "Метательные овощи закончились.", 1500)
      return
    }
    const produce = PRODUCE[produceId]
    const target = this.findAttackTarget(430, 0.55)
    const targetX = target?.sprite.x ?? this.player.x + this.lastDirection.x * 380
    const targetY = target?.sprite.y ?? this.player.y + this.lastDirection.y * 380
    const projectile = this.add.text(this.player.x, this.player.y - 15, produce.icon, { fontFamily: FONT, fontSize: "32px" }).setOrigin(0.5).setDepth(3300)
    this.tweens.add({ targets: projectile, x: targetX, y: targetY, angle: 540, duration: 280, onComplete: () => {
      projectile.destroy()
      if (target?.sprite.active) this.hitEnemy(target, produce.damage, 12)
    } })
    if (produceId !== expected) EventBus.emit(GameEvents.showMessage, "Оружие переключилось.", 1200)
  }

  private findAttackTarget(maxDistance: number, minimumDot: number): RuntimeEnemy | null {
    let target: RuntimeEnemy | null = null
    let nearest = Number.POSITIVE_INFINITY
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue
      const dx = enemy.sprite.x - this.player.x
      const dy = enemy.sprite.y - this.player.y
      const distance = Math.hypot(dx, dy)
      if (distance > maxDistance) continue
      const dot = (dx / (distance || 1)) * this.lastDirection.x + (dy / (distance || 1)) * this.lastDirection.y
      if (dot < minimumDot || distance >= nearest) continue
      nearest = distance
      target = enemy
    }
    return target
  }

  private hitEnemy(enemy: RuntimeEnemy, damage: number, knockback = 28): void {
    const barWidth = enemy.definition.rank === "boss" ? 110 : 70
    const defeated = this.combat.hitEnemy(this, enemy, damage, this.lastDirection, barWidth, knockback)
    if (enemy.definition.id === "guardian-axe" && enemy.hp <= enemy.definition.hp / 2) this.activateFlameGuardian()
    if (!defeated) return
    const x = enemy.sprite.x
    const y = enemy.sprite.y
    const wasCleared = gameStore.state.mountainCleared
    const { firstDefeat, drop } = this.combat.recordDefeat(enemy, x, y)
    this.destroyEnemy(enemy)
    if (drop) this.addPickup(drop.id, x, y)
    if (enemy.definition.respawnMs != null) {
      const index = MOUNTAIN_ENEMIES.findIndex(({ id }) => id === enemy.definition.id)
      this.scheduleRespawn(enemy.definition, index, enemy.definition.respawnMs)
      EventBus.emit(GameEvents.showMessage, firstDefeat ? "⚙️ Робонасекомое обезврежено!" : "⚙️ Возрождённый робот снова обезврежен!", 1900)
    } else {
      EventBus.emit(GameEvents.showMessage, "🏆 Медведь-стражник обезврежен навсегда!", 2300)
      if (enemy.definition.id === "guardian-axe") this.activateFlameGuardian()
    }
    this.updateDiagnostics()
    updateGameStatus("mountain-hollow", `Горная Лощина. Побед: ${gameStore.state.mountainEnemyDefeats}.`)
    if (!wasCleared && gameStore.state.mountainCleared) EventBus.emit(GameEvents.mountainComplete)
  }

  private handleDebugDamageEnemy(id: string, damage: number): void {
    const enemy = this.enemies.find(({ definition }) => definition.id === id)
    if (enemy && Number.isFinite(damage) && damage > 0) this.hitEnemy(enemy, damage, 0)
  }

  private destroyEnemy(enemy: RuntimeEnemy): void {
    this.combat.destroyEnemy(enemy)
    this.enemies = this.enemies.filter((active) => active !== enemy)
  }

  private activateFlameGuardian(): void {
    if (gameStore.state.defeatedEnemies.includes("guardian-flamethrower")) return
    const definition = MOUNTAIN_ENEMIES.find(({ id }) => id === "guardian-flamethrower")
    if (!definition || this.enemies.some(({ definition: active }) => active.id === definition.id)) return
    this.spawnEnemy(definition, MOUNTAIN_ENEMIES.indexOf(definition))
    EventBus.emit(GameEvents.showMessage, "🔥 Второй стражник вступает в бой с огнемётом!", 2600)
  }

  private useGadget(time: number): void {
    const equipped = gameStore.state.equippedGadget
    if (equipped !== "pulse-shield") {
      EventBus.emit(GameEvents.showMessage, "Здесь пригодится импульсный щит.", 1500)
      return
    }
    const gadget = GADGETS[equipped]
    if (time - this.shieldLastUsed < gadget.cooldownMs) {
      const seconds = Math.ceil((gadget.cooldownMs - (time - this.shieldLastUsed)) / 1000)
      EventBus.emit(GameEvents.showMessage, `Щит перезаряжается: ${seconds} сек.`, 1300)
      return
    }
    this.shieldLastUsed = time
    this.shieldUntil = time + gadget.durationMs
    this.player.setTint(0x6cc7ff)
    this.time.delayedCall(gadget.durationMs, () => {
      if (this.time.now >= this.shieldUntil) this.player?.clearTint()
    })
    EventBus.emit(GameEvents.showMessage, "Щит активен.", 1400)
  }

  private createPickups(): void {
    gameStore.state.enemyGearDrops.forEach((drop) => {
      if (!drop.collected && drop.location === "mountain-hollow") this.addPickup(drop.id, drop.x, drop.y)
    })
  }

  private addPickup(id: string, x: number, y: number): void {
    const glow = this.add.circle(0, 0, 28, COLORS.yellow, 0.35)
    const icon = this.add.text(0, 0, "⚙️", { fontFamily: FONT, fontSize: "34px" }).setOrigin(0.5)
    const marker = this.add.container(x, y, [glow, icon]).setDepth(y + 10)
    this.tweens.add({ targets: marker, y: y - 8, duration: 850, yoyo: true, repeat: -1 })
    this.pickups.push({ id, x, y, marker })
  }

  private createResources(): void {
    for (const object of this.mapObjects("mountain-hollow-map")) {
      const resourceId = resourceIdFromObjectType(object.type)
      if (!resourceId || !object.name) continue
      const resource = addResourceNode(this, object.name, resourceId, object.x ?? 0, object.y ?? 0)
      if (resource) this.resources.push(resource)
    }
  }

  private createExit(): void {
    this.add.text(150, 885, "←  ДИКИЙ ЛЕС", { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#fff4cf", backgroundColor: "#173f38dd", padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(1900)
    this.add.text(4380, 470, "АРЕНА СТРАЖНИКОВ", { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#f2b5ff", backgroundColor: "#173f38dd", padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(1900)
  }

  private updateNearest(): void {
    this.nearestPickup = null
    this.nearestResource = null
    let nearest = Number.POSITIVE_INFINITY
    for (const pickup of this.pickups) {
      if (!pickup.marker.active) continue
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y)
      if (distance < 100 && distance < nearest) {
        nearest = distance
        this.nearestPickup = pickup
      }
    }
    for (const resource of this.resources) {
      if (!resource.marker.active) continue
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, resource.x, resource.y)
      if (distance < 100 && distance < nearest) {
        nearest = distance
        this.nearestPickup = null
        this.nearestResource = resource
      }
    }
    this.atExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, 150, 800) < 145
    const prompt = this.nearestResource
      ? resourcePrompt(this.nearestResource.resourceId)
      : this.nearestPickup
        ? "E — подобрать шестерёнку"
        : this.atExit
          ? "E — вернуться в Дикий лес"
          : ""
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private collectSurfaceResource(resource: RuntimeResourceNode): void {
    if (!collectResourceNode(resource)) return
    this.resources = this.resources.filter((candidate) => candidate !== resource)
    const definition = RESOURCES[resource.resourceId]
    EventBus.emit(GameEvents.showMessage, resource.resourceId === "scrap" ? `${definition.icon} Найдено ⚙️ 10.` : `${definition.icon} ${definition.name} убран в рюкзак.`, 1900)
  }

  private collectPickup(pickup: GearPickup): void {
    if (!gameStore.collectEnemyGearDrop(pickup.id)) return
    pickup.marker.destroy(true)
    this.pickups = this.pickups.filter((candidate) => candidate !== pickup)
    EventBus.emit(GameEvents.showMessage, "⚙️ Горная шестерёнка убрана в рюкзак.", 1700)
  }

  private updateDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    const guardians = MOUNTAIN_GUARDIAN_IDS.map((id) => `${id}:${gameStore.state.defeatedEnemies.includes(id) ? "defeated" : "active"}`).join(",")
    const axe = this.enemies.find(({ definition }) => definition.id === "guardian-axe")
    const flameActive = this.enemies.some(({ definition }) => definition.id === "guardian-flamethrower")
    status.dataset.activeMountainEnemies = String(this.enemies.length)
    status.dataset.mountainEnemies = String(gameStore.state.mountainEnemyDefeats)
    status.dataset.mountainGuardians = guardians
    status.dataset.mountainCleared = String(gameStore.state.mountainCleared)
    status.dataset.mountainPhase = gameStore.state.mountainCleared ? "cleared" : flameActive || (axe && axe.hp <= axe.definition.hp / 2) ? "both" : "axe"
    status.dataset.mountainRanks = MOUNTAIN_ENEMIES.map(({ id, rank }) => `${id}:${rank}`).join(",")
  }
}
