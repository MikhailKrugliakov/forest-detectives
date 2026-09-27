import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { gameStore } from "../../domain/GameStore"
import { ENEMIES, ENEMY_RANK_LABELS } from "../../domain/quests"
import { calculateAttackDamage } from "../../domain/rules"
import { GADGETS } from "../../domain/gadgets"
import { PRODUCE } from "../../domain/produce"
import { MINE_ENTRANCES, RESOURCES } from "../../domain/resources"
import { WILD_MOUNTAIN_PORTAL } from "../../domain/mountain"
import { WILD_FOREST_ROADS } from "../../domain/roads"
import { scaledEnemyHealth } from "../../domain/difficulty"
import type { DifficultyId, EnemyDefinition, ProduceId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { CombatController } from "../CombatController"
import { actorFor } from "../animation/AnimatedActor"
import { RoadCollisionController } from "../RoadCollisionController"
import { COLORS, FONT } from "../ui"
import { addResourceNode, collectResourceNode, resourceIdFromObjectType, resourcePrompt, type RuntimeResourceNode } from "../WorldResources"
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
}

interface Pickup {
  id: string
  kind: "letter" | "gear"
  x: number
  y: number
  marker: Phaser.GameObjects.Container
}

const LETTERS = [
  { id: "letter-1", x: 590, y: 390 },
  { id: "letter-2", x: 1290, y: 710 },
  { id: "letter-3", x: 1940, y: 410 },
] as const

export class WildForestScene extends BaseWorldScene {
  private enemies: RuntimeEnemy[] = []
  private pickups: Pickup[] = []
  private resources: RuntimeResourceNode[] = []
  private readonly combat = new CombatController()
  private readonly roadCollision = new RoadCollisionController(WILD_FOREST_ROADS)
  private returningToVillage = false
  private nearestPickup: Pickup | null = null
  private nearestResource: RuntimeResourceNode | null = null
  private atVillageExit = false
  private atMineEntrance = false
  private atMountainExit = false
  private lastPrompt = ""
  private shieldUntil = 0
  private shieldLastUsed = -10000
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private enemyPlayerCollisions = 0
  private lastDifficulty: DifficultyId = "hard"

