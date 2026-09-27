import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { scaledEnemyHealth } from "../../domain/difficulty"
import { gameStore } from "../../domain/GameStore"
import { GADGETS } from "../../domain/gadgets"
import { PRODUCE } from "../../domain/produce"
import { ENEMY_RANK_LABELS } from "../../domain/quests"
import { KROK_OUTSKIRTS_ROADS, SNOW_CITY_ROADS, SNOW_VALLEY_ROADS } from "../../domain/roads"
import { KROK_SIEGE_ENEMIES } from "../../domain/krok"
import { calculateAttackDamage } from "../../domain/rules"
import {
  ICE_PALACE_ENEMIES,
  SNOW_CITY_ENEMIES,
  SNOW_VALLEY_ENEMIES,
  SNOW_WORLD_SIZES,
  WALRUS,
  WALRUS_AGGRO_RADIUS,
  WALRUS_ATTACKS,
  WALRUS_ID,
  walrusPhase,
  type SnowLocationId,
  type WalrusPhase,
} from "../../domain/snow"
import type { DifficultyId, EnemyDefinition, LocationId } from "../../domain/types"
import { CombatController } from "../CombatController"
import { actorFor, attachActor } from "../animation/AnimatedActor"
import { EventBus, GameEvents } from "../EventBus"
import { RoadCollisionController } from "../RoadCollisionController"
import { COLORS, FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"

interface SnowEnemy {
  definition: EnemyDefinition
  sprite: Phaser.Physics.Arcade.Image
  hp: number
  maxHp: number
  healthBack: Phaser.GameObjects.Rectangle
  healthFill: Phaser.GameObjects.Rectangle
  rankText: Phaser.GameObjects.Text
  playerCollider: Phaser.Physics.Arcade.Collider
  obstacleCollider: Phaser.Physics.Arcade.Collider
  homeX: number
  homeY: number
  nextAttackAt: number
  patrolAngle: number
  dashUntil: number
}

interface SnowProjectile {
  sprite: Phaser.Physics.Arcade.Image
  source: SnowEnemy
  damage: number
  bornAt: number
  reflected: boolean
}

interface GearPickup {
  id: string
  marker: Phaser.GameObjects.Container
  x: number
  y: number
}

interface SnowPortal {
  location: LocationId
  x: number
  y: number
}

const PROJECTILE_LIMIT = 64
const PROJECTILE_LIFETIME = 4800
const PORTAL_RADIUS = 125

const SCENE_ENEMIES: Record<SnowLocationId, readonly EnemyDefinition[]> = {
  "snow-valley": SNOW_VALLEY_ENEMIES,
  "snow-city": SNOW_CITY_ENEMIES,
  "krok-outskirts": KROK_SIEGE_ENEMIES,
  "ice-palace": ICE_PALACE_ENEMIES,
  "ice-throne": [WALRUS],
}

const SCENE_NAMES: Record<SnowLocationId, string> = {
  "snow-valley": "СНЕЖНАЯ ДОЛИНА",
  "snow-city": "СНЕЖНЫЙ ГОРОД",
  "krok-outskirts": "ОКРЕСТНОСТИ ГОРОДА КРОКОВ",
  "ice-palace": "ЛЕДЯНОЙ ДВОРЕЦ",
  "ice-throne": "ТРОННЫЙ ЗАЛ",
}

export class SnowWorldScene extends BaseWorldScene {
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private enemies: SnowEnemy[] = []
  private projectiles: SnowProjectile[] = []
  private pickups: GearPickup[] = []
  private portals: SnowPortal[] = []
  private nearestPickup: GearPickup | null = null
  private nearestPortal: SnowPortal | null = null
  private lastPrompt = ""
  private readonly combat = new CombatController()
  private roadCollision: RoadCollisionController | null = null
  private lastDifficulty: DifficultyId = "hard"
  private returningToVillage = false
  private shieldUntil = 0
  private shieldLastUsed = -10000
  private gloveUntil = 0
  private gloveLastUsed = -10000
  private gloveCaptures = 0
  private walrusAggro = false
  private walrusPhaseValue: WalrusPhase = 1
  private walrusAttackIndex = 0
  private nextSiegeEffectAt = 0
  private siegeGuards: Phaser.GameObjects.Image[] = []

  constructor(private readonly locationId: SnowLocationId) {
    super(locationId)
  }

  preload(): void {
    if (this.locationId !== "krok-outskirts") return
    if (!this.cache.tilemap.exists("krok-outskirts-map")) this.load.tilemapTiledJSON("krok-outskirts-map", "assets/maps/krok-outskirts.tmj")
    for (const side of ["west", "east"]) {
      const key = `krok-outskirts-${side}-bg`
      if (!this.textures.exists(key)) this.load.image(key, `assets/world/krok-outskirts-${side}-v2.jpg`)
    }
    if (!this.textures.exists("ice-catapult")) this.load.image("ice-catapult", "assets/enemies/ice-catapult.png")
    if (!this.textures.exists("krok-guard")) this.load.image("krok-guard", "assets/npc/krok-guard.png")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("main-menu")
      return
    }
    if (gameStore.state.chapter < 3 || !gameStore.state.birdPassCleared) {
      this.scene.start("forest-village")
      return
    }
    if (this.locationId === "ice-palace" && !gameStore.canEnterIcePalace()) {
      this.scene.start(gameStore.state.krokSiegeCleared ? "krok-city" : "krok-outskirts")
      return
    }
    gameStore.setLocation(this.locationId)
    this.resetRuntime()
    const { width, height } = SNOW_WORLD_SIZES[this.locationId]
    this.cameras.main.setBackgroundColor("#9dc4da")
    if (this.locationId === "snow-valley") {
      this.add.image(2400, 800, "snow-valley-bg").setDisplaySize(4800, 1600).setDepth(0)
    } else if (this.locationId === "snow-city" || this.locationId === "krok-outskirts") {
      this.add.image(1200, 800, `${this.locationId}-west-bg`).setDisplaySize(2400, 1600).setDepth(0)
      this.add.image(3600, 800, `${this.locationId}-east-bg`).setDisplaySize(2400, 1600).setDepth(0)
    } else {
      this.add.image(width / 2, height / 2, `${this.locationId}-bg`).setDisplaySize(width, height).setDepth(0)
    }

    const entry = this.entryPoint()
    const debugParams = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
    const debugX = Number(debugParams?.get("x"))
    const debugY = Number(debugParams?.get("y"))
    const spawn = debugParams?.has("x") && debugParams.has("y") && Number.isFinite(debugX) && Number.isFinite(debugY)
      ? { x: Phaser.Math.Clamp(debugX, 90, width - 90), y: Phaser.Math.Clamp(debugY, 90, height - 90) }
      : entry
    this.setupWorld(character, width, height, spawn.x, spawn.y, character.id === "watermelon" ? 96 : 102, character.id === "watermelon" ? 112 : 140)
    const roadNetwork = this.locationId === "snow-valley"
      ? SNOW_VALLEY_ROADS
      : this.locationId === "snow-city"
        ? SNOW_CITY_ROADS
        : this.locationId === "krok-outskirts"
          ? KROK_OUTSKIRTS_ROADS
        : null
    this.roadCollision = roadNetwork ? new RoadCollisionController(roadNetwork) : null
    this.roadCollision?.track(this.player, true)
    this.obstacles = this.loadMapCollisions(`${this.locationId}-map`, roadNetwork ?? undefined)
    this.createProjectileTextures()
    this.createPortals()
    this.createEnemies()
    if (this.locationId === "krok-outskirts") this.createSiegeGuards()
    this.createPickups()
    this.combat.arm(this.combat.now)
    this.lastDifficulty = gameStore.state.difficulty
    EventBus.on("debug-damage-enemy", this.handleDebugDamageEnemy, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off("debug-damage-enemy", this.handleDebugDamageEnemy, this)
      this.destroyAllProjectiles()
    })
    this.updateDiagnostics()
    updateGameStatus(this.locationId, SCENE_NAMES[this.locationId])
    this.cameras.main.fadeIn(300, 65, 105, 150)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.time.delayedCall(350, () => EventBus.emit(
      GameEvents.showMessage,
      this.locationId === "ice-throne" ? "Морж охраняет трон. Приближайся осторожно." : `${SCENE_NAMES[this.locationId]}. Следуй по дороге и остерегайся врагов.`,
      3000,
    ))
  }

  update(time: number, delta: number): void {
    if (!this.player?.body || this.returningToVillage) return
    const stableDelta = Math.min(delta, 50)
    this.updateWorldInput(stableDelta)
    time = this.combat.advance(delta, this.modalOpen)
    const onRoad = this.roadCollision?.constrain(this.player) ?? true
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) status.dataset.playerOnRoad = String(onRoad)
    if (this.modalOpen) {
      this.enemies.forEach(({ sprite }) => sprite.setVelocity(0, 0))
      return
    }
    this.syncDifficulty()
    this.updateEnemies(time, stableDelta)
    if (this.locationId === "krok-outskirts") this.updateSiegeEffects(time)
    this.updateProjectiles(time)
    this.updateGlove(time)
    this.updateNearest()
    if (this.gadgetPressed()) this.useGadget(time)
    if (this.attackPressed() && this.combat.tryBeginAttack(time)) this.attack()
    if (!this.interactionPressed()) return
    if (this.nearestPickup) this.collectPickup(this.nearestPickup)
    else if (this.nearestPortal) {
      if (this.nearestPortal.location === "krok-city" && !gameStore.state.krokSiegeCleared) {
        EventBus.emit(GameEvents.showMessage, `Ворота закрыты: победите осаждающих (${gameStore.state.defeatedEnemies.filter((id) => id.startsWith("siege-")).length}/13).`, 2400)
      } else if (this.nearestPortal.location === "ice-palace" && !gameStore.canEnterIcePalace()) {
        EventBus.emit(GameEvents.showMessage, "Вход откроется после разговора с Кроком-Принцем.", 2200)
      } else this.transitionTo(this.nearestPortal.location, this.nearestPortal.location)
    }
  }

  private resetRuntime(): void {
    this.enemies = []
    this.projectiles = []
    this.pickups = []
    this.portals = []
    this.nearestPickup = null
    this.nearestPortal = null
    this.lastPrompt = ""
    this.returningToVillage = false
    this.shieldUntil = 0
    this.shieldLastUsed = -10000
    this.gloveUntil = 0
    this.gloveLastUsed = -10000
    this.gloveCaptures = 0
    this.walrusAggro = false
    this.walrusPhaseValue = gameStore.state.walrusCleared ? "defeated" : 1
    this.walrusAttackIndex = 0
    this.combat.reset()
  }

  private entryPoint(): { x: number; y: number } {
    const from = gameStore.state.entryFrom
    if (this.locationId === "ice-throne") return { x: 145, y: 450 }
    if (this.locationId === "ice-palace") return from === "ice-throne" ? { x: 2180, y: 800 } : { x: 180, y: 800 }
    if (this.locationId === "krok-outskirts") return from === "krok-city" ? { x: 4610, y: 800 } : { x: 180, y: 800 }
    if (this.locationId === "snow-city") return from === "krok-outskirts" ? { x: 4620, y: 800 } : { x: 180, y: 800 }
    return from === "snow-city" ? { x: 4620, y: 800 } : { x: 180, y: 800 }
  }

  private createPortals(): void {
    for (const object of this.mapObjects(`${this.locationId}-map`)) {
      if (object.type !== "portal" || !object.name) continue
      const portal: SnowPortal = { location: object.name as LocationId, x: object.x ?? 0, y: object.y ?? 0 }
      this.portals.push(portal)
      const label = portal.location === "forest-village" ? "← ДЕРЕВНЯ"
        : portal.location === "snow-valley" ? "← СНЕЖНАЯ ДОЛИНА"
          : portal.location === "snow-city" ? (portal.x < 300 ? "← СНЕЖНЫЙ ГОРОД" : "СНЕЖНЫЙ ГОРОД →")
            : portal.location === "krok-outskirts" ? "ОСАДА КРОКОВ →"
              : portal.location === "krok-city" ? "ВОРОТА КРОКОВ →"
            : portal.location === "ice-palace" ? (portal.x < 300 ? "← ЛЕДЯНОЙ ДВОРЕЦ" : "ЛЕДЯНОЙ ДВОРЕЦ →")
              : "ТРОННЫЙ ЗАЛ →"
      this.add.text(portal.x, portal.y - 102, label, { fontFamily: FONT, fontSize: "19px", fontStyle: "bold", color: "#f3fbff", backgroundColor: "#16365cdd", padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(2200)
    }
  }

  private createProjectileTextures(): void {
    for (const [key, color, radius] of [["snow-shot", 0xf5faff, 13], ["ice-shot", 0xa5efff, 12], ["metal-feather", 0xc8d5de, 10]] as const) {
      if (this.textures.exists(key)) continue
      const graphics = this.make.graphics({ x: 0, y: 0 })
      graphics.fillStyle(color, 1).fillEllipse(16, 16, radius * 2, radius)
      graphics.lineStyle(2, 0x4b7891, 0.9).strokeEllipse(16, 16, radius * 2, radius)
      graphics.generateTexture(key, 32, 32)
      graphics.destroy()
    }
  }

  private createEnemies(): void {
    const now = Date.now()
    SCENE_ENEMIES[this.locationId].forEach((definition, index) => {
      if (definition.respawnMs === null && gameStore.state.defeatedEnemies.includes(definition.id)) return
      const delay = Math.max(0, (gameStore.state.enemyRespawnAt[definition.id] ?? 0) - now)
      if (delay > 0) this.combat.scheduleRespawn(this, delay, () => this.spawnEnemy(definition, index))
      else this.spawnEnemy(definition, index)
    })
  }

  private spawnEnemy(definition: EnemyDefinition, index: number): void {
    if (this.enemies.some((enemy) => enemy.definition.id === definition.id)) return
    if (definition.respawnMs === null && gameStore.state.defeatedEnemies.includes(definition.id)) return
    const sprite = this.physics.add.image(definition.x, definition.y, definition.assetKey)
    const size = definition.type === "ice-catapult" ? [165, 150] : definition.rank === "boss" ? [235, 230]
      : definition.type === "snowball" ? [88, 80]
        : definition.type === "robot-albatross" ? [145, 122]
          : definition.type === "snowman" ? [115, 135] : [140, 145]
    sprite.setDisplaySize(size[0]!, size[1]!).setDepth(sprite.y + 20).setCollideWorldBounds(true)
    if (definition.type === "ice-catapult") sprite.setImmovable(true)
    this.combat.configureEnemyBody(sprite)
    sprite.setName(definition.id)
    this.roadCollision?.track(sprite, true)
    const barY = sprite.y + (definition.rank === "boss" ? 132 : -85)
    const barWidth = definition.rank === "boss" ? 150 : 76
    const healthBack = this.add.rectangle(sprite.x, barY, barWidth + 2, 12, 0x18304c, 0.94).setDepth(3000)
    const healthFill = this.add.rectangle(sprite.x - barWidth / 2, barY, barWidth, 9, definition.rank === "boss" ? 0x814cdd : COLORS.coral).setOrigin(0, 0.5).setDepth(3001)
    const rankText = this.add.text(sprite.x, barY + 15, ENEMY_RANK_LABELS[definition.rank], { fontFamily: FONT, fontSize: definition.rank === "boss" ? "15px" : "11px", fontStyle: "bold", color: "#f3fbff", backgroundColor: "#16365cdd", padding: { x: 5, y: 2 } }).setOrigin(0.5, 0).setDepth(3002)
    const maxHp = scaledEnemyHealth(definition, gameStore.state.difficulty)
    const obstacleCollider = this.physics.add.collider(sprite, this.obstacles)
    const playerCollider = this.physics.add.collider(sprite, this.player, () => {
      if (definition.rank !== "boss" && definition.behavior !== "snow-throw" && definition.behavior !== "feather-fan" && definition.behavior !== "ice-catapult") {
        this.damagePlayer(definition.damage, sprite.x, sprite.y, this.combat.now)
      }
    })
    this.enemies.push({ definition, sprite, hp: maxHp, maxHp, healthBack, healthFill, rankText, obstacleCollider, playerCollider, homeX: sprite.x, homeY: sprite.y, nextAttackAt: this.combat.now + 1000 + index * 80, patrolAngle: index * 1.18, dashUntil: 0 })
    this.updateDiagnostics()
  }

  private syncDifficulty(): void {
    const difficulty = gameStore.state.difficulty
    if (difficulty === this.lastDifficulty) return
    this.combat.rescaleEnemies(this.enemies, this.lastDifficulty, difficulty)
    this.lastDifficulty = difficulty
    const walrus = this.walrus()
    if (walrus) this.walrusPhaseValue = walrusPhase(walrus.hp, walrus.maxHp)
    this.updateDiagnostics()
  }

  private updateEnemies(time: number, delta: number): void {
    const activeArea = Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(this.cameras.main.worldView), 220, 200)
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue
      this.roadCollision?.constrain(enemy.sprite)
      const distanceSq = Phaser.Math.Distance.Squared(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y)
      if (!activeArea.contains(enemy.sprite.x, enemy.sprite.y)) {
        enemy.sprite.setVelocity(0, 0)
        this.positionEnemyUi(enemy)
        continue
      }
      if (this.combat.isEnemyRecoiling(enemy)) {
        enemy.sprite.setDepth(enemy.sprite.y + 20)
        this.positionEnemyUi(enemy)
        continue
      }
      if (enemy.definition.id === WALRUS_ID) {
        this.updateWalrus(enemy, time, distanceSq)
        this.positionEnemyUi(enemy)
        continue
      }
      if (enemy.definition.type === "ice-catapult") {
        enemy.sprite.setVelocity(0, 0)
        if (time >= enemy.nextAttackAt && distanceSq < 650 * 650) this.enemySpecial(enemy, time, Math.sqrt(distanceSq))
        this.positionEnemyUi(enemy)
        continue
      }
      if (time < enemy.dashUntil) {
        this.positionEnemyUi(enemy)
        continue
      }
      const distance = Math.sqrt(distanceSq) || 1
      const dx = (this.player.x - enemy.sprite.x) / distance
      const dy = (this.player.y - enemy.sprite.y) / distance
      const ranged = enemy.definition.behavior === "snow-throw" || enemy.definition.behavior === "feather-fan"
      const direction = ranged && distance < 220 ? -0.6 : distance > (ranged ? 360 : 80) ? 1 : 0
      if (direction) enemy.sprite.setVelocity(dx * enemy.definition.speed * direction, dy * enemy.definition.speed * direction)
      else {
        enemy.patrolAngle += delta * 0.001
        enemy.sprite.setVelocity(Math.cos(enemy.patrolAngle) * 18, Math.sin(enemy.patrolAngle) * 12)
      }
      if (time >= enemy.nextAttackAt && distance < (ranged ? 560 : 175)) this.enemySpecial(enemy, time, distance)
      const velocity = (enemy.sprite.body as Phaser.Physics.Arcade.Body).velocity
      actorFor(enemy.sprite)?.face(velocity.x, velocity.y)
      enemy.sprite.setDepth(enemy.sprite.y + 20)
      this.positionEnemyUi(enemy)
    }
  }

  private enemySpecial(enemy: SnowEnemy, time: number, distance: number): void {
    actorFor(enemy.sprite)?.face(this.player.x - enemy.sprite.x, this.player.y - enemy.sprite.y)
    const behavior = enemy.definition.behavior
    if (behavior === "ice-catapult") {
      enemy.nextAttackAt = time + 3300
      const targetX = this.player.x
      const targetY = this.player.y
      this.warnCircle(targetX, targetY, 90, 900)
      EventBus.emit(GameEvents.showMessage, "Катапульта наводится! Выйди из отмеченной зоны.", 1200)
      actorFor(enemy.sprite)?.play("shoot", { duration: 1250, impactAt: 900, onImpact: () => {
        if (!enemy.sprite.active || this.returningToVillage || !this.cameras.main.worldView.contains(enemy.sprite.x, enemy.sprite.y)) return
        const blast = this.add.circle(targetX, targetY, 85, 0xb7e9ff, 0.55).setDepth(2450)
        this.tweens.add({ targets: blast, alpha: 0, scale: 1.4, duration: 450, onComplete: () => blast.destroy() })
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY) <= 85) this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y, this.combat.now)
      } })
      return
    }
    enemy.nextAttackAt = time + (behavior === "snow-rush" ? 2400 : behavior === "snow-throw" ? 2600 : behavior === "feather-fan" ? 2800 : 3100)
    const warningMs = behavior === "snow-rush" ? 350 : 600
    this.warnCircle(enemy.sprite.x, enemy.sprite.y, behavior === "ice-slam" ? 145 : 70, warningMs)
    actorFor(enemy.sprite)?.play(behavior === "snow-rush" ? "charge" : behavior === "ice-slam" ? "attack" : "shoot", { duration: warningMs + 420, impactAt: warningMs, onImpact: () => {
      if (!enemy.sprite.active || this.returningToVillage) return
      const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
      if (behavior === "snow-throw") this.fireProjectile(enemy, angle, 300, "snow-shot", enemy.definition.damage)
      else if (behavior === "feather-fan") for (const offset of [-0.19, 0, 0.19]) this.fireProjectile(enemy, angle + offset, 385, "metal-feather", enemy.definition.damage)
      else if (behavior === "snow-rush") {
        enemy.dashUntil = this.combat.now + 420
        enemy.sprite.setVelocity(Math.cos(angle) * 360, Math.sin(angle) * 360)
      }
      else if (behavior === "ice-slam" && distance < 190 && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y) < 175) {
        this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y, this.combat.now)
      }
    } })
  }

  private updateWalrus(enemy: SnowEnemy, time: number, distanceSq: number): void {
    this.walrusPhaseValue = walrusPhase(enemy.hp, enemy.maxHp)
    if (!this.walrusAggro && distanceSq <= WALRUS_AGGRO_RADIUS * WALRUS_AGGRO_RADIUS) {
      this.walrusAggro = true
      EventBus.emit(GameEvents.showMessage, "Морж заметил героя — берегись сосулек и хвоста!", 2500)
    }
    if (!this.walrusAggro) {
      enemy.sprite.setVelocity(0, 0)
      return
    }
    const distance = Math.sqrt(distanceSq) || 1
    actorFor(enemy.sprite)?.face(this.player.x - enemy.sprite.x, this.player.y - enemy.sprite.y)
    if (distance > 125 && distance < 680) {
      enemy.sprite.setVelocity((this.player.x - enemy.sprite.x) / distance * enemy.definition.speed, (this.player.y - enemy.sprite.y) / distance * enemy.definition.speed)
    } else enemy.sprite.setVelocity(0, 0)
    if (time < enemy.nextAttackAt) return
    const phase = this.walrusPhaseValue
    const attacks = phase === 1 ? ["icicle"] : phase === 2 ? ["icicle", "tail", "tusk"] : ["icicle", "tail", "tusk", "icicle"]
    const attack = attacks[this.walrusAttackIndex++ % attacks.length]
    enemy.nextAttackAt = time + (phase === 3 ? 1900 : phase === 2 ? 2500 : 3000)
    if (attack === "icicle") this.walrusIcicles(enemy)
    else if (attack === "tail") this.walrusTail(enemy)
    else this.walrusTusks(enemy)
    this.updateDiagnostics()
  }

  private walrusIcicles(enemy: SnowEnemy): void {
    this.warnCircle(enemy.sprite.x, enemy.sprite.y, 85, 650)
    EventBus.emit(GameEvents.showMessage, "Морж готовит залп сосульками — укройся за ледяной мебелью!", 1400)
    actorFor(enemy.sprite)?.play("cast", { duration: 1050, impactAt: 650, onImpact: () => {
      if (!enemy.sprite.active) return
      const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
      for (const offset of [-0.16, 0, 0.16]) this.fireProjectile(enemy, angle + offset, 400, "ice-shot", WALRUS_ATTACKS.icicle)
    } })
  }

  private walrusTail(enemy: SnowEnemy): void {
    const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y)
    const warning = this.add.arc(enemy.sprite.x, enemy.sprite.y, 165, Phaser.Math.RadToDeg(angle) - 68, Phaser.Math.RadToDeg(angle) + 68, false, 0xff8b72, 0.22).setDepth(2500)
    EventBus.emit(GameEvents.showMessage, "Морж замахнулся хвостом — выйди из красной дуги!", 1400)
    actorFor(enemy.sprite)?.play("tail", { duration: 1100, impactAt: 700, onCancel: () => warning.destroy(), onImpact: () => {
      warning.destroy()
      if (!enemy.sprite.active) return
      const dx = this.player.x - enemy.sprite.x
      const dy = this.player.y - enemy.sprite.y
      const distance = Math.hypot(dx, dy)
      const difference = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle)
      if (distance < 165 && Math.abs(difference) < 1.2) this.damagePlayer(WALRUS_ATTACKS.tail, enemy.sprite.x, enemy.sprite.y, this.combat.now)
    } })
  }

  private walrusTusks(enemy: SnowEnemy): void {
    this.warnCircle(enemy.sprite.x, enemy.sprite.y, 115, 420)
    EventBus.emit(GameEvents.showMessage, "Морж атакует клыками вблизи!", 1100)
    actorFor(enemy.sprite)?.play("tusks", { duration: 800, impactAt: 420, onImpact: () => {
      if (enemy.sprite.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y) < 120) {
        this.damagePlayer(WALRUS_ATTACKS.tusk, enemy.sprite.x, enemy.sprite.y, this.combat.now)
      }
    } })
  }

  private warnCircle(x: number, y: number, radius: number, duration: number): void {
    const warning = this.add.circle(x, y, radius, 0xff9569, 0.18).setStrokeStyle(3, 0xffd173, 0.9).setDepth(2500)
    this.tweens.add({ targets: warning, alpha: 0, scale: 1.14, duration, onComplete: () => warning.destroy() })
  }

  private fireProjectile(source: SnowEnemy, angle: number, speed: number, texture: string, damage: number): void {
    if (!source.sprite.active || this.projectiles.length >= PROJECTILE_LIMIT) return
    const sprite = this.physics.add.image(source.sprite.x, source.sprite.y, texture).setDepth(2800).setRotation(angle).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    ;(sprite.body as Phaser.Physics.Arcade.Body).setSize(24, 18)
    const projectile: SnowProjectile = { sprite, source, damage, bornAt: this.combat.now, reflected: false }
    this.projectiles.push(projectile)
    this.physics.add.collider(sprite, this.obstacles, () => this.destroyProjectile(projectile))
  }

  private updateProjectiles(time: number): void {
    const camera = Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(this.cameras.main.worldView), 320, 260)
    for (const projectile of [...this.projectiles]) {
      if (!projectile.sprite.active) continue
      if (time - projectile.bornAt > PROJECTILE_LIFETIME || !camera.contains(projectile.sprite.x, projectile.sprite.y)) {
        this.destroyProjectile(projectile)
        continue
      }
      if (projectile.reflected) {
        if (!projectile.source.sprite.active) this.destroyProjectile(projectile)
        else if (Phaser.Math.Distance.Between(projectile.sprite.x, projectile.sprite.y, projectile.source.sprite.x, projectile.source.sprite.y) < 55) {
          this.hitEnemy(projectile.source, 2)
          this.destroyProjectile(projectile)
        }
      } else if (Phaser.Math.Distance.Between(projectile.sprite.x, projectile.sprite.y, this.player.x, this.player.y) < 43) {
        this.destroyProjectile(projectile)
        this.damagePlayer(projectile.damage, projectile.source.sprite.x, projectile.source.sprite.y, time)
      }
    }
    this.updateDiagnostics()
  }

  private updateGlove(time: number): void {
    if (time >= this.gloveUntil) return
    for (const projectile of [...this.projectiles]) {
      if (!projectile.sprite.active || projectile.reflected || projectile.source.definition.type !== "robot-albatross") continue
      if (Phaser.Math.Distance.Between(projectile.sprite.x, projectile.sprite.y, this.player.x, this.player.y) > 220) continue
      if (this.gloveCaptures >= 3 || !projectile.source.sprite.active) {
        this.destroyProjectile(projectile)
        continue
      }
      this.gloveCaptures += 1
      projectile.reflected = true
      projectile.bornAt = time
      const angle = Phaser.Math.Angle.Between(projectile.sprite.x, projectile.sprite.y, projectile.source.sprite.x, projectile.source.sprite.y)
      projectile.sprite.setTint(0x80eaff).setVelocity(Math.cos(angle) * 500, Math.sin(angle) * 500)
    }
  }

  private useGadget(time: number): void {
    const equipped = gameStore.state.equippedGadget
    if (equipped === "pulse-shield") {
      const { durationMs, cooldownMs } = GADGETS[equipped]
      if (time - this.shieldLastUsed < cooldownMs) return
      this.shieldLastUsed = time
      this.shieldUntil = time + durationMs
      actorFor(this.player)?.play("gadget", { duration: 350 })
      this.player.setTint(0x7ad7ff)
      this.time.delayedCall(durationMs, () => this.player.active && this.player.clearTint())
      EventBus.emit(GameEvents.showMessage, "Щит готов погасить следующий удар.", 1500)
    } else if (equipped === "magnetic-glove") {
      if (time - this.gloveLastUsed < GADGETS[equipped].cooldownMs) return
      this.gloveLastUsed = time
      this.gloveUntil = time + 1500
      actorFor(this.player)?.play("gadget", { duration: 350 })
      this.gloveCaptures = 0
      EventBus.emit(GameEvents.showMessage, "Перчатка перехватывает металлические перья альбатросов.", 1600)
    } else EventBus.emit(GameEvents.showMessage, "Здесь полезны щит и магнитная перчатка.", 1500)
  }

  private damagePlayer(amount: number, sourceX: number, sourceY: number, time: number): void {
    if (this.returningToVillage) return
    const result = this.combat.damagePlayer(this, this.player, amount, sourceX, sourceY, time, time < this.shieldUntil)
    if (result === "shielded") {
      this.shieldUntil = 0
      this.player.clearTint()
      EventBus.emit(GameEvents.showMessage, "Импульсный щит погасил удар!", 1300)
    } else if (result === "knocked-out") {
      this.returningToVillage = true
      this.destroyAllProjectiles()
      EventBus.emit(GameEvents.showMessage, "Героя вернули в деревню с полным здоровьем.", 1900)
      this.time.delayedCall(650, () => this.scene.start("forest-village"))
    }
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
      const produce = gameStore.consumeProduceShot()
      if (!produce) return
      const target = this.findAttackTarget(420, 0.55)
      const endX = target?.sprite.x ?? this.player.x + this.lastDirection.x * 360
      const endY = target?.sprite.y ?? this.player.y + this.lastDirection.y * 360
      const shot = this.add.text(this.player.x, this.player.y, PRODUCE[produce].icon, { fontFamily: FONT, fontSize: "28px" }).setOrigin(0.5).setDepth(3300)
      this.tweens.add({ targets: shot, x: endX, y: endY, angle: 480, duration: 280, onComplete: () => {
        shot.destroy()
        if (target?.sprite.active) this.hitEnemy(target, PRODUCE[produce].damage)
      } })
      return
    }
    const arc = this.add.arc(this.player.x + this.lastDirection.x * 65, this.player.y + this.lastDirection.y * 65, 70, Phaser.Math.RadToDeg(this.lastDirection.angle()) - 55, Phaser.Math.RadToDeg(this.lastDirection.angle()) + 55, false, COLORS.yellow, 0.45).setDepth(3200)
    this.tweens.add({ targets: arc, alpha: 0, scale: 1.18, duration: 180, onComplete: () => arc.destroy() })
    const target = this.findAttackTarget(150, -0.05)
    if (target) this.hitEnemy(target, calculateAttackDamage(character.stats.strength))
  }

  private findAttackTarget(range: number, minDot: number): SnowEnemy | null {
    let best: SnowEnemy | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue
      const dx = enemy.sprite.x - this.player.x
      const dy = enemy.sprite.y - this.player.y
      const distance = Math.hypot(dx, dy)
      if (distance > range || distance >= bestDistance) continue
      const dot = (dx / (distance || 1)) * this.lastDirection.x + (dy / (distance || 1)) * this.lastDirection.y
      if (dot < minDot) continue
      best = enemy
      bestDistance = distance
    }
    return best
  }

  private hitEnemy(enemy: SnowEnemy, damage: number): void {
    if (!enemy.sprite.active) return
    const wasCleared = gameStore.state.walrusCleared
    const defeated = this.combat.hitEnemy(this, enemy, damage, this.lastDirection, enemy.definition.rank === "boss" ? 150 : 76, 0)
    if (enemy.definition.id === WALRUS_ID) this.walrusPhaseValue = walrusPhase(enemy.hp, enemy.maxHp)
    if (!defeated) {
      this.updateDiagnostics()
      return
    }
    const { x, y } = enemy.sprite
    const siegeWasCleared = gameStore.state.krokSiegeCleared
    const { drop } = this.combat.recordDefeat(enemy, x, y)
    this.destroyEnemy(enemy)
    if (drop) this.addPickup(drop.id, x, y)
    if (enemy.definition.respawnMs != null) {
      const index = SCENE_ENEMIES[this.locationId].findIndex(({ id }) => id === enemy.definition.id)
      this.combat.scheduleRespawn(this, enemy.definition.respawnMs, () => this.spawnEnemy(enemy.definition, index))
    }
    if (!wasCleared && gameStore.state.walrusCleared) {
      this.destroyAllProjectiles()
      EventBus.emit(GameEvents.walrusComplete)
    } else if (!siegeWasCleared && gameStore.state.krokSiegeCleared) EventBus.emit(GameEvents.showMessage, "Ворота открыты! +8 шестерёнок и Знак защитника Кроков.", 3000)
    else EventBus.emit(GameEvents.showMessage, enemy.definition.dropsGear ? "⚙️ Враг оставил шестерёнку." : "Враг побеждён.", 1300)
    this.updateDiagnostics()
  }

  private handleDebugDamageEnemy(id: string, damage: number): void {
    const enemy = this.enemies.find(({ definition }) => definition.id === id)
    if (enemy && Number.isFinite(damage) && damage > 0) this.hitEnemy(enemy, damage)
  }

  private destroyEnemy(enemy: SnowEnemy): void {
    enemy.playerCollider.destroy()
    enemy.obstacleCollider.destroy()
    this.combat.destroyEnemy(enemy)
    this.enemies = this.enemies.filter((item) => item !== enemy)
  }

  private walrus(): SnowEnemy | null {
    return this.enemies.find(({ definition }) => definition.id === WALRUS_ID) ?? null
  }

  private destroyProjectile(projectile: SnowProjectile): void {
    if (projectile.sprite.active) projectile.sprite.destroy()
    this.projectiles = this.projectiles.filter((item) => item !== projectile)
  }

  private destroyAllProjectiles(): void {
    for (const projectile of this.projectiles) if (projectile.sprite.active) projectile.sprite.destroy()
    this.projectiles = []
  }

  private createPickups(): void {
    for (const drop of gameStore.state.enemyGearDrops) {
      if (!drop.collected && drop.location === this.locationId) this.addPickup(drop.id, drop.x, drop.y)
    }
  }

  private addPickup(id: string, x: number, y: number): void {
    const marker = this.add.container(x, y, [
      this.add.circle(0, 0, 25, COLORS.yellow, 0.28),
      this.add.text(0, 0, "⚙️", { fontFamily: FONT, fontSize: "31px" }).setOrigin(0.5),
    ]).setDepth(y + 20)
    this.tweens.add({ targets: marker, y: y - 7, duration: 800, yoyo: true, repeat: -1 })
    this.pickups.push({ id, marker, x, y })
  }

  private updateNearest(): void {
    this.nearestPickup = null
    this.nearestPortal = null
    let nearest = Number.POSITIVE_INFINITY
    for (const pickup of this.pickups) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y)
      if (pickup.marker.active && distance < 95 && distance < nearest) {
        this.nearestPickup = pickup
        nearest = distance
      }
    }
    if (!this.nearestPickup) for (const portal of this.portals) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, portal.x, portal.y)
      if (distance < PORTAL_RADIUS && distance < nearest) {
        this.nearestPortal = portal
        nearest = distance
      }
    }
    const prompt = this.nearestPickup ? "E — подобрать шестерёнку"
      : this.nearestPortal ? `E — ${SCENE_NAMES[this.nearestPortal.location as SnowLocationId] ?? "в деревню"}` : ""
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private collectPickup(pickup: GearPickup): void {
    if (!gameStore.collectEnemyGearDrop(pickup.id)) return
    pickup.marker.destroy(true)
    this.pickups = this.pickups.filter((item) => item !== pickup)
    EventBus.emit(GameEvents.showMessage, "⚙️ Шестерёнка убрана в рюкзак.", 1400)
  }

  private positionEnemyUi(enemy: SnowEnemy): void {
    const offset = enemy.definition.rank === "boss" ? -132 : 85
    const width = enemy.definition.rank === "boss" ? 150 : 76
    enemy.healthBack.setPosition(enemy.sprite.x, enemy.sprite.y - offset)
    enemy.healthFill.setPosition(enemy.sprite.x - width / 2, enemy.sprite.y - offset)
    enemy.rankText.setPosition(enemy.sprite.x, enemy.sprite.y - offset + 15)
    enemy.sprite.setDepth(enemy.sprite.y + 20)
  }

  private updateDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.activeSnowEnemies = String(this.enemies.length)
    status.dataset.snowValleyEnemies = String(gameStore.state.snowValleyEnemyDefeats)
    status.dataset.snowCityEnemies = String(gameStore.state.snowCityEnemyDefeats)
    status.dataset.icePalaceEnemies = String(gameStore.state.icePalaceEnemyDefeats)
    status.dataset.walrusPhase = String(this.walrusPhaseValue)
    status.dataset.walrusAggro = String(this.walrusAggro)
    status.dataset.activeSnowProjectiles = String(this.projectiles.length)
    status.dataset.krokSiege = String(gameStore.state.defeatedEnemies.filter((id) => id.startsWith("siege-")).length)
    status.dataset.krokGateOpen = String(gameStore.state.krokSiegeCleared)
  }

  private createSiegeGuards(): void {
    this.siegeGuards = []
    for (const x of [3920, 4140, 4360, 4580]) {
      const guard = this.add.image(x, 555, "krok-guard").setDisplaySize(94, 125).setDepth(556)
      attachActor(this, guard)
      this.siegeGuards.push(guard)
    }
  }

  private updateSiegeEffects(time: number): void {
    if (time < this.nextSiegeEffectAt) return
    this.nextSiegeEffectAt = time + 1250
    const view = this.cameras.main.worldView
    const visible = this.enemies.filter(({ sprite }) => sprite.active && view.contains(sprite.x, sprite.y))
    const target = visible.find(({ definition }) => definition.type !== "ice-catapult")
    if (target && view.contains(4500, 600)) {
      const guard = this.siegeGuards[3]
      if (guard) {
        actorFor(guard)?.face(target.sprite.x - guard.x, target.sprite.y - guard.y)
        actorFor(guard)?.play("shoot", { duration: 600, impactAt: 120, onImpact: () => {
      const arrow = this.add.ellipse(4490, 590, 17, 5, 0xf6db9c).setDepth(2000)
      this.tweens.add({ targets: arrow, x: target.sprite.x, y: target.sprite.y, duration: 500, onComplete: () => {
        arrow.destroy()
        const spark = this.add.circle(target.sprite.x, target.sprite.y, 18, 0xffe6aa, 0.8).setDepth(2200)
        this.tweens.add({ targets: spark, alpha: 0, scale: 1.8, duration: 350, onComplete: () => spark.destroy() })
      } })
        } })
      }
    }
    const catapult = visible.find(({ definition }) => definition.type === "ice-catapult")
    if (catapult && view.contains(4560, 680) && !actorFor(catapult.sprite)?.isPlaying) {
      actorFor(catapult.sprite)?.face(4550 - catapult.sprite.x, 670 - catapult.sprite.y)
      actorFor(catapult.sprite)?.play("shoot", { duration: 800, impactAt: 180, onImpact: () => {
      const stone = this.add.circle(catapult.sprite.x, catapult.sprite.y - 40, 12, 0xb9e9fc).setDepth(2100)
      this.tweens.add({ targets: stone, x: 4550, y: 670, duration: 620, onComplete: () => {
        stone.destroy()
        const impact = this.add.circle(4550, 670, 27, 0xf4fbff, 0.8).setDepth(2200)
        this.tweens.add({ targets: impact, alpha: 0, scale: 1.8, duration: 500, onComplete: () => impact.destroy() })
      } })
      } })
    }
  }
}

export class SnowValleyScene extends SnowWorldScene { constructor() { super("snow-valley") } }
export class SnowCityScene extends SnowWorldScene { constructor() { super("snow-city") } }
export class KrokOutskirtsScene extends SnowWorldScene { constructor() { super("krok-outskirts") } }
export class IcePalaceScene extends SnowWorldScene { constructor() { super("ice-palace") } }
export class IceThroneScene extends SnowWorldScene { constructor() { super("ice-throne") } }
