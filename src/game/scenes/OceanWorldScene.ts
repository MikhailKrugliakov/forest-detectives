import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { gameStore } from "../../domain/GameStore"
import { scaledEnemyHealth } from "../../domain/difficulty"
import { GADGETS } from "../../domain/gadgets"
import { PRODUCE } from "../../domain/produce"
import { calculateAttackDamage } from "../../domain/rules"
import { BEACH_SCRAP, ICHTHYOSAUR_ID, MEDUSA_SCHOOLS, OCEAN_ENEMIES, OCEAN_LOCATION_NAMES, TIGER_SHARK_ID, type OceanLocationId } from "../../domain/ocean"
import type { DifficultyId, EnemyDefinition, LocationId } from "../../domain/types"
import { CombatController, type CombatEnemyRuntime } from "../CombatController"
import { actorFor } from "../animation/AnimatedActor"
import { EventBus, GameEvents } from "../EventBus"
import { OCEAN_ARENA, OCEAN_ENTRY, OCEAN_EXIT, OCEAN_MECHANISM, OCEAN_ROADS } from "../data/oceanLayout"
import { RoadCollisionController } from "../RoadCollisionController"
import { COLORS, FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"

interface OceanEnemy extends CombatEnemyRuntime {
  nextAttackAt: number
  homeX: number
  homeY: number
  index: number
  slamAt: number
  warning?: Phaser.GameObjects.Graphics
}
interface Pickup { id: string; x: number; y: number; marker: Phaser.GameObjects.Container; scrap: boolean }
interface Portal { x: number; y: number; location: LocationId; label: string }
type BossStage = "dash-warning" | "dash" | "tail-warning" | "ring-warning" | "ring" | "dive-warning" | "whirl-warning" | "whirl" | "recover"
interface BossAttack {
  enemy: OceanEnemy
  stage: BossStage
  start: number
  end: number
  x: number
  y: number
  angle: number
  remaining: number
  previousRadius: number
  graphics: Phaser.GameObjects.Graphics
}
const CREATURE_KEYS = ["robot-crab", "predatory-fish", "jellyfish", "spiny-fish", "tiger-shark", "ichthyosaur"]
const ENEMY_LABELS: Record<string, string> = { "robot-crab": "Робокраб", "beach-albatross": "Робоальбатрос", "predatory-fish": "Хищная рыба", jellyfish: "Медуза", "spiny-fish": "Колючая древняя рыба", "tiger-shark": "Тигровая акула", ichthyosaur: "Ихтиозавр" }
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** A single continuous panorama and road network per location avoid tile seams and collider joins. */
export class OceanWorldScene extends BaseWorldScene {
  private enemies: OceanEnemy[] = []
  private pickups: Pickup[] = []
  private portals: Portal[] = []
  private road!: RoadCollisionController
  private readonly combat = new CombatController()
  private lastDifficulty: DifficultyId = "hard"
  private bossAttack: BossAttack | null = null
  private bossAttackIndex = 0
  private nearest: Pickup | Portal | "mechanism" | null = null
  private lastPrompt = ""
  private leaving = false
  private shieldUntil = 0
  private shieldUsedAt = -10000
  private nextSchoolRefresh = 0
  private nextBubbleAt = 0
  private schoolPauseAt = 0
  private mechanism?: Phaser.GameObjects.Container
  private scuba?: Phaser.GameObjects.Container
  private scubaMask?: Phaser.GameObjects.Graphics
  private scubaHose?: Phaser.GameObjects.Graphics

  constructor(private readonly locationId: OceanLocationId) { super(locationId) }

  preload(): void {
    const key = `ocean-${this.locationId}-bg`
    if (!this.textures.exists(key)) this.load.image(key, `assets/ocean/${this.locationId}-panorama.png`)
    for (const creature of CREATURE_KEYS) if (!this.textures.exists(creature)) this.load.image(creature, `assets/ocean/${creature}.png`)
    if (!this.textures.exists("robot-albatross")) this.load.image("robot-albatross", "assets/enemies/robot-albatross.png")
  }

  create(): void {
    if (!gameStore.state.character) { this.scene.start("main-menu"); return }
    if (!gameStore.canEnterOceanLocation(this.locationId)) { this.scene.start("forest-village"); return }
    const from = gameStore.state.entryFrom
    gameStore.setLocation(this.locationId)
    if (this.locationId === "beach") gameStore.visitBeach()
    this.enemies = []; this.pickups = []; this.portals = []; this.nearest = null; this.bossAttack = null
    this.bossAttackIndex = 0; this.lastPrompt = ""; this.leaving = false; this.shieldUntil = 0
    this.shieldUsedAt = -10000; this.nextSchoolRefresh = 0; this.nextBubbleAt = 0; this.scuba = undefined; this.mechanism = undefined
    this.schoolPauseAt = 0
    this.combat.reset()
    this.lastDifficulty = gameStore.state.difficulty
    this.cameras.main.setBackgroundColor(this.locationId === "beach" ? "#b7dce2" : "#0b334d")
    this.add.image(2400, 800, `ocean-${this.locationId}-bg`).setDisplaySize(4800, 1600).setDepth(0)
    this.paintPassages()
    const returning = this.locationId === "beach" && from === "sea" || this.locationId === "sea" && from === "trench"
    const spawn = returning ? OCEAN_EXIT : OCEAN_ENTRY
    const character = gameStore.state.character
    this.setupWorld(character, 4800, 1600, spawn.x, spawn.y, character.id === "watermelon" ? 96 : 102, character.id === "watermelon" ? 112 : 140)
    this.road = new RoadCollisionController(OCEAN_ROADS[this.locationId])
    this.road.track(this.player, true)
    this.prepareCreatureFrames()
    this.createPortals()
    gameStore.refreshMedusaSchools(Date.now())
    for (const [index, definition] of OCEAN_ENEMIES.filter((enemy) => enemy.location === this.locationId).entries()) {
      if (definition.type === "jellyfish" && gameStore.isMedusaDefeated(definition.id)) continue
      if (definition.respawnMs === null && definition.type !== "jellyfish" && gameStore.state.defeatedEnemies.includes(definition.id)) continue
      const delay = Math.max(0, (gameStore.state.enemyRespawnAt[definition.id] ?? 0) - Date.now())
      if (delay > 0 && definition.type !== "jellyfish") this.combat.scheduleRespawn(this, delay, () => this.spawnEnemy(definition, index))
      else this.spawnEnemy(definition, index)
    }
    for (const drop of gameStore.state.enemyGearDrops) if (!drop.collected && drop.location === this.locationId) this.addPickup(drop.id, drop.x, drop.y, false)
    if (this.locationId === "beach") for (const scrap of BEACH_SCRAP) {
      if (!gameStore.state.rewardedGearSources.includes(`beach-scrap:${scrap.id}`)) this.addPickup(scrap.id, scrap.x, scrap.y, true)
    }
    if (this.locationId === "trench") this.createMechanism()
    if (this.locationId !== "beach") this.createScuba()
    this.combat.arm(0)
    EventBus.on("debug-damage-enemy", this.debugDamage, this)
    EventBus.on("modal-state", this.onOceanModal, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off("debug-damage-enemy", this.debugDamage, this)
      EventBus.off("modal-state", this.onOceanModal, this)
      this.clearHazards()
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.positionScuba, this)
      EventBus.emit(GameEvents.promptChanged, "")
    })
    updateGameStatus(this.locationId, OCEAN_LOCATION_NAMES[this.locationId])
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.cameras.main.fadeIn(300, 15, 70, 90)
    EventBus.emit(GameEvents.showMessage, this.locationId === "beach" ? gameStore.state.ocean.returnToMole ? "Задание: Вернуться к кроту. У тебя хватает шестерёнок на акваланг!" : "Найди 40 шестерёнок для акваланга. Роботы и два скопления хлама помогут собрать их." : this.locationId === "sea" ? "Медузы мирные, пока ты не коснёшься их. В конце моря — Тигровая акула." : "Приливный механизм охраняет Ихтиозавр. Следи за предупреждениями его атак.", 4000)
    this.updateDiagnostics()
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body || this.leaving) return
    this.updateWorldInput(Math.min(delta, 50))
    const time = this.combat.advance(delta, this.modalOpen)
    this.road.constrain(this.player)
    if (this.modalOpen) { for (const enemy of this.enemies) enemy.sprite.setVelocity(0, 0); return }
    if (this.lastDifficulty !== gameStore.state.difficulty) {
      this.combat.rescaleEnemies(this.enemies, this.lastDifficulty, gameStore.state.difficulty)
      this.lastDifficulty = gameStore.state.difficulty
    }
    if (time >= this.nextSchoolRefresh) { this.refreshSchools(); this.nextSchoolRefresh = time + 1000 }
    this.updateEnemies(time)
    if (this.leaving) return
    this.updateBossAttack(time)
    if (this.leaving) return
    this.updateSwimming(time)
    this.updateNearest()
    if (this.gadgetPressed()) this.useGadget(time)
    if (this.attackPressed() && this.combat.tryBeginAttack(time)) this.attack()
    if (this.interactionPressed()) this.interact()
    this.updateDiagnostics()
  }

  private paintPassages(): void {
    // A translucent seabed path is drawn from the exact traversable geometry.
    const graphics = this.add.graphics().setDepth(1)
    const color = this.locationId === "beach" ? 0xefdbac : this.locationId === "sea" ? 0x93c8bd : 0x49788d
    for (const segment of OCEAN_ROADS[this.locationId].segments) {
      graphics.lineStyle(segment.halfWidth * 2 - 20, color, this.locationId === "beach" ? 0.12 : 0.13)
      graphics.lineBetween(segment.from.x, segment.from.y, segment.to.x, segment.to.y)
      graphics.fillStyle(color, 0.08).fillCircle(segment.to.x, segment.to.y, segment.halfWidth - 10)
    }
    graphics.fillStyle(color, 0.07).fillCircle(4200, 800, 590)
  }

  private prepareCreatureFrames(): void {
    for (const key of CREATURE_KEYS) {
      const texture = this.textures.get(key)
      const image = texture.getSourceImage() as HTMLImageElement
      const count = image.width / image.height >= 3 ? 4 : 1
      for (let frame = 0; frame < count; frame++) if (!texture.has(`ocean-${frame}`)) texture.add(`ocean-${frame}`, 0, frame * image.width / count, 0, image.width / count, image.height)
    }
  }

  private createPortals(): void {
    const left: Portal = { ...OCEAN_ENTRY, location: this.locationId === "beach" ? "forest-village" : this.locationId === "sea" ? "beach" : "sea", label: this.locationId === "beach" ? "← ДЕРЕВНЯ" : this.locationId === "sea" ? "← ПЛЯЖ" : "← МОРЕ" }
    this.portals.push(left)
    if (this.locationId !== "trench") this.portals.push({ ...OCEAN_EXIT, location: this.locationId === "beach" ? "sea" : "trench", label: this.locationId === "beach" ? "ПОГРУЗИТЬСЯ В МОРЕ →" : "ВПАДИНА →" })
    for (const portal of this.portals) this.add.text(portal.x, portal.y - 130, portal.label, { fontFamily: FONT, fontSize: "19px", fontStyle: "bold", color: "#fff9db", backgroundColor: "#173c53df", padding: { x: 10, y: 6 } }).setOrigin(0.5).setDepth(2300)
  }

  private spawnEnemy(definition: EnemyDefinition, index: number): void {
    if (this.leaving || this.enemies.some((enemy) => enemy.definition.id === definition.id)) return
    if (definition.rank === "boss" && gameStore.state.defeatedEnemies.includes(definition.id)) return
    if (definition.type === "jellyfish" && gameStore.isMedusaDefeated(definition.id)) return
    const key = definition.type === "beach-albatross" ? "robot-albatross" : definition.assetKey
    const frame = CREATURE_KEYS.includes(key) ? "ocean-0" : undefined
    const sprite = this.physics.add.image(definition.x, definition.y, key, frame)
    const size = definition.rank === "boss" ? (definition.id === ICHTHYOSAUR_ID ? [300, 210] : [260, 175]) : definition.type === "jellyfish" ? [105, 120] : definition.type === "robot-crab" ? [130, 100] : [145, 112]
    sprite.setDisplaySize(size[0]!, size[1]!).setCollideWorldBounds(true).setName(definition.id).setDepth(sprite.y + 20)
    this.combat.configureEnemyBody(sprite)
    this.road.track(sprite, true)
    const width = definition.rank === "boss" ? 170 : 76
    const healthBack = this.add.rectangle(sprite.x, sprite.y - 95, width + 2, 11, 0x15344b, 0.9).setDepth(2900)
    const healthFill = this.add.rectangle(sprite.x - width / 2, sprite.y - 95, width, 8, COLORS.coral).setOrigin(0, 0.5).setDepth(2901)
    const rankText = this.add.text(sprite.x, sprite.y - 83, ENEMY_LABELS[definition.type] ?? definition.type, { fontFamily: FONT, fontSize: definition.rank === "boss" ? "17px" : "12px", color: "#fff3d7", backgroundColor: "#15344bc9", padding: { x: 4, y: 2 } }).setOrigin(0.5, 0).setDepth(2902)
    const maxHp = scaledEnemyHealth(definition, gameStore.state.difficulty)
    this.enemies.push({ definition, sprite, hp: maxHp, maxHp, healthBack, healthFill, rankText, homeX: sprite.x, homeY: sprite.y, index, nextAttackAt: this.combat.now + 1600 + index * 90, slamAt: 0 })
  }

  private schoolAggressive(enemy: OceanEnemy): boolean {
    const school = MEDUSA_SCHOOLS.find((group) => group.enemyIds.includes(enemy.definition.id))
    return school ? Boolean(gameStore.state.ocean.schools[school.id]?.aggressive) : false
  }

  private updateEnemies(time: number): void {
    for (const enemy of this.enemies) {
      if (this.leaving) return
      if (!enemy.sprite.active) continue
      this.road.constrain(enemy.sprite)
      const separation = distance(enemy.sprite, this.player)
      const actor = actorFor(enemy.sprite)
      if (CREATURE_KEYS.includes(enemy.definition.assetKey) && actor) {
        const texture = this.textures.get(enemy.definition.assetKey)
        const moving = enemy.sprite.body!.velocity.lengthSq() > 25
        const acting = actor.isPlaying && ["attack", "windup", "cast"].includes(actor.currentAction)
        const frame = texture.has("ocean-3") ? acting ? 2 : moving ? Math.floor(time / 190 + enemy.index) % 2 === 0 ? 1 : 3 : 0 : 0
        actor.visual.setFrame(`ocean-${frame}`).setFlipX(enemy.sprite.body!.velocity.x < -1)
      }
      this.positionEnemyUi(enemy)
      if (enemy.definition.rank === "boss") { this.updateBoss(enemy, time, separation); continue }
      if (enemy.definition.type === "jellyfish" && !this.schoolAggressive(enemy) && this.combat.bodiesOverlap(this.player, [enemy])) gameStore.provokeMedusaSchool(enemy.definition.id)
      const passive = enemy.definition.type === "jellyfish" && !this.schoolAggressive(enemy)
      enemy.rankText.setText(passive ? "Мирная медуза" : ENEMY_LABELS[enemy.definition.type] ?? enemy.definition.type)
      enemy.healthFill.setFillStyle(passive ? 0x84e5c4 : COLORS.coral)
      if (this.combat.isEnemyRecoiling(enemy)) continue
      if (enemy.slamAt) {
        enemy.sprite.setVelocity(0, 0)
        if (time >= enemy.slamAt) {
          enemy.warning?.destroy(); enemy.warning = undefined; enemy.slamAt = 0
          if (separation < (enemy.definition.type === "spiny-fish" ? 125 : 95)) this.damagePlayer(enemy.definition.damage, enemy.sprite.x, enemy.sprite.y)
          enemy.nextAttackAt = time + 1500
        }
        continue
      }
      // Ordinary wildlife never follows the player into a boss arena.
      const canChase = !passive && separation < 520 && this.player.x < 3620 && enemy.sprite.x < 3640
      if (canChase && separation > 72) this.moveToward(enemy, this.player.x, this.player.y, enemy.definition.speed)
      else if (canChase) {
        enemy.sprite.setVelocity(0, 0)
        if (time >= enemy.nextAttackAt) {
          if (enemy.definition.type === "spiny-fish") {
            enemy.slamAt = time + 650
            enemy.warning = this.add.graphics().setDepth(2400).fillStyle(0xff9a62, 0.2).lineStyle(3, 0xffcb86, 0.9).fillCircle(enemy.sprite.x, enemy.sprite.y, 125).strokeCircle(enemy.sprite.x, enemy.sprite.y, 125)
            actor?.play("windup", { duration: 800 })
          } else {
            enemy.slamAt = time + 450
            enemy.warning = this.add.graphics().setDepth(2400).lineStyle(2, 0xffdd9b, 0.8).strokeCircle(enemy.sprite.x, enemy.sprite.y, 95)
            actor?.play("attack", { duration: 650, impactAt: 450 })
          }
        }
      } else {
        const homeDistance = Math.hypot(enemy.homeX - enemy.sprite.x, enemy.homeY - enemy.sprite.y)
        if (homeDistance > 100) this.moveToward(enemy, enemy.homeX, enemy.homeY, enemy.definition.speed * 0.55)
        else {
          const angle = time / 1900 + enemy.index * 2
          enemy.sprite.setVelocity(Math.cos(angle) * 15, Math.sin(angle * 0.7) * 11)
        }
      }
    }
  }

  private moveToward(enemy: OceanEnemy, x: number, y: number, speed: number): void {
    const length = Math.hypot(x - enemy.sprite.x, y - enemy.sprite.y) || 1
    enemy.sprite.setVelocity((x - enemy.sprite.x) / length * speed, (y - enemy.sprite.y) / length * speed)
    actorFor(enemy.sprite)?.face(x - enemy.sprite.x, y - enemy.sprite.y)
  }

  private updateBoss(enemy: OceanEnemy, time: number, separation: number): void {
    if (this.player.x < 3540 || separation > 1050) {
      if (this.bossAttack?.enemy === enemy) this.clearBossAttack()
      enemy.sprite.setAlpha(1).setVelocity(0, 0)
      enemy.nextAttackAt = time + 1000
      return
    }
    if (this.bossAttack) return
    enemy.sprite.setVelocity(0, 0)
    if (time < enemy.nextAttackAt) return
    const shark = enemy.definition.id === TIGER_SHARK_ID
    const phase = this.bossPhase(enemy)
    const sequence = shark ? ["dash-warning", "tail-warning"] : phase === 1 ? ["ring-warning", "dive-warning"] : ["ring-warning", "dive-warning", "whirl-warning"]
    const stage = sequence[this.bossAttackIndex++ % sequence.length] as BossStage
    // Tail only starts within its meaningful range; a distant shark closes with a dash.
    this.beginBossAttack(enemy, stage === "tail-warning" && separation > 220 ? "dash-warning" : stage, time, shark && phase === 2 ? 2 : stage === "dive-warning" ? 3 : 1)
  }

  private bossPhase(enemy: OceanEnemy): number {
    const ratio = enemy.hp / enemy.maxHp
    return enemy.definition.id === TIGER_SHARK_ID ? ratio > 0.5 ? 1 : 2 : ratio > 2 / 3 ? 1 : ratio > 1 / 3 ? 2 : 3
  }

  private beginBossAttack(enemy: OceanEnemy, stage: BossStage, time: number, remaining: number): void {
    if (this.leaving || !enemy.sprite.active) return
    const graphics = this.add.graphics().setDepth(2400)
    this.bossAttack = { enemy, stage, start: time, end: time, x: enemy.sprite.x, y: enemy.sprite.y, angle: 0, remaining, previousRadius: 0, graphics }
    this.setBossStage(stage, time)
  }

  private setBossStage(stage: BossStage, time: number): void {
    const attack = this.bossAttack
    if (!attack || this.leaving || !attack.enemy.sprite.active) return
    attack.stage = stage; attack.start = time; attack.graphics.clear()
    const enemy = attack.enemy
    enemy.sprite.setVelocity(0, 0).setAlpha(stage === "dive-warning" ? 0.18 : 1)
    const durations: Record<BossStage, number> = { "dash-warning": 800, dash: 580, "tail-warning": 800, "ring-warning": 900, ring: 1300, "dive-warning": 800, "whirl-warning": 1000, whirl: 2500, recover: enemy.definition.id === ICHTHYOSAUR_ID ? 1500 : 1100 }
    attack.end = time + durations[stage]
    if (stage.endsWith("warning")) {
      attack.x = enemy.sprite.x; attack.y = enemy.sprite.y
      attack.angle = Phaser.Math.Angle.Between(attack.x, attack.y, this.player.x, this.player.y)
      if (stage === "ring-warning") attack.angle += 0.45 // A reachable escape sector near the hero, visibly shown before the wave.
      if (stage === "dive-warning" || stage === "whirl-warning") {
        attack.x = Phaser.Math.Clamp(this.player.x, OCEAN_ARENA.left, OCEAN_ARENA.right)
        attack.y = Phaser.Math.Clamp(this.player.y, OCEAN_ARENA.top, OCEAN_ARENA.bottom)
      }
      actorFor(enemy.sprite)?.play("windup", { duration: durations[stage] })
      const text = stage === "dash-warning" ? "Акула готовит рывок — уйди с полосы!" : stage === "tail-warning" ? "Удар хвостом — выйди из дуги!" : stage === "ring-warning" ? "Звуковое кольцо — укройся в зелёном секторе!" : stage === "dive-warning" ? "Ихтиозавр всплывает в отмеченной точке!" : "Водоворот — держись подальше от центра!"
      EventBus.emit(GameEvents.showMessage, text, 1300)
    }
  }

  private updateBossAttack(time: number): void {
    const attack = this.bossAttack
    if (!attack) return
    const { enemy, graphics } = attack
    if (!enemy.sprite.active || this.leaving) { this.clearBossAttack(); return }
    const elapsed = time - attack.start
    graphics.clear()
    if (attack.stage === "dash-warning" || attack.stage === "dash") {
      const endX = attack.x + Math.cos(attack.angle) * 520, endY = attack.y + Math.sin(attack.angle) * 520
      graphics.lineStyle(105, 0xff986a, attack.stage === "dash-warning" ? 0.23 : 0.13).lineBetween(attack.x, attack.y, endX, endY)
      graphics.lineStyle(3, 0xffdf95, 0.8).lineBetween(attack.x, attack.y, endX, endY)
      if (attack.stage === "dash") {
        const x = enemy.sprite.x, y = enemy.sprite.y
        const vx = Math.cos(attack.angle) * 760, vy = Math.sin(attack.angle) * 760
        enemy.sprite.setVelocity(x < OCEAN_ARENA.left && vx < 0 || x > OCEAN_ARENA.right && vx > 0 ? 0 : vx, y < OCEAN_ARENA.top && vy < 0 || y > OCEAN_ARENA.bottom && vy > 0 ? 0 : vy)
        if (distance(enemy.sprite, this.player) < 108) this.damagePlayer(32, enemy.sprite.x, enemy.sprite.y)
      }
    } else if (attack.stage === "tail-warning") {
      this.drawSector(graphics, attack.x, attack.y, 205, attack.angle - 1.15, attack.angle + 1.15, 0xff946e, 0.26)
    } else if (attack.stage === "ring-warning" || attack.stage === "ring") {
      const radius = attack.stage === "ring-warning" ? 230 : 45 + Math.min(1, elapsed / 1300) * 650
      // The same 90-degree gap stays fixed during warning and wave expansion.
      this.drawSector(graphics, attack.x, attack.y, 570, attack.angle - Math.PI / 4, attack.angle + Math.PI / 4, 0x79edb6, 0.12)
      graphics.lineStyle(attack.stage === "ring" ? 25 : 5, 0xa4efff, 0.85).beginPath().arc(attack.x, attack.y, radius, attack.angle + Math.PI / 4, attack.angle + Math.PI * 7 / 4, false).strokePath()
      if (attack.stage === "ring") {
        const dx = this.player.x - attack.x, dy = this.player.y - attack.y
        const angle = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - attack.angle))
        const separation = Math.hypot(dx, dy)
        if (separation >= attack.previousRadius - 35 && separation <= radius + 35 && angle > Math.PI / 4) this.damagePlayer(28, attack.x, attack.y)
        attack.previousRadius = radius
      }
    } else if (attack.stage === "dive-warning") {
      graphics.fillStyle(0xff9279, 0.21).fillCircle(attack.x, attack.y, 115)
      graphics.lineStyle(4, 0xffd09a, 0.9).strokeCircle(attack.x, attack.y, 115)
      graphics.lineBetween(attack.x - 22, attack.y, attack.x + 22, attack.y).lineBetween(attack.x, attack.y - 22, attack.x, attack.y + 22)
    } else if (attack.stage === "whirl-warning" || attack.stage === "whirl") {
      graphics.fillStyle(0x53d5e6, 0.18).fillCircle(attack.x, attack.y, 220).lineStyle(4, 0x9deafa, 0.85).strokeCircle(attack.x, attack.y, 220)
      graphics.fillStyle(0xffae78, 0.25).fillCircle(attack.x, attack.y, 65)
      if (attack.stage === "whirl") {
        for (let ring = 0; ring < 4; ring++) graphics.lineStyle(4, 0xd1f8ff, 0.45).beginPath().arc(attack.x, attack.y, 65 + ring * 43, elapsed / 160 + ring, elapsed / 160 + ring + 2.4, false).strokePath()
        const dist = distance(attack, this.player)
        if (dist < 220 && dist > 1) {
          const body = this.player.body as Phaser.Physics.Arcade.Body
          // Add current movement to a weaker inward current: every hero can swim out.
          body.velocity.x += (attack.x - this.player.x) / dist * 105
          body.velocity.y += (attack.y - this.player.y) / dist * 105
          if (dist < 65) this.damagePlayer(20, attack.x, attack.y)
        }
      }
    }
    // A lethal hit synchronously clears the active attack and starts departure.
    if (this.leaving || this.bossAttack !== attack || time < attack.end) return
    if (attack.stage === "dash-warning") this.setBossStage("dash", time)
    else if (attack.stage === "dash" && --attack.remaining > 0) this.setBossStage("dash-warning", time)
    else if (attack.stage === "tail-warning") {
      const angle = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(this.player.y - attack.y, this.player.x - attack.x) - attack.angle))
      if (distance(attack, this.player) < 205 && angle < 1.15) this.damagePlayer(26, attack.x, attack.y)
      if (this.leaving || this.bossAttack !== attack) return
      this.setBossStage("recover", time)
    } else if (attack.stage === "ring-warning") this.setBossStage("ring", time)
    else if (attack.stage === "whirl-warning") this.setBossStage("whirl", time)
    else if (attack.stage === "dive-warning") {
      enemy.sprite.setPosition(attack.x, attack.y).setAlpha(1)
      if (distance(attack, this.player) < 115) this.damagePlayer(34, attack.x, attack.y)
      if (this.leaving || this.bossAttack !== attack) return
      this.flashCircle(attack.x, attack.y, 115)
      if (--attack.remaining > 0) this.setBossStage("dive-warning", time)
      else this.setBossStage("recover", time)
    } else if (attack.stage === "recover") {
      enemy.nextAttackAt = time + (this.bossPhase(enemy) === 3 ? 510 : 600)
      this.clearBossAttack()
    } else this.setBossStage("recover", time)
  }

  private drawSector(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, from: number, to: number, color: number, alpha: number): void {
    graphics.fillStyle(color, alpha).lineStyle(3, color, 0.85).beginPath().moveTo(x, y).arc(x, y, radius, from, to, false).closePath().fillPath().strokePath()
  }

  private flashCircle(x: number, y: number, radius: number): void {
    const flash = this.add.circle(x, y, radius, 0xc2f8ff, 0.55).setDepth(2450)
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.2, duration: 350, onComplete: () => flash.destroy() })
  }

  private clearBossAttack(): void {
    this.bossAttack?.graphics.destroy()
    if (this.bossAttack?.enemy.sprite.active && this.bossAttack.enemy.sprite.body) this.bossAttack.enemy.sprite.setVelocity(0, 0).setAlpha(1)
    this.bossAttack = null
  }
  private clearHazards(): void { this.clearBossAttack(); for (const enemy of this.enemies) { enemy.warning?.destroy(); enemy.warning = undefined; enemy.slamAt = 0; if (enemy.sprite.active && enemy.sprite.body) enemy.sprite.setVelocity(0, 0) } }

  private attack(): void {
    const direction = this.lastDirection.clone(), weapon = gameStore.state.equippedWeapon
    actorFor(this.player)?.face(direction.x, direction.y)
    actorFor(this.player)?.play(weapon === "melee" ? "attack" : "throw", { duration: 450, impactAt: 120, onImpact: () => {
      if (this.leaving) return
      const range = weapon === "melee" ? 160 : 420
      const target = this.enemies.filter((enemy) => {
        const dx = enemy.sprite.x - this.player.x, dy = enemy.sprite.y - this.player.y, length = Math.hypot(dx, dy)
        return enemy.sprite.active && length < range && (dx * direction.x + dy * direction.y) / (length || 1) > (weapon === "melee" ? -0.05 : 0.55)
      }).sort((a, b) => distance(a.sprite, this.player) - distance(b.sprite, this.player))[0]
      if (weapon !== "melee") {
        const produce = gameStore.consumeProduceShot()
        if (!produce) return
        const shot = this.add.text(this.player.x, this.player.y, PRODUCE[produce].icon, { fontFamily: FONT, fontSize: "28px" }).setOrigin(0.5).setDepth(3200)
        this.tweens.add({ targets: shot, x: target?.sprite.x ?? this.player.x + direction.x * 360, y: target?.sprite.y ?? this.player.y + direction.y * 360, duration: 280, angle: 360, onComplete: () => { shot.destroy(); if (target?.sprite.active && !this.leaving) this.hitEnemy(target, PRODUCE[produce].damage) } })
      } else {
        this.flashCircle(this.player.x + direction.x * 65, this.player.y + direction.y * 65, 58)
        if (target) this.hitEnemy(target, calculateAttackDamage(gameStore.state.character!.stats.strength))
      }
    } })
  }

  private hitEnemy(enemy: OceanEnemy, damage: number): void {
    if (!enemy.sprite.active || this.leaving) return
    if (enemy.definition.type === "jellyfish") gameStore.provokeMedusaSchool(enemy.definition.id)
    if (!this.combat.hitEnemy(this, enemy, damage, this.lastDirection, enemy.definition.rank === "boss" ? 170 : 76)) return
    const { x, y } = enemy.sprite
    const { drop } = this.combat.recordDefeat(enemy, x, y)
    if (this.bossAttack?.enemy === enemy) this.clearBossAttack()
    enemy.warning?.destroy()
    this.combat.destroyEnemy(enemy)
    this.enemies = this.enemies.filter((item) => item !== enemy)
    if (drop && !drop.collected && !this.pickups.some((pickup) => pickup.id === drop.id)) this.addPickup(drop.id, x, y, false)
    if (enemy.definition.respawnMs !== null && enemy.definition.type !== "jellyfish") this.combat.scheduleRespawn(this, enemy.definition.respawnMs, () => this.spawnEnemy(enemy.definition, enemy.index))
    if (enemy.definition.id === TIGER_SHARK_ID) EventBus.emit(GameEvents.showMessage, "Тигровая акула побеждена! Проход во Впадину открыт.", 3500)
    else if (enemy.definition.id === ICHTHYOSAUR_ID) EventBus.emit(GameEvents.showMessage, "Ихтиозавр побеждён! Подойди к приливному механизму и отключи его клавишей E.", 4500)
    else if (drop) EventBus.emit(GameEvents.showMessage, "Робот оставил шестерёнку. Подбери её клавишей E.", 1600)
    this.updateDiagnostics()
  }
  private debugDamage(id: string, damage: number): void { const enemy = this.enemies.find((item) => item.definition.id === id); if (enemy && Number.isFinite(damage) && damage > 0) this.hitEnemy(enemy, damage) }

  private damagePlayer(amount: number, x: number, y: number): void {
    if (this.leaving || this.modalOpen) return
    const result = this.combat.damagePlayer(this, this.player, amount, x, y, this.combat.now, this.combat.now < this.shieldUntil)
    if (result === "shielded") { this.shieldUntil = 0; EventBus.emit(GameEvents.showMessage, "Щит погасил удар!", 1000) }
    if (result === "knocked-out") {
      this.leaving = true; this.clearHazards(); this.updateDiagnostics()
      EventBus.emit(GameEvents.showMessage, "Героя спасли и вернули в деревню. Акваланг остался в рюкзаке.", 2300)
      this.time.delayedCall(650, () => this.scene.start("forest-village"))
    }
  }
  private useGadget(time: number): void {
    if (gameStore.state.equippedGadget !== "pulse-shield") { EventBus.emit(GameEvents.showMessage, "Акваланг действует автоматически. В бою поможет импульсный щит.", 1800); return }
    if (time - this.shieldUsedAt < GADGETS["pulse-shield"].cooldownMs) return
    this.shieldUsedAt = time; this.shieldUntil = time + GADGETS["pulse-shield"].durationMs
    actorFor(this.player)?.play("gadget", { duration: 350 })
    EventBus.emit(GameEvents.showMessage, "Щит готов погасить следующий удар.", 1500)
  }

  private onOceanModal(open: boolean): void {
    if (open && !this.schoolPauseAt) this.schoolPauseAt = Date.now()
    if (!open && this.schoolPauseAt) {
      gameStore.deferMedusaRespawns(Date.now() - this.schoolPauseAt)
      this.schoolPauseAt = 0
    }
  }

  private refreshSchools(): void {
    if (this.locationId !== "sea") return
    gameStore.refreshMedusaSchools(Date.now())
    OCEAN_ENEMIES.forEach((definition, index) => {
      if (definition.location === "sea" && definition.type === "jellyfish" && !gameStore.isMedusaDefeated(definition.id)) this.spawnEnemy(definition, index)
    })
  }

  private addPickup(id: string, x: number, y: number, scrap: boolean): void {
    const marker = this.add.container(x, y, [this.add.circle(0, 0, scrap ? 38 : 23, COLORS.yellow, 0.22), this.add.text(0, 0, scrap ? "⚙️ ×10" : "⚙️", { fontFamily: FONT, fontSize: scrap ? "30px" : "28px", color: "#fff1ac", backgroundColor: scrap ? "#304943cc" : undefined, padding: { x: 5, y: 3 } }).setOrigin(0.5)]).setDepth(y + 18)
    this.tweens.add({ targets: marker, y: y - 6, duration: 850, yoyo: true, repeat: -1 })
    this.pickups.push({ id, x, y, marker, scrap })
  }

  private createMechanism(): void {
    const { x, y } = OCEAN_MECHANISM
    const wheel = this.add.star(0, 0, 12, 47, 66, 0x9aa7aa).setStrokeStyle(7, 0x405b67)
    const center = this.add.circle(0, 0, 27, gameStore.state.ocean.mechanismDisabled ? 0x7fc5b1 : 0x89dce9).setStrokeStyle(6, 0xc7ddd7)
    const label = this.add.text(0, 85, "ПРИЛИВНЫЙ МЕХАНИЗМ", { fontFamily: FONT, fontSize: "17px", color: "#d6faf0", backgroundColor: "#163744d9", padding: { x: 7, y: 5 } }).setOrigin(0.5)
    this.mechanism = this.add.container(x, y, [wheel, center, label]).setDepth(y + 10)
    if (!gameStore.state.ocean.mechanismDisabled) this.tweens.add({ targets: wheel, angle: 360, duration: 8000, repeat: -1 })
  }

  private updateNearest(): void {
    this.nearest = this.pickups.filter((pickup) => distance(pickup, this.player) < 100).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0] ?? null
    if (!this.nearest && this.locationId === "trench" && distance(OCEAN_MECHANISM, this.player) < 150) this.nearest = "mechanism"
    if (!this.nearest) this.nearest = this.portals.find((portal) => distance(portal, this.player) < 135) ?? null
    const prompt = !this.nearest ? "" : this.nearest === "mechanism" ? gameStore.state.ocean.mechanismDisabled ? "Механизм отключён. Деревня спасена!" : "E — отключить приливный механизм" : "scrap" in this.nearest ? this.nearest.scrap ? "E — разобрать хлам: 10 шестерёнок" : "E — подобрать шестерёнку" : `E — ${this.nearest.label}`
    if (prompt !== this.lastPrompt) { this.lastPrompt = prompt; EventBus.emit(GameEvents.promptChanged, prompt) }
  }

  private interact(): void {
    const target = this.nearest
    if (!target) return
    if (target === "mechanism") {
      if (!gameStore.state.ocean.ichthyosaurCleared) { EventBus.emit(GameEvents.showMessage, "Сначала нужно победить Ихтиозавра.", 1700); return }
      if (gameStore.finishOceanChapter()) {
        this.tweens.killAll(); this.mechanism?.destroy(true); this.createMechanism()
        EventBus.emit(GameEvents.oceanComplete)
      }
      return
    }
    if ("scrap" in target) {
      const hadQuest = gameStore.state.ocean.returnToMole
      const collected = target.scrap ? gameStore.collectBeachScrap(target.id) : gameStore.collectEnemyGearDrop(target.id)
      if (collected) { target.marker.destroy(true); this.pickups = this.pickups.filter((pickup) => pickup !== target); EventBus.emit(GameEvents.showMessage, !hadQuest && gameStore.state.ocean.returnToMole ? "Новое задание: Вернуться к кроту. Можно купить акваланг за 40 шестерёнок!" : target.scrap ? "В хламе найдено 10 шестерёнок." : "Шестерёнка в рюкзаке.", 2500) }
      return
    }
    if ((target.location === "sea" || target.location === "trench") && !gameStore.canEnterOceanLocation(target.location)) {
      EventBus.emit(GameEvents.showMessage, target.location === "sea" ? "Для погружения нужен акваланг. Купи его у Крота за 40 шестерёнок." : "Тигровая акула преграждает путь во Впадину.", 2700)
      return
    }
    this.leaving = true; this.clearHazards(); this.transitionTo(target.location, target.location)
  }

  private createScuba(): void {
    actorFor(this.player)?.setSwimming(true)
    const tank = this.add.graphics()
    tank.fillStyle(0x294856).fillRoundedRect(-41, -91, 25, 61, 9)
    tank.fillStyle(0xe1b44e).fillRoundedRect(-38, -88, 19, 53, 7)
    tank.fillStyle(0xffdc80, 0.8).fillRoundedRect(-35, -85, 5, 42, 3)
    tank.fillStyle(0x385667).fillRect(-40, -74, 23, 6).fillRect(-40, -47, 23, 6)
    tank.fillStyle(0x71909b).fillRoundedRect(-34, -96, 11, 9, 3)
    const small = gameStore.state.character?.id === "rabbit" || gameStore.state.character?.id === "watermelon"
    tank.setScale(small ? 0.8 : 1)
    this.scubaHose = this.add.graphics()
    this.scubaMask = this.add.graphics().fillStyle(0x70d5eb, 0.4).lineStyle(3, 0x264d60)
      .fillRoundedRect(-21, -10, 42, 20, 6).strokeRoundedRect(-21, -10, 42, 20, 6)
      .lineStyle(2, 0xdbf8ff, 0.7).lineBetween(-14, -6, -4, 4)
    this.scuba = this.add.container(this.player.x, this.player.y, [tank, this.scubaHose, this.scubaMask]).setDepth(this.player.depth + 2)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.positionScuba, this)
  }

  private positionScuba(): void {
    const actor = actorFor(this.player)
    if (!this.scuba || !actor) return
    const hero = gameStore.state.character?.id
    const height = this.player.displayHeight
    const eyeRatio = hero === "watermelon" ? 0.5 : hero === "rabbit" ? 0.45 : hero === "wolf" ? 0.65 : hero === "fox" ? 0.63 : 0.74
    const side = actor.facing === "left" ? -1 : 1
    const lateral = actor.facing === "left" || actor.facing === "right"
    // Use the atlas foot pivot for both hero and gear, including the swim lean.
    this.scuba.setPosition(actor.visual.x, actor.visual.y).setDepth(this.player.depth + 2).setScale(side, 1).setAngle(actor.visual.angle)
    const maskX = lateral ? 18 : 0, maskY = -height * eyeRatio
    this.scubaMask?.setPosition(maskX, maskY).setVisible(actor.facing !== "up").setScale(hero === "rabbit" || hero === "watermelon" ? 0.82 : 1)
    const tankScale = hero === "rabbit" || hero === "watermelon" ? 0.8 : 1
    const hoseTop = Math.min(-91 * tankScale, maskY) - 5
    this.scubaHose?.clear().lineStyle(4, 0x294856).beginPath().moveTo(-29 * tankScale, -91 * tankScale)
      .lineTo(-40 * tankScale, hoseTop).lineTo(maskX - 14, hoseTop).lineTo(maskX - 18, maskY).strokePath()
  }

  private updateSwimming(time: number): void {
    if (!this.scuba) return
    const actor = actorFor(this.player)
    const anchor = actor?.renderPosition ?? this.player
    if (time < this.nextBubbleAt) return
    this.nextBubbleAt = time + 300
    const bubble = this.add.circle(anchor.x + 20, anchor.y - 25, 3 + (Math.floor(time / 300) % 3), 0xc6f8ff, 0.22).setStrokeStyle(1, 0xb8eaf4, 0.65).setDepth(this.player.depth + 3)
    this.tweens.add({ targets: bubble, x: bubble.x + 16, y: bubble.y - 100, alpha: 0, duration: 1200, onComplete: () => bubble.destroy() })
  }

  private positionEnemyUi(enemy: OceanEnemy): void {
    const width = enemy.definition.rank === "boss" ? 170 : 76, offset = enemy.definition.rank === "boss" ? 130 : 85
    enemy.healthBack.setPosition(enemy.sprite.x, enemy.sprite.y - offset)
    enemy.healthFill.setPosition(enemy.sprite.x - width / 2, enemy.sprite.y - offset)
    enemy.rankText.setPosition(enemy.sprite.x, enemy.sprite.y - offset + 12)
    enemy.sprite.setDepth(enemy.sprite.y + 20)
  }

  private updateDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    const boss = this.enemies.find((enemy) => enemy.definition.rank === "boss")
    status.dataset.activeOceanEnemies = String(this.enemies.length)
    status.dataset.oceanBossPhase = boss ? String(this.bossPhase(boss)) : "defeated"
    status.dataset.oceanBossAttack = this.bossAttack?.stage ?? "idle"
    status.dataset.oceanBossAttackTime = String(Math.round(this.bossAttack ? this.combat.now - this.bossAttack.start : 0))
    status.dataset.oceanHazards = String((this.bossAttack && this.bossAttack.stage !== "recover" ? 1 : 0) + this.enemies.filter((enemy) => enemy.slamAt).length)
    status.dataset.playerOnRoad = String(this.road.isOnRoad(this.player))
    status.dataset.scubaVisible = String(Boolean(this.scuba))
  }
}

export class BeachScene extends OceanWorldScene { constructor() { super("beach") } }
export class SeaScene extends OceanWorldScene { constructor() { super("sea") } }
export class TrenchScene extends OceanWorldScene { constructor() { super("trench") } }
