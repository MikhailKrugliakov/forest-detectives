import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import {
  BIRD_PASS_ENEMIES,
  BIRD_PASS_ENTRY,
  BIRD_PASS_HEIGHT,
  BIRD_PASS_TURTLE_ID,
  BIRD_PASS_WIDTH,
  turtlePhase,
  type TurtlePhase,
} from "../../domain/birdPass"
import { scaledEnemyHealth } from "../../domain/difficulty"
import { gameStore } from "../../domain/GameStore"
import { GADGETS } from "../../domain/gadgets"
import { PRODUCE } from "../../domain/produce"
import { ENEMY_RANK_LABELS } from "../../domain/quests"
import { RESOURCES } from "../../domain/resources"
import { calculateAttackDamage } from "../../domain/rules"
import { BIRD_PASS_ROADS } from "../../domain/roads"
import type { DifficultyId, EnemyDefinition, ProduceId } from "../../domain/types"
import { CombatController } from "../CombatController"
import { actorFor } from "../animation/AnimatedActor"
import { EventBus, GameEvents } from "../EventBus"
import { RoadCollisionController } from "../RoadCollisionController"
import { addResourceNode, collectResourceNode, resourceIdFromObjectType, resourcePrompt, type RuntimeResourceNode } from "../WorldResources"
import { COLORS, FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"

interface RuntimeEnemy {
  definition: EnemyDefinition
  sprite: Phaser.Physics.Arcade.Image
  hp: number
  maxHp: number
  homeX: number
  homeY: number
  patrolAngle: number
  healthBack: Phaser.GameObjects.Rectangle
  healthFill: Phaser.GameObjects.Rectangle
  rankText: Phaser.GameObjects.Text
  nextSpecialAt: number
}

interface FeatherProjectile {
  sprite: Phaser.Physics.Arcade.Image
  source: RuntimeEnemy
  damage: number
  bornAt: number
  reflected: boolean
}

interface GearPickup {
  id: string
  x: number
  y: number
  marker: Phaser.GameObjects.Container
}

const ACTIVE_AI_RADIUS_SQ = 1_150_000
const PROJECTILE_LIMIT = 84
const PROJECTILE_LIFETIME = 5200
const TURTLE_ARENA = { x: 4450, y: 800 }

export class BirdPassScene extends BaseWorldScene {
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private enemies: RuntimeEnemy[] = []
  private feathers: FeatherProjectile[] = []
  private pickups: GearPickup[] = []
  private resources: RuntimeResourceNode[] = []
  private pylons: Phaser.GameObjects.Arc[] = []
  private nearestPickup: GearPickup | null = null
  private nearestResource: RuntimeResourceNode | null = null
  private atExit = false
  private lastPrompt = ""
  private returningToVillage = false
  private shieldUntil = 0
  private shieldLastUsed = -10000
  private gloveUntil = 0
  private gloveLastUsed = -10000
  private gloveCaptures = 0
  private turtleVulnerableUntil = 0
  private turtleRollingUntil = 0
  private turtleRollWarningUntil = 0
  private turtleStunnedUntil = 0
  private turtleRollDirection = new Phaser.Math.Vector2()
  private turtlePhaseValue: TurtlePhase = 1
  private lastDifficulty: DifficultyId = "hard"
  private readonly combat = new CombatController()
  private readonly roadCollision = new RoadCollisionController(BIRD_PASS_ROADS)

  constructor() {
    super("bird-pass")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("main-menu")
      return
    }
    gameStore.setLocation("bird-pass")
    this.resetRuntimeState()
    this.lastDifficulty = gameStore.state.difficulty
    this.cameras.main.setBackgroundColor("#314653")
    this.add.image(1200, 800, "bird-pass-west-bg").setDisplaySize(2400, 1600).setDepth(0)
    this.add.image(3600, 800, "bird-pass-east-bg").setDisplaySize(2400, 1600).setDepth(0)

    const debugParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
    const debugX = Number(debugParams?.get("x"))
    const debugY = Number(debugParams?.get("y"))
    const spawn = Number.isFinite(debugX) && Number.isFinite(debugY) && debugParams?.has("x") && debugParams.has("y")
      ? { x: Phaser.Math.Clamp(debugX, 80, BIRD_PASS_WIDTH - 80), y: Phaser.Math.Clamp(debugY, 80, BIRD_PASS_HEIGHT - 80) }
      : BIRD_PASS_ENTRY
    this.setupWorld(character, BIRD_PASS_WIDTH, BIRD_PASS_HEIGHT, spawn.x, spawn.y, character.id === "watermelon" ? 96 : 102, character.id === "watermelon" ? 112 : 140)
    this.roadCollision.track(this.player, true)
    this.obstacles = this.loadMapCollisions("bird-pass-map", BIRD_PASS_ROADS)
    this.createFeatherTexture()
    this.createPylons()
    this.createEnemies()
    this.createPickups()
    this.createResources()
    this.createLabels()
    this.combat.arm(this.combat.now)
    EventBus.on("debug-damage-enemy", this.handleDebugDamageEnemy, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off("debug-damage-enemy", this.handleDebugDamageEnemy, this)
      this.destroyAllFeathers()
    })
    this.updateDiagnostics()
    updateGameStatus("bird-pass", `Птичий перевал. Побед: ${gameStore.state.birdPassEnemyDefeats}.`)
    this.cameras.main.fadeIn(300, 28, 43, 55)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.time.delayedCall(350, () => EventBus.emit(
      GameEvents.showMessage,
      gameStore.state.birdPassCleared
        ? "Бронепанцирь побеждён. Перевал снова безопасен."
        : "Металлические перья разбиваются о скалы. Щит и магнитная перчатка помогут в бою.",
      5000,
    ))
  }

  update(time: number, delta: number): void {
    if (!this.player?.body || this.returningToVillage) return
    const stableDelta = Math.min(delta, 50)
    this.updateWorldInput(stableDelta)
    time = this.combat.advance(delta, this.modalOpen)
    const playerOnRoad = this.roadCollision.constrain(this.player)
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) status.dataset.playerOnRoad = String(playerOnRoad)
    if (this.modalOpen) return
    this.syncDifficulty()
    this.updateEnemies(time, stableDelta)
    this.updateFeathers(time)
    this.updateGlove(time)
    this.updateNearest()
    if (this.gadgetPressed()) this.useGadget(time)
    if (this.attackPressed() && this.combat.tryBeginAttack(time)) this.attack()
    if (!this.interactionPressed()) return
    if (this.nearestResource) this.collectSurfaceResource(this.nearestResource)
    else if (this.nearestPickup) this.collectPickup(this.nearestPickup)
    else if (this.atExit) this.transitionTo("mountain-hollow", "mountain-hollow")
  }

  private resetRuntimeState(): void {
    this.enemies = []
    this.feathers = []
    this.pickups = []
    this.resources = []
    this.pylons = []
    this.nearestPickup = null
    this.nearestResource = null
    this.atExit = false
    this.lastPrompt = ""
    this.returningToVillage = false
    this.shieldUntil = 0
    this.shieldLastUsed = -10000
    this.gloveUntil = 0
    this.gloveLastUsed = -10000
    this.gloveCaptures = 0
    this.turtleVulnerableUntil = 0
    this.turtleRollingUntil = 0
    this.turtleRollWarningUntil = 0
    this.turtleStunnedUntil = 0
    this.turtlePhaseValue = gameStore.state.birdPassCleared ? "defeated" : 1
    this.combat.reset()
  }

  private createFeatherTexture(): void {
    if (this.textures.exists("metal-feather")) return
    const graphics = this.make.graphics({ x: 0, y: 0 })
    graphics.fillStyle(0xd7e4ea, 1)
    graphics.fillEllipse(16, 8, 28, 10)
    graphics.lineStyle(2, 0x55707c, 1)
    graphics.lineBetween(2, 8, 30, 8)
    graphics.generateTexture("metal-feather", 32, 16)
    graphics.destroy()
  }

  private createPylons(): void {
    for (const object of this.mapObjects("bird-pass-map")) {
      if (object.type !== "energy-pylon") continue
      const x = object.x ?? 0
      const y = object.y ?? 0
      const pylon = this.add.circle(x, y, 30, 0x64d9ff, 0.2).setStrokeStyle(2, 0xb8f2ff, 0.68).setDepth(y + 5)
      this.add.text(x, y, "⚡", { fontFamily: FONT, fontSize: "18px" }).setOrigin(0.5).setDepth(y + 6)
      this.pylons.push(pylon)
    }
  }

  private createEnemies(): void {
    const now = Date.now()
    BIRD_PASS_ENEMIES.forEach((definition, index) => {
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
      ? [245, 205]
      : definition.type === "robot-hawk"
        ? [142, 108]
        : definition.type === "robot-owl"
          ? [128, 114]
          : [112, 88]
    sprite.setDisplaySize(size[0], size[1]).setDepth(definition.y + 20).setCollideWorldBounds(true)
    this.combat.configureEnemyBody(sprite)
    sprite.setName(definition.id)
    this.roadCollision.track(sprite, true)
    const barY = sprite.y - (definition.rank === "boss" ? 125 : 72)
    const barWidth = definition.rank === "boss" ? 142 : 76
    const healthBack = this.add.rectangle(sprite.x, barY, barWidth + 2, 12, 0x281916, 0.94).setDepth(3000)
    const healthFill = this.add.rectangle(sprite.x - barWidth / 2, barY, barWidth, 9, definition.rank === "boss" ? 0x9c6dff : COLORS.coral, 1).setOrigin(0, 0.5).setDepth(3001)
    const rankText = this.add.text(sprite.x, barY + 15, ENEMY_RANK_LABELS[definition.rank], {
      fontFamily: FONT,
      fontSize: definition.rank === "boss" ? "14px" : "11px",
      fontStyle: "bold",
      color: definition.rank === "boss" ? "#e9ccff" : definition.rank === "strong" ? "#ffb38f" : "#fff4cf",
      backgroundColor: "#173f38dd",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0).setDepth(3002)
    const maxHp = scaledEnemyHealth(definition, gameStore.state.difficulty)
    const enemy: RuntimeEnemy = {
      definition,
      sprite,
      hp: maxHp,
      maxHp,
      homeX: sprite.x,
      homeY: sprite.y,
      patrolAngle: index * 1.19,
      healthBack,
      healthFill,
      rankText,
      nextSpecialAt: this.combat.now + 900 + index * 85,
    }
    this.enemies.push(enemy)
    this.physics.add.collider(sprite, this.obstacles)
    this.combat.addSolidEnemyCollision(this, sprite, this.player)
    if (definition.id === BIRD_PASS_TURTLE_ID) this.turtlePhaseValue = turtlePhase(enemy.hp, enemy.maxHp)
    this.updateDiagnostics()
  }

  private scheduleRespawn(definition: EnemyDefinition, index: number, delay: number): void {
    this.combat.scheduleRespawn(this, delay, () => this.spawnEnemy(definition, index))
  }

  private syncDifficulty(): void {
    const difficulty = gameStore.state.difficulty
    if (difficulty === this.lastDifficulty) return
    this.combat.rescaleEnemies(this.enemies, this.lastDifficulty, difficulty)
    this.lastDifficulty = difficulty
    const turtle = this.turtle()
    if (turtle) this.turtlePhaseValue = turtlePhase(turtle.hp, turtle.maxHp)
    this.updateDiagnostics()
  }

  private updateEnemies(time: number, delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue
      if (enemy.definition.id === BIRD_PASS_TURTLE_ID) {
        this.updateTurtle(enemy, time)
        this.positionEnemyUi(enemy)
        continue
      }
      this.roadCollision.constrain(enemy.sprite)
      const distanceSq = Phaser.Math.Distance.Squared(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y)
      if (distanceSq > ACTIVE_AI_RADIUS_SQ) {
        enemy.sprite.setVelocity(0, 0)
        this.positionEnemyUi(enemy)
        continue
      }
      if (this.combat.isEnemyRecoiling(enemy)) {
        enemy.sprite.setDepth(enemy.sprite.y + 20)
        this.positionEnemyUi(enemy)
        continue
      }
      const distance = Math.sqrt(distanceSq) || 1
      const dx = this.player.x - enemy.sprite.x
      const dy = this.player.y - enemy.sprite.y
      const nx = dx / distance
      const ny = dy / distance
      const desired = distance < 250 ? -0.8 : distance > 430 ? 0.8 : 0
      enemy.sprite.setVelocity(nx * enemy.definition.speed * desired, ny * enemy.definition.speed * desired)
      if (desired === 0) {
        enemy.patrolAngle += delta * 0.0012
        enemy.sprite.setVelocity(Math.cos(enemy.patrolAngle) * enemy.definition.speed * 0.28, Math.sin(enemy.patrolAngle) * enemy.definition.speed * 0.22)
      }
      if (distance < 650 && time >= enemy.nextSpecialAt) this.warnBirdAttack(enemy, time)
      const velocity = (enemy.sprite.body as Phaser.Physics.Arcade.Body).velocity
      actorFor(enemy.sprite)?.face(velocity.x, velocity.y)
      enemy.sprite.setDepth(enemy.sprite.y + 20)
      this.positionEnemyUi(enemy)
    }
  }

  private warnBirdAttack(enemy: RuntimeEnemy, time: number): void {
    actorFor(enemy.sprite)?.face(this.player.x - enemy.sprite.x, this.player.y - enemy.sprite.y)
    const behavior = enemy.definition.behavior
    const warningMs = behavior === "feather-single" ? 360 : behavior === "feather-fan" ? 650 : 720
    enemy.nextSpecialAt = time + (behavior === "feather-single" ? 1800 : behavior === "feather-fan" ? 2500 : 2800)
    const warning = this.add.circle(enemy.sprite.x, enemy.sprite.y, behavior === "feather-single" ? 42 : 66, 0xffd55a, 0.18).setStrokeStyle(3, 0xffdf7a, 0.95).setDepth(2500)
    this.tweens.add({ targets: warning, scale: 1.35, alpha: 0, duration: warningMs, onComplete: () => warning.destroy() })
    let shotAngle = 0
    actorFor(enemy.sprite)?.play(behavior === "feather-dive" ? "charge" : "shoot", { duration: warningMs + 300, impactAt: warningMs, onCancel: () => warning.destroy(), onImpact: () => {
      if (!enemy.sprite.active) return
      const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
      shotAngle = angle
      if (behavior === "feather-single") {
        this.fireFeather(enemy, angle, 410)
      } else if (behavior === "feather-fan") {
        for (const offset of [-0.18, 0, 0.18]) this.fireFeather(enemy, angle + offset, 390)
      } else {
        for (const offset of [-0.23, 0, 0.23]) this.fireFeather(enemy, angle + offset, 440)
        enemy.sprite.setVelocity(Math.cos(angle) * 360, Math.sin(angle) * 360)
      }
    }, markers: [{ at: warningMs + 150, callback: () => {
      if (enemy.sprite.active && behavior === "feather-single" && (gameStore.state.difficulty === "hard" || gameStore.state.difficulty === "impossible")) this.fireFeather(enemy, shotAngle + 0.045, 420)
    } }] })
  }

  private updateTurtle(enemy: RuntimeEnemy, time: number): void {
    this.turtlePhaseValue = turtlePhase(enemy.hp, enemy.maxHp)
    if (this.turtlePhaseValue === "defeated") return
    if (time < this.turtleStunnedUntil) {
      enemy.sprite.setVelocity(0, 0).setTint(0xffef8a)
      actorFor(enemy.sprite)?.setState("stunned")
      return
    }
    enemy.sprite.clearTint()
    if (this.turtlePhaseValue === 2 && time < this.turtleRollingUntil) {
      enemy.sprite.setVelocity(this.turtleRollDirection.x * 520, this.turtleRollDirection.y * 520)
      actorFor(enemy.sprite)?.face(this.turtleRollDirection.x, this.turtleRollDirection.y)
      actorFor(enemy.sprite)?.setState("roll")
      for (const pylon of this.pylons) {
        if (Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, pylon.x, pylon.y) < 92) {
          this.stunTurtle(enemy, time, pylon)
          break
        }
      }
      return
    }
    enemy.sprite.setVelocity(0, 0)
    actorFor(enemy.sprite)?.setState(time < this.turtleVulnerableUntil ? "core-open" : "idle")
    if (time < this.turtleRollWarningUntil || time < enemy.nextSpecialAt) return
    if (this.turtlePhaseValue === 1) this.turtlePhaseOne(enemy, time)
    else if (this.turtlePhaseValue === 2) this.turtlePhaseTwo(enemy, time)
    else this.turtlePhaseThree(enemy, time)
  }

  private turtlePhaseOne(enemy: RuntimeEnemy, time: number): void {
    actorFor(enemy.sprite)?.face(this.player.x - enemy.sprite.x, this.player.y - enemy.sprite.y)
    enemy.nextSpecialAt = time + 3300
    const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
    this.warnAt(enemy.sprite.x, enemy.sprite.y, 105, 650)
    actorFor(enemy.sprite)?.play("shoot", { duration: 830, impactAt: 650, onImpact: () => {
      if (!enemy.sprite.active) return
      for (const offset of [-0.36, -0.18, 0, 0.18, 0.36]) this.fireFeather(enemy, angle + offset, 420)
      this.openTurtleCore(2500, "Ядро открыто — атакуй или отражай перья!")
    } })
  }

  private turtlePhaseTwo(enemy: RuntimeEnemy, time: number): void {
    actorFor(enemy.sprite)?.face(this.player.x - enemy.sprite.x, this.player.y - enemy.sprite.y)
    enemy.nextSpecialAt = time + 3600
    this.turtleRollWarningUntil = time + 800
    const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
    const endX = enemy.sprite.x + Math.cos(angle) * 900
    const endY = enemy.sprite.y + Math.sin(angle) * 900
    const line = this.add.line(0, 0, enemy.sprite.x, enemy.sprite.y, endX, endY, 0xff785e, 0.24).setOrigin(0).setLineWidth(12).setDepth(2400)
    EventBus.emit(GameEvents.showMessage, "Бронепанцирь готовится к рывку — направь его в синюю опору!", 1600)
    actorFor(enemy.sprite)?.play("charge", { duration: 980, impactAt: 800, onCancel: () => line.destroy(), onImpact: () => {
      line.destroy()
      if (!enemy.sprite.active) return
      this.turtleRollDirection.set(Math.cos(angle), Math.sin(angle))
      this.turtleRollingUntil = this.combat.now + 1800
    } })
  }

  private turtlePhaseThree(enemy: RuntimeEnemy, time: number): void {
    enemy.nextSpecialAt = time + 4000
    enemy.sprite.setPosition(TURTLE_ARENA.x, TURTLE_ARENA.y)
    this.warnAt(enemy.sprite.x, enemy.sprite.y, 165, 700)
    EventBus.emit(GameEvents.showMessage, "Кольцо перьев! Укройся или перехвати три пера перчаткой.", 1700)
    const falling: { x: number; y: number; warning: Phaser.GameObjects.Arc }[] = []
    actorFor(enemy.sprite)?.play("cast", { duration: 1900, impactAt: 700, onImpact: () => {
      if (!enemy.sprite.active) return
      for (let index = 0; index < 14; index += 1) this.fireFeather(enemy, (Math.PI * 2 * index) / 14 + time * 0.001, 360)
      for (let index = 0; index < 3; index += 1) {
        const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-110, 110), 4060, 4720)
        const y = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(-100, 100), 390, 1210)
        const warning = this.add.circle(x, y, 48, 0xff785e, 0.18).setStrokeStyle(3, 0xff9b82, 0.9).setDepth(2500)
        this.tweens.add({ targets: warning, alpha: 0.42, scale: 1.18, duration: 650, yoyo: true })
        falling.push({ x, y, warning })
      }
    }, markers: [0, 1, 2].map((index) => ({ at: 1400 + index * 110, callback: () => {
        const target = falling[index]
        if (!target || !enemy.sprite.active) return
        const { x: targetX, y: targetY, warning } = target
        warning.destroy()
        const feather = this.physics.add.image(targetX, targetY - 280, "metal-feather").setDepth(2850).setRotation(Math.PI / 2)
        this.tweens.add({ targets: feather, y: targetY, duration: 260, onComplete: () => {
          feather.destroy()
          if (Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY) < 55) {
            this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y, this.combat.now)
          }
        } })
    } })), onCancel: () => falling.forEach(({ warning }) => warning.destroy()), onComplete: () => {
      if (enemy.sprite.active) this.openTurtleCore(3000, "Волна прошла — ядро открыто на три секунды!")
    } })
  }

  private stunTurtle(enemy: RuntimeEnemy, time: number, pylon: Phaser.GameObjects.Arc): void {
    this.turtleRollingUntil = 0
    this.turtleStunnedUntil = time + 4000
    this.turtleVulnerableUntil = time + 4000
    enemy.sprite.setVelocity(0, 0)
    actorFor(enemy.sprite)?.play("stunned", { duration: 4000 })
    this.tweens.add({ targets: pylon, scale: 1.35, alpha: 0.45, duration: 180, yoyo: true, repeat: 3 })
    EventBus.emit(GameEvents.showMessage, "⚡ Удар об опору! Бронепанцирь оглушён на четыре секунды.", 2100)
  }

  private openTurtleCore(duration: number, message: string): void {
    this.turtleVulnerableUntil = Math.max(this.turtleVulnerableUntil, this.combat.now + duration)
    const turtle = this.turtle()
    turtle?.sprite.setTint(0xb8f2ff)
    if (turtle) actorFor(turtle.sprite)?.setState("core-open")
    this.time.delayedCall(duration, () => {
      if (turtle?.sprite.active && this.combat.now >= this.turtleVulnerableUntil) turtle.sprite.clearTint()
    })
    EventBus.emit(GameEvents.showMessage, message, 1800)
  }

  private warnAt(x: number, y: number, radius: number, duration: number): void {
    const warning = this.add.circle(x, y, radius, 0xff8b72, 0.12).setStrokeStyle(4, 0xff8b72, 0.85).setDepth(2400)
    this.tweens.add({ targets: warning, alpha: 0, scale: 1.16, duration, onComplete: () => warning.destroy() })
  }

  private fireFeather(source: RuntimeEnemy, angle: number, speed: number): void {
    if (!source.sprite.active || this.feathers.length >= PROJECTILE_LIMIT) return
    const sprite = this.physics.add.image(source.sprite.x, source.sprite.y, "metal-feather")
    sprite.setDepth(2800).setRotation(angle).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    const body = sprite.body as Phaser.Physics.Arcade.Body
    body.setSize(27, 10)
    const projectile: FeatherProjectile = { sprite, source, damage: source.definition.damage, bornAt: this.combat.now, reflected: false }
    this.feathers.push(projectile)
    this.physics.add.collider(sprite, this.obstacles, () => this.destroyFeather(projectile))
  }

  private updateFeathers(time: number): void {
    for (const feather of [...this.feathers]) {
      if (!feather.sprite.active) continue
      const camera = this.cameras.main.worldView
      if (time - feather.bornAt > PROJECTILE_LIFETIME || !Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(camera), 360, 300).contains(feather.sprite.x, feather.sprite.y)) {
        this.destroyFeather(feather)
        continue
      }
      if (feather.reflected) {
        if (!feather.source.sprite.active) {
          this.destroyFeather(feather)
          continue
        }
        if (Phaser.Math.Distance.Between(feather.sprite.x, feather.sprite.y, feather.source.sprite.x, feather.source.sprite.y) < 62) {
          this.hitEnemy(feather.source, 2, 0, true)
          this.destroyFeather(feather)
        }
        continue
      }
      if (Phaser.Math.Distance.Between(feather.sprite.x, feather.sprite.y, this.player.x, this.player.y) < 48) {
        this.destroyFeather(feather)
        this.damagePlayer(feather.damage, feather.source.sprite.x, feather.source.sprite.y, time)
      }
    }
  }

  private updateGlove(time: number): void {
    if (time >= this.gloveUntil) return
    for (const feather of this.feathers) {
      if (!feather.sprite.active || feather.reflected) continue
      const distance = Phaser.Math.Distance.Between(feather.sprite.x, feather.sprite.y, this.player.x, this.player.y)
      if (distance > 220) continue
      if (this.gloveCaptures < 3 && feather.source.sprite.active) {
        this.gloveCaptures += 1
        feather.reflected = true
        feather.bornAt = time
        const angle = Phaser.Math.Angle.Between(feather.sprite.x, feather.sprite.y, feather.source.sprite.x, feather.source.sprite.y)
        feather.sprite.setTint(0x79e8ff).setRotation(angle).setVelocity(Math.cos(angle) * 520, Math.sin(angle) * 520)
        if (this.turtlePhaseValue === 3 && this.gloveCaptures >= 3) this.openTurtleCore(3000, "Три пера перехвачены — ядро открылось досрочно!")
      } else {
        this.destroyFeather(feather)
      }
    }
  }

  private useGadget(time: number): void {
    const equipped = gameStore.state.equippedGadget
    if (equipped === "pulse-shield") {
      const gadget = GADGETS[equipped]
      if (time - this.shieldLastUsed < gadget.cooldownMs) {
        EventBus.emit(GameEvents.showMessage, `Щит перезаряжается: ${Math.ceil((gadget.cooldownMs - time + this.shieldLastUsed) / 1000)} сек.`, 1300)
        return
      }
      this.shieldLastUsed = time
      this.shieldUntil = time + gadget.durationMs
      actorFor(this.player)?.play("gadget", { duration: 350 })
      this.player.setTint(0x6cc7ff)
      this.time.delayedCall(gadget.durationMs, () => this.combat.now >= this.shieldUntil && this.player?.clearTint())
      EventBus.emit(GameEvents.showMessage, "Щит ждёт следующее перо или залп.", 1500)
      return
    }
    if (equipped === "magnetic-glove") {
      const gadget = GADGETS[equipped]
      if (time - this.gloveLastUsed < gadget.cooldownMs) {
        EventBus.emit(GameEvents.showMessage, `Перчатка перезаряжается: ${Math.ceil((gadget.cooldownMs - time + this.gloveLastUsed) / 1000)} сек.`, 1300)
        return
      }
      this.gloveLastUsed = time
      this.gloveUntil = time + 1500
      actorFor(this.player)?.play("gadget", { duration: 350 })
      this.gloveCaptures = 0
      const field = this.add.circle(this.player.x, this.player.y, 220, 0x6adff6, 0.13).setStrokeStyle(3, 0x9cf4ff, 0.85).setDepth(2600)
      this.tweens.add({ targets: field, alpha: 0, duration: 1500, onUpdate: () => field.setPosition(this.player.x, this.player.y), onComplete: () => field.destroy() })
      EventBus.emit(GameEvents.showMessage, "Магнитное поле активно 1,5 секунды.", 1500)
      return
    }
    EventBus.emit(GameEvents.showMessage, "Для защиты от перьев экипируй щит или магнитную перчатку.", 1800)
  }

  private damagePlayer(amount: number, sourceX: number, sourceY: number, time: number): void {
    if (this.returningToVillage) return
    const result = this.combat.damagePlayer(this, this.player, amount, sourceX, sourceY, time, time < this.shieldUntil)
    if (result === "ignored") return
    if (result === "shielded") {
      this.shieldUntil = 0
      this.player.clearTint()
      EventBus.emit(GameEvents.showMessage, "Импульсный щит погасил перо или залп!", 1600)
      return
    }
    if (result !== "knocked-out") return
    this.returningToVillage = true
    this.destroyAllFeathers()
    EventBus.emit(GameEvents.showMessage, "Жители вернули героя с перевала в деревню.", 2200)
    this.cameras.main.shake(250, 0.012)
    this.time.delayedCall(700, () => this.scene.start("forest-village"))
  }

  private attack(): void {
    const weapon = gameStore.state.equippedWeapon
    const direction = this.lastDirection.clone()
    actorFor(this.player)?.face(direction.x, direction.y)
    actorFor(this.player)?.play(weapon === "melee" ? "attack" : "throw", {
      duration: 450,
      impactAt: 120,
      onImpact: () => this.resolveAttack(weapon, direction),
    })
  }

  private resolveAttack(weapon: typeof gameStore.state.equippedWeapon, direction: Phaser.Math.Vector2): void {
    const character = gameStore.state.character
    if (!character) return
    // Commit the captured facing only for hit selection; movement remains free.
    const currentDirection = this.lastDirection.clone()
    this.lastDirection.copy(direction)
    this.resolveAttackImpact(weapon, character)
    this.lastDirection.copy(currentDirection)
  }

  private resolveAttackImpact(weapon: typeof gameStore.state.equippedWeapon, character: NonNullable<typeof gameStore.state.character>): void {
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

  private hitEnemy(enemy: RuntimeEnemy, damage: number, knockback = 28, reflected = false): void {
    if (enemy.definition.id === BIRD_PASS_TURTLE_ID && this.combat.now >= this.turtleVulnerableUntil) {
      EventBus.emit(GameEvents.showMessage, reflected ? "Перо отскочило от закрытого панциря." : "Панцирь закрыт — дождись открытого ядра.", 1250)
      return
    }
    const barWidth = enemy.definition.rank === "boss" ? 142 : 76
    const direction = reflected
      ? new Phaser.Math.Vector2(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y).normalize()
      : this.lastDirection
    const defeated = this.combat.hitEnemy(this, enemy, damage, direction, barWidth, knockback)
    if (enemy.definition.id === BIRD_PASS_TURTLE_ID) {
      this.turtlePhaseValue = turtlePhase(enemy.hp, enemy.maxHp)
      this.updateDiagnostics()
    }
    if (!defeated) return
    const x = enemy.sprite.x
    const y = enemy.sprite.y
    const wasCleared = gameStore.state.birdPassCleared
    const { firstDefeat, drop } = this.combat.recordDefeat(enemy, x, y)
    this.destroyEnemy(enemy)
    if (drop) this.addPickup(drop.id, x, y)
    if (enemy.definition.respawnMs != null) {
      const index = BIRD_PASS_ENEMIES.findIndex(({ id }) => id === enemy.definition.id)
      this.scheduleRespawn(enemy.definition, index, enemy.definition.respawnMs)
      EventBus.emit(GameEvents.showMessage, firstDefeat ? "⚙️ Робоптица обезврежена!" : "⚙️ Возрождённая робоптица снова обезврежена!", 1900)
    } else {
      this.destroyAllFeathers()
      EventBus.emit(GameEvents.showMessage, "🏆 Бронепанцирь обезврежен навсегда!", 2400)
    }
    this.updateDiagnostics()
    updateGameStatus("bird-pass", `Птичий перевал. Побед: ${gameStore.state.birdPassEnemyDefeats}.`)
    if (!wasCleared && gameStore.state.birdPassCleared) EventBus.emit(GameEvents.birdPassComplete)
  }

  private handleDebugDamageEnemy(id: string, damage: number): void {
    const enemy = this.enemies.find(({ definition }) => definition.id === id)
    if (!enemy || !Number.isFinite(damage) || damage <= 0) return
    if (enemy.definition.id === BIRD_PASS_TURTLE_ID) this.turtleVulnerableUntil = this.combat.now + 1000
    this.hitEnemy(enemy, damage, 0)
  }

  private destroyEnemy(enemy: RuntimeEnemy): void {
    this.combat.destroyEnemy(enemy)
    this.enemies = this.enemies.filter((active) => active !== enemy)
  }

  private turtle(): RuntimeEnemy | null {
    return this.enemies.find(({ definition }) => definition.id === BIRD_PASS_TURTLE_ID) ?? null
  }

  private destroyFeather(projectile: FeatherProjectile): void {
    if (projectile.sprite.active) projectile.sprite.destroy()
    this.feathers = this.feathers.filter((active) => active !== projectile)
  }

  private destroyAllFeathers(): void {
    for (const feather of this.feathers) feather.sprite.destroy()
    this.feathers = []
  }

  private createPickups(): void {
    gameStore.state.enemyGearDrops.forEach((drop) => {
      if (!drop.collected && drop.location === "bird-pass") this.addPickup(drop.id, drop.x, drop.y)
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
    for (const object of this.mapObjects("bird-pass-map")) {
      const resourceId = resourceIdFromObjectType(object.type)
      if (!resourceId || !object.name) continue
      const resource = addResourceNode(this, object.name, resourceId, object.x ?? 0, object.y ?? 0)
      if (resource) this.resources.push(resource)
    }
  }

  private createLabels(): void {
    this.add.text(155, 885, "←  ГОРНАЯ ЛОЩИНА", { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#fff4cf", backgroundColor: "#173f38dd", padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(1900)
    this.add.text(4450, 405, "АРЕНА БРОНЕПАНЦИРЯ", { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#e9ccff", backgroundColor: "#173f38dd", padding: { x: 12, y: 7 } }).setOrigin(0.5).setDepth(1900)
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
          ? "E — вернуться в Горную Лощину"
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
    EventBus.emit(GameEvents.showMessage, "⚙️ Шестерёнка робоптицы убрана в рюкзак.", 1700)
  }

  private positionEnemyUi(enemy: RuntimeEnemy): void {
    const offset = enemy.definition.rank === "boss" ? 125 : 72
    const width = enemy.definition.rank === "boss" ? 142 : 76
    enemy.healthBack.setPosition(enemy.sprite.x, enemy.sprite.y - offset)
    enemy.healthFill.setPosition(enemy.sprite.x - width / 2, enemy.sprite.y - offset)
    enemy.rankText.setPosition(enemy.sprite.x, enemy.sprite.y - offset + 15)
  }

  private updateDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.activeBirdPassEnemies = String(this.enemies.length)
    status.dataset.birdEnemies = String(gameStore.state.birdPassEnemyDefeats)
    status.dataset.birdPassCleared = String(gameStore.state.birdPassCleared)
    status.dataset.turtlePhase = String(this.turtlePhaseValue)
    status.dataset.activeFeathers = String(this.feathers.length)
    status.dataset.birdRanks = BIRD_PASS_ENEMIES.map(({ id, rank }) => `${id}:${rank}`).join(",")
  }
}