  constructor() {
    super("wild-forest")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("character-select")
      return
    }
    this.resetRuntimeState()
    this.lastDifficulty = gameStore.state.difficulty
    gameStore.setLocation("wild-forest")
    this.cameras.main.setBackgroundColor("#173532")
    this.add.image(1200, 800, "wild-forest-bg").setDisplaySize(2400, 1600).setDepth(0)
    const mineEntrance = MINE_ENTRANCES[gameStore.state.mineEntranceIndex]!
    const spawn = gameStore.state.entryFrom === "forest-mine"
      ? { x: mineEntrance.x, y: Math.min(1500, mineEntrance.y + 135) }
      : gameStore.state.entryFrom === "mountain-hollow"
        ? { x: WILD_MOUNTAIN_PORTAL.x - 120, y: WILD_MOUNTAIN_PORTAL.y }
        : { x: 210, y: 1390 }
    this.setupWorld(
      character,
      2400,
      1600,
      spawn.x,
      spawn.y,
      character.id === "watermelon" ? 96 : 102,
      character.id === "watermelon" ? 112 : 140,
    )
    this.roadCollision.track(this.player, true)
    this.obstacles = this.loadMapCollisions("wild-forest-map", WILD_FOREST_ROADS)
    this.createEnemies()
    this.createPickups()
    this.createSurfaceResources()
    this.createVillageExit()
    this.createMineEntrance()
    this.createMountainPass()
    if (import.meta.env.DEV) {
      EventBus.on("debug-damage-enemy", this.handleDebugDamageEnemy, this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        EventBus.off("debug-damage-enemy", this.handleDebugDamageEnemy, this)
      })
    }
    this.combat.arm(this.combat.now)
    updateGameStatus(
      "wild-forest",
      `Дикий лес. Всего обезврежено робозверей: ${gameStore.state.wildForestEnemyDefeats}.`,
    )
    this.cameras.main.fadeIn(300, 15, 38, 35)

    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.time.delayedCall(350, () => {
      EventBus.emit(
        GameEvents.showMessage,
        "Робозвери патрулируют тропы. Пробел — атака, R — сменить оружие, E — подобрать предмет.",
        5200,
      )
    })
  }

  private resetRuntimeState(): void {
    // The same Phaser scene instance is restarted when the hero returns to
    // the forest. All values tied to the previous scene clock and objects
    // must therefore be reset explicitly.
    this.enemies = []
    this.pickups = []
    this.resources = []
    this.combat.reset()
    this.enemyPlayerCollisions = 0
    this.returningToVillage = false
    this.nearestPickup = null
    this.nearestResource = null
    this.atVillageExit = false
    this.atMineEntrance = false
    this.atMountainExit = false
    this.lastPrompt = ""
    this.shieldUntil = 0
    this.shieldLastUsed = -10000
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
    this.updateNearestPickup()
    if (this.gadgetPressed()) this.useGadget(time)
    if (this.attackPressed() && this.combat.tryBeginAttack(time)) this.attack()

    if (this.interactionPressed()) {
      if (this.atMineEntrance) this.transitionTo("forest-mine", "forest-mine")
      else if (this.atMountainExit && gameStore.isMountainUnlocked()) this.transitionTo("mountain-hollow", "mountain-hollow")
      else if (this.atMountainExit) EventBus.emit(GameEvents.showMessage, "Проход запечатан. Сначала обезвредь робокабана-босса.", 2300)
      else if (this.nearestResource) this.collectSurfaceResource(this.nearestResource)
      else if (this.nearestPickup) this.collectPickup(this.nearestPickup)
      else if (this.atVillageExit) this.transitionTo("forest-village", "forest-village")
    }
  }

  private createEnemies(): void {
    const now = Date.now()
    ENEMIES.forEach((definition, index) => {
      if (definition.rank === "boss" && gameStore.state.defeatedEnemies.includes(definition.id)) return
      const remaining = Math.max(0, (gameStore.state.enemyRespawnAt[definition.id] ?? 0) - now)
      if (remaining > 0) this.scheduleRespawn(definition, index, remaining)
      else this.spawnEnemy(definition, index)
    })
    this.updateEnemyDiagnostics()
  }

  private spawnEnemy(definition: EnemyDefinition, index: number): void {
    if (this.enemies.some(({ definition: active }) => active.id === definition.id)) return
    const sprite = this.physics.add.image(definition.x, definition.y, definition.type)
    const size: readonly [number, number] =
      definition.rank === "boss"
        ? [190, 132]
        : definition.type === "robot-boar"
          ? [145, 100]
          : definition.type === "robot-wolf"
            ? [130, 92]
            : [105, 92]
    sprite.setDisplaySize(size[0], size[1]).setDepth(definition.y + 20)
    sprite.setCollideWorldBounds(true)
    this.roadCollision.track(sprite, true)
    this.combat.configureEnemyBody(sprite)
    sprite.setName(definition.id)
    const healthBack = this.add.rectangle(sprite.x, sprite.y - 72, 72, 9, 0x281916, 0.9)
    const healthFill = this.add.rectangle(sprite.x - 35, sprite.y - 72, 70, 7, definition.rank === "boss" ? 0xb94cff : COLORS.coral, 1).setOrigin(0, 0.5)
    const rankColor = definition.rank === "weak"
      ? "#d8edc6"
      : definition.rank === "normal"
        ? "#fff4cf"
        : definition.rank === "strong"
          ? "#ffb38f"
          : "#f2b5ff"
    const rankText = this.add.text(sprite.x, sprite.y - 57, ENEMY_RANK_LABELS[definition.rank], {
      fontFamily: FONT,
      fontSize: definition.rank === "boss" ? "13px" : "11px",
      fontStyle: "bold",
      color: rankColor,
      backgroundColor: "#173f38dd",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0)
    healthBack.setDepth(2000)
    healthFill.setDepth(2001)
    rankText.setDepth(2002)
    const maxHp = scaledEnemyHealth(definition, gameStore.state.difficulty)
    this.enemies.push({
      definition,
      sprite,
      hp: maxHp,
      maxHp,
      homeX: sprite.x,
      homeY: sprite.y,
      patrolAngle: index * 1.47,
      healthBack,
      healthFill,
      rankText,
    })
    this.physics.add.collider(sprite, this.obstacles)
    this.combat.addSolidEnemyCollision(this, sprite, this.player, () => {
      this.enemyPlayerCollisions += 1
    })
    this.updateEnemyDiagnostics()
  }

  private scheduleRespawn(definition: EnemyDefinition, index: number, delay: number): void {
    this.combat.scheduleRespawn(this, delay, () => this.spawnEnemy(definition, index))
  }

  private syncDifficulty(): void {
    const difficulty = gameStore.state.difficulty
    if (difficulty === this.lastDifficulty) return
    this.combat.rescaleEnemies(this.enemies, this.lastDifficulty, difficulty)
    this.lastDifficulty = difficulty
  }

  private createPickups(): void {
    LETTERS.forEach(({ id, x, y }) => {
      if (!gameStore.state.foundLetters.includes(id)) this.addPickup(id, "letter", x, y)
    })
    gameStore.state.enemyGearDrops.forEach((drop) => {
      if (!drop.collected && drop.location === "wild-forest") this.addPickup(drop.id, "gear", drop.x, drop.y)
    })
  }

  private addPickup(id: string, kind: "letter" | "gear", x: number, y: number): void {
    const glow = this.add.circle(0, 0, 28, kind === "letter" ? COLORS.cream : COLORS.yellow, 0.35)
    const icon = this.add
      .text(0, 0, kind === "letter" ? "✉️" : "⚙️", { fontFamily: FONT, fontSize: "34px" })
      .setOrigin(0.5)
    const marker = this.add.container(x, y, [glow, icon]).setDepth(y + 10)
    this.tweens.add({ targets: marker, y: y - 8, duration: 850, yoyo: true, repeat: -1 })
    this.pickups.push({ id, kind, x, y, marker })
  }

  private createVillageExit(): void {
    this.add
      .text(165, 1450, "←  ДЕРЕВНЯ", {
        fontFamily: FONT,
        fontSize: "21px",
        fontStyle: "bold",
        color: "#fff4cf",
        backgroundColor: "#173f38dd",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(1700)
  }

  private createSurfaceResources(): void {
    for (const object of this.mapObjects("wild-forest-map")) {
      const resourceId = resourceIdFromObjectType(object.type)
      if (!resourceId || !object.name) continue
      const resource = addResourceNode(this, object.name, resourceId, object.x ?? 0, object.y ?? 0)
      if (resource) this.resources.push(resource)
    }
  }

  private createMineEntrance(): void {
    const entrance = MINE_ENTRANCES[gameStore.state.mineEntranceIndex]!
    const glow = this.add.circle(entrance.x, entrance.y, 58, COLORS.yellow, 0.2).setDepth(entrance.y + 4)
    this.add.text(entrance.x, entrance.y, "⛏️", { fontFamily: FONT, fontSize: "48px" }).setOrigin(0.5).setDepth(entrance.y + 8)
    this.add.text(entrance.x, entrance.y + 62, "ШАХТА", {
      fontFamily: FONT,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#fff4cf",
      backgroundColor: "#173f38dd",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(entrance.y + 10)
    this.tweens.add({ targets: glow, alpha: 0.38, scale: 1.12, duration: 950, yoyo: true, repeat: -1 })
  }

  private createMountainPass(): void {
    const unlocked = gameStore.isMountainUnlocked()
    this.add.text(
      WILD_MOUNTAIN_PORTAL.x,
      WILD_MOUNTAIN_PORTAL.y - 78,
      unlocked ? "ГОРНАЯ ЛОЩИНА  →" : "🔒 ГОРНЫЙ ПРОХОД",
      {
        fontFamily: FONT,
        fontSize: "18px",
        fontStyle: "bold",
        color: unlocked ? "#fff4cf" : "#ffb38f",
        backgroundColor: "#173f38dd",
        padding: { x: 11, y: 6 },
      },
    ).setOrigin(0.5).setDepth(1800)
  }

  private updateEnemies(time: number, delta: number): void {
    const deltaSeconds = delta / 1000
    const activeArea = Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(this.cameras.main.worldView), 320, 260)
    this.enemies.forEach((enemy) => {
      if (!enemy.sprite.active) return
      if (!activeArea.contains(enemy.sprite.x, enemy.sprite.y)) {
        enemy.sprite.setVelocity(0, 0)
        return
      }
      this.roadCollision.constrain(enemy.sprite)
      if (this.combat.isEnemyRecoiling(enemy)) {
        enemy.sprite.setDepth(enemy.sprite.y + 20)
        enemy.healthFill.setPosition(enemy.sprite.x - 35, enemy.sprite.y - 72)
        enemy.healthBack.setPosition(enemy.sprite.x, enemy.sprite.y - 72)
        enemy.rankText.setPosition(enemy.sprite.x, enemy.sprite.y - 57)
        return
      }
      const playerDx = this.player.x - enemy.sprite.x
      const playerDy = this.player.y - enemy.sprite.y
      const distanceSquared = playerDx * playerDx + playerDy * playerDy
      let targetX: number
      let targetY: number
      let speed: number
      if (distanceSquared < 136900) {
        targetX = this.player.x
        targetY = this.player.y
        const boarBurst = enemy.definition.type === "robot-boar" && time % 1800 < 450
        speed = enemy.definition.speed * (boarBurst ? 2.15 : 1)
      } else {
        enemy.patrolAngle += deltaSeconds * (0.42 + enemy.definition.speed / 500)
        targetX = enemy.homeX + Math.cos(enemy.patrolAngle) * 115
        targetY = enemy.homeY + Math.sin(enemy.patrolAngle * 0.83) * 95
        speed = enemy.definition.speed * 0.48
      }
      const dx = targetX - enemy.sprite.x
      const dy = targetY - enemy.sprite.y
      const lengthSquared = dx * dx + dy * dy
      const inverseLength = lengthSquared > 1 ? 1 / Math.sqrt(lengthSquared) : 0
      const directionX = dx * inverseLength
      const directionY = dy * inverseLength
      enemy.sprite.setVelocity(directionX * speed, directionY * speed)
      actorFor(enemy.sprite)?.face(directionX, directionY)
      enemy.sprite.setDepth(enemy.sprite.y + 20)
      enemy.healthFill.setPosition(enemy.sprite.x - 35, enemy.sprite.y - 72)
      enemy.healthBack.setPosition(enemy.sprite.x, enemy.sprite.y - 72)
      enemy.rankText.setPosition(enemy.sprite.x, enemy.sprite.y - 57)

      if (
        distanceSquared < 5184 &&
        this.combat.canDamagePlayer(time)
      ) {
        // Contact damage was immediate before animation; begin at its impact pose.
        actorFor(enemy.sprite)?.play("attack", { duration: 450, impactAt: 0, onImpact: () => {
          if (enemy.sprite.active && !this.returningToVillage && Phaser.Math.Distance.Squared(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y) < 5184) {
            this.damagePlayer(enemy, this.combat.now)
          }
        } })
      }
    })
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) {
      status.dataset.enemyPlayerCollisions = String(this.enemyPlayerCollisions)
      status.dataset.enemyPlayerOverlap = String(this.combat.bodiesOverlap(this.player, this.enemies))
      status.dataset.enemyPositions = this.enemies
        .map(({ definition, sprite }) => `${definition.id}:${Math.round(sprite.x)}:${Math.round(sprite.y)}`)
        .join(",")
    }
  }

  private damagePlayer(enemy: RuntimeEnemy, time: number): void {
    const result = this.combat.damagePlayer(
      this,
      this.player,
      enemy.definition.damage,
      enemy.sprite.x,
      enemy.sprite.y,
      time,
      time < this.shieldUntil,
    )
    if (result === "ignored") return
    if (result === "shielded") {
      this.shieldUntil = 0
      this.player.clearTint()
      EventBus.emit(GameEvents.showMessage, "Импульсный щит отразил удар робозверя!", 1800)
      return
    }
    if (result !== "knocked-out") return

    this.returningToVillage = true
    EventBus.emit(GameEvents.showMessage, "Силы закончились. Жители помогли тебе вернуться в деревню.", 2600)
    this.cameras.main.shake(250, 0.012)
    this.time.delayedCall(700, () => this.scene.start("forest-village"))
  }

  private useGadget(time: number): void {
    const equipped = gameStore.state.equippedGadget
    if (equipped !== "pulse-shield") {
      EventBus.emit(GameEvents.showMessage, "Здесь для активного гаджета нет подходящей цели.", 2000)
      return
    }
    const gadget = GADGETS[equipped]
    if (time - this.shieldLastUsed < gadget.cooldownMs) {
      const seconds = Math.ceil((gadget.cooldownMs - (time - this.shieldLastUsed)) / 1000)
      EventBus.emit(GameEvents.showMessage, `Щит перезаряжается: ${seconds} сек.`, 1400)
      return
    }
    this.shieldLastUsed = time
    this.shieldUntil = time + gadget.durationMs
    actorFor(this.player)?.play("gadget", { duration: 350 })
    this.player.setTint(0x6cc7ff)
    this.time.delayedCall(gadget.durationMs, () => {
      if (this.combat.now >= this.shieldUntil) this.player?.clearTint()
    })
    EventBus.emit(GameEvents.showMessage, "Щит активен и заблокирует следующий удар.", 1700)
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

    this.meleeAttack(calculateAttackDamage(character.stats.strength))
  }

  private meleeAttack(damage: number): void {
    const centerX = this.player.x + this.lastDirection.x * 72
    const centerY = this.player.y + this.lastDirection.y * 72
    const arc = this.add.arc(
      centerX,
      centerY,
      75,
      Phaser.Math.RadToDeg(this.lastDirection.angle()) - 58,
      Phaser.Math.RadToDeg(this.lastDirection.angle()) + 58,
      false,
      COLORS.yellow,
      0.42,
    )
    arc.setDepth(2200)
    this.tweens.add({ targets: arc, alpha: 0, scale: 1.18, duration: 180, onComplete: () => arc.destroy() })

    const target = this.findAttackTarget(155, -0.05)
    if (target) this.hitEnemy(target, damage)
  }

  private throwProduce(expected: ProduceId): void {
    const produceId = gameStore.consumeProduceShot()
    if (!produceId) {
      EventBus.emit(GameEvents.showMessage, "Метательные овощи закончились. Выбрано основное оружие.", 1800)
      return
    }
    const produce = PRODUCE[produceId]
    const target = this.findAttackTarget(430, 0.55)
    const targetX = target?.sprite.x ?? this.player.x + this.lastDirection.x * 380
    const targetY = target?.sprite.y ?? this.player.y + this.lastDirection.y * 380
    const projectile = this.add
      .text(this.player.x, this.player.y - 15, produce.icon, {
        fontFamily: FONT,
        fontSize: produceId === "cucumber" ? "34px" : "31px",
      })
      .setOrigin(0.5)
      .setDepth(2300)
    this.tweens.add({
      targets: projectile,
      x: targetX,
      y: targetY,
      angle: produceId === "cucumber" ? 720 : 450,
      duration: 280,
      ease: "Quad.easeOut",
      onComplete: () => {
        projectile.destroy()
        if (target?.sprite.active) this.hitEnemy(target, produce.damage, 12)
      },
    })
    if (produceId !== expected) {
      EventBus.emit(GameEvents.showMessage, "Оружие переключилось — бросок отменён.", 1300)
    }
  }

  private findAttackTarget(maxDistance: number, minimumDot: number): RuntimeEnemy | null {
    let target: RuntimeEnemy | null = null
    let nearest = Number.POSITIVE_INFINITY
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue
      const offsetX = enemy.sprite.x - this.player.x
      const offsetY = enemy.sprite.y - this.player.y
      const distance = Math.hypot(offsetX, offsetY)
      if (distance > maxDistance) continue
      const dot = (offsetX / (distance || 1)) * this.lastDirection.x +
        (offsetY / (distance || 1)) * this.lastDirection.y
      if (dot < minimumDot || distance >= nearest) continue
      nearest = distance
      target = enemy
    }
    return target
  }

  private handleDebugDamageEnemy(id: string, damage: number): void {
    const enemy = this.enemies.find(({ definition }) => definition.id === id)
    if (enemy && Number.isFinite(damage) && damage > 0) this.hitEnemy(enemy, damage, 0)
  }

  private hitEnemy(enemy: RuntimeEnemy, damage: number, knockback = 28): void {
    if (!this.combat.hitEnemy(this, enemy, damage, this.lastDirection, 70, knockback)) return

    const x = enemy.sprite.x
    const y = enemy.sprite.y
    const { firstDefeat, drop: gearDrop } = this.combat.recordDefeat(enemy, x, y)
    this.combat.destroyEnemy(enemy)
    this.enemies = this.enemies.filter((active) => active !== enemy)
    if (gearDrop) this.addPickup(gearDrop.id, "gear", x, y)
    if (enemy.definition.respawnMs == null) {
      EventBus.emit(GameEvents.showMessage, "🏆 Босс обезврежен навсегда! Подбери выпавшую шестерёнку.", 3200)
    } else {
      const seconds = enemy.definition.respawnMs / 1000
      EventBus.emit(
        GameEvents.showMessage,
        firstDefeat
          ? `⚙️ Робозверь обезврежен! Он восстановится через ${seconds} сек. Подбери шестерёнку.`
          : `⚙️ Возрождённый робозверь обезврежен. Он оставил новую шестерёнку и вернётся через ${seconds} сек.`,
        3000,
      )
      const index = ENEMIES.findIndex(({ id }) => id === enemy.definition.id)
      this.scheduleRespawn(enemy.definition, index, enemy.definition.respawnMs)
    }
    this.updateEnemyDiagnostics()
    updateGameStatus(
      "wild-forest",
      `Дикий лес. Всего обезврежено робозверей: ${gameStore.state.wildForestEnemyDefeats}.`,
    )
  }

  private updateNearestPickup(): void {
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
    this.atVillageExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, 165, 1420) < 150
    const mineEntrance = MINE_ENTRANCES[gameStore.state.mineEntranceIndex]!
    this.atMineEntrance = Phaser.Math.Distance.Between(this.player.x, this.player.y, mineEntrance.x, mineEntrance.y) < 125
    this.atMountainExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, WILD_MOUNTAIN_PORTAL.x, WILD_MOUNTAIN_PORTAL.y) < 145
    let prompt = ""
    const pickup = this.nearestPickup
    if (this.atMineEntrance) prompt = "E — войти в шахту"
    else if (this.atMountainExit) prompt = gameStore.isMountainUnlocked() ? "E — войти в Горную Лощину" : "E — осмотреть запечатанный проход"
    else if (this.nearestResource) prompt = resourcePrompt(this.nearestResource.resourceId)
    else if (pickup) prompt = pickup.kind === "letter" ? "E — подобрать письмо" : "E — подобрать шестерёнку"
    else if (this.atVillageExit) prompt = "E — вернуться в деревню"
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private collectSurfaceResource(resource: RuntimeResourceNode): void {
    if (!collectResourceNode(resource)) return
    this.resources = this.resources.filter((candidate) => candidate !== resource)
    const definition = RESOURCES[resource.resourceId]
    EventBus.emit(
      GameEvents.showMessage,
      resource.resourceId === "scrap"
        ? `${definition.icon} Хлам разобран: найдено ⚙️ 10.`
        : `${definition.icon} ${definition.name} убран в рюкзак.`,
      2200,
    )
  }

  private collectPickup(pickup: Pickup): void {
    const gearDrop = pickup.kind === "gear"
      ? gameStore.state.enemyGearDrops.find(({ id }) => id === pickup.id)
      : null
    const collected = pickup.kind === "letter" ? gameStore.collectLetter(pickup.id) : gameStore.collectEnemyGearDrop(pickup.id)
    if (!collected) return
    pickup.marker.destroy(true)
    this.pickups = this.pickups.filter((candidate) => candidate !== pickup)
    EventBus.emit(
      GameEvents.showMessage,
      pickup.kind === "letter"
        ? "✉️ Найдено потерянное письмо!"
        : gearDrop?.containsPart
          ? "⚙️ Шестерёнка и полезная деталь убраны в рюкзак."
          : "⚙️ Шестерёнка убрана в рюкзак.",
      2400,
    )
  }

  private updateEnemyDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.activeEnemies = String(this.enemies.length)
    status.dataset.enemyRanks = ENEMIES.map(({ id, rank }) => `${id}:${rank}`).join(",")
  }
}
