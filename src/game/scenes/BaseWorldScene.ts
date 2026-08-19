import Phaser from "phaser"
import { gameStore } from "../../domain/GameStore"
import { calculateWalkSpeed, SPRINT_MULTIPLIER } from "../../domain/rules"
import { PRODUCE, weaponLabel } from "../../domain/produce"
import type { CharacterDefinition, LocationId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { COLORS } from "../ui"

type MovementKeys = Record<
  "W" | "A" | "S" | "D" | "SHIFT" | "SPACE" | "E" | "Q" | "R" | "T" | "I" | "ESC",
  Phaser.Input.Keyboard.Key
>

export interface CollisionRect {
  x: number
  y: number
  width: number
  height: number
}

export abstract class BaseWorldScene extends Phaser.Scene {
  protected player!: Phaser.Physics.Arcade.Image
  protected movementKeys!: MovementKeys
  protected modalOpen = false
  protected lastDirection = new Phaser.Math.Vector2(1, 0)

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private walkClock = 0
  private baseScaleX = 1
  private baseScaleY = 1
  private nextDiagnosticAt = 0

  protected setupWorld(
    character: CharacterDefinition,
    worldWidth: number,
    worldHeight: number,
    spawnX: number,
    spawnY: number,
    displayWidth = 112,
    displayHeight = 154,
    worldX = 0,
    worldY = 0,
  ): void {
    // Phaser reuses Scene instances after scene.start(). Never carry a modal
    // lock or movement state from the previous visit into a restarted world.
    this.modalOpen = false
    this.lastDirection.set(1, 0)
    this.walkClock = 0
    this.nextDiagnosticAt = 0

    this.physics.world.setBounds(worldX, worldY, worldWidth, worldHeight)
    this.cameras.main.setBounds(worldX, worldY, worldWidth, worldHeight)

    this.player = this.physics.add.image(spawnX, spawnY, character.assetKey)
    this.player.setDisplaySize(displayWidth, displayHeight)
    this.player.setCollideWorldBounds(true)
    this.player.setDepth(this.player.y + 30)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(this.player.width * 0.42, this.player.height * 0.3)
    body.setOffset(
      (this.player.width - body.width) / 2,
      this.player.height - body.height - this.player.height * 0.04,
    )
    this.baseScaleX = this.player.scaleX
    this.baseScaleY = this.player.scaleY

    this.cameras.main.startFollow(this.player, true, 0.09, 0.09)
    this.cameras.main.setZoom(1)

    const keyboard = this.input.keyboard
    if (!keyboard) throw new Error("Для игры требуется клавиатура")
    this.movementKeys = keyboard.addKeys("W,A,S,D,SHIFT,SPACE,E,Q,R,T,I,ESC") as MovementKeys
    this.cursors = keyboard.createCursorKeys()

    EventBus.on("modal-state", this.handleModalState, this)
    EventBus.on("debug-teleport", this.handleDebugTeleport, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off("modal-state", this.handleModalState, this)
      EventBus.off("debug-teleport", this.handleDebugTeleport, this)
      EventBus.emit(GameEvents.promptChanged, "")
    })
  }

  protected updateWorldInput(delta: number, movementEnabled = true): Phaser.Math.Vector2 {
    if (Phaser.Input.Keyboard.JustDown(this.movementKeys.I)) {
      EventBus.emit(GameEvents.toggleInventory)
    }
    if (Phaser.Input.Keyboard.JustDown(this.movementKeys.ESC)) {
      EventBus.emit("close-modal")
    }

    if (!movementEnabled || this.modalOpen) {
      this.player.setVelocity(0, 0)
      this.updateWalkAnimation(false, delta, 0)
      this.updatePositionDiagnostics()
      return new Phaser.Math.Vector2()
    }

    if (
      gameStore.state.chapter === 2 &&
      Phaser.Input.Keyboard.JustDown(this.movementKeys.R)
    ) {
      const weapon = gameStore.cycleWeapon()
      const ammo = weapon === "melee" ? "" : ` ×${gameStore.state.produceAmmo[weapon]}`
      const icon = weapon === "melee" ? "🗡️" : PRODUCE[weapon].icon
      EventBus.emit(GameEvents.showMessage, `${icon} Выбрано: ${weaponLabel(weapon)}${ammo}`, 1500)
    }

    if (
      gameStore.state.chapter === 2 &&
      Phaser.Input.Keyboard.JustDown(this.movementKeys.T)
    ) {
      const result = gameStore.useHealingPotion()
      if (result.used) {
        EventBus.emit(GameEvents.showMessage, `🧪 Восстановлено ${result.healed} здоровья. Зелий готово: ${result.ready}/3.`, 1900)
      } else if (result.reason === "full-health") {
        EventBus.emit(GameEvents.showMessage, "Здоровье уже полное — зелье не потрачено.", 1500)
      } else {
        const seconds = Math.max(1, Math.ceil(((result.nextReadyAt ?? Date.now()) - Date.now()) / 1000))
        EventBus.emit(GameEvents.showMessage, `Все зелья восстанавливаются. Ближайшее будет готово через ${seconds} сек.`, 1800)
      }
    }

    const character = gameStore.state.character
    if (!character) return new Phaser.Math.Vector2()

    let x = 0
    let y = 0
    if (this.movementKeys.A.isDown || this.cursors.left.isDown) x -= 1
    if (this.movementKeys.D.isDown || this.cursors.right.isDown) x += 1
    if (this.movementKeys.W.isDown || this.cursors.up.isDown) y -= 1
    if (this.movementKeys.S.isDown || this.cursors.down.isDown) y += 1

    const direction = new Phaser.Math.Vector2(x, y)
    const moving = direction.lengthSq() > 0
    if (moving) {
      direction.normalize()
      this.lastDirection.copy(direction)
    }

    const sprinting = moving && this.movementKeys.SHIFT.isDown && gameStore.state.stamina > 0
    gameStore.updateStamina(delta / 1000, sprinting)
    const speed = calculateWalkSpeed(character.stats.agility) * (sprinting ? SPRINT_MULTIPLIER : 1)
    this.player.setVelocity(direction.x * speed, direction.y * speed)
    this.player.setDepth(this.player.y + 30)
    this.updateWalkAnimation(moving, delta, direction.x)
    this.updatePositionDiagnostics()
    return direction
  }

  protected loadMapCollisions(mapKey: string): Phaser.Physics.Arcade.StaticGroup {
    const map = this.make.tilemap({ key: mapKey })
    const layer = map.getObjectLayer("collisions")
    if (!layer) throw new Error(`В карте ${mapKey} нет слоя collisions`)
    const rectangles = layer.objects.map((object) => ({
      x: object.x ?? 0,
      y: object.y ?? 0,
      width: object.width ?? 0,
      height: object.height ?? 0,
    }))
    return this.addCollisionRectangles(rectangles)
  }

  protected addCollisionRectangles(
    rectangles: readonly CollisionRect[],
  ): Phaser.Physics.Arcade.StaticGroup {
    const obstacles = this.physics.add.staticGroup()
    rectangles.forEach(({ x, y, width, height }) => {
      const obstacle = this.add.rectangle(
        x + width / 2,
        y + height / 2,
        width,
        height,
        COLORS.ink,
        0,
      )
      obstacles.add(obstacle)
    })
    this.physics.add.collider(this.player, obstacles)
    return obstacles
  }

  protected interactionPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.movementKeys.E)
  }

  protected attackPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.movementKeys.SPACE)
  }

  protected gadgetPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.movementKeys.Q)
  }

  protected mapObjects(mapKey: string, layerName = "world-objects"): Phaser.Types.Tilemaps.TiledObject[] {
    const map = this.make.tilemap({ key: mapKey })
    return map.getObjectLayer(layerName)?.objects ?? []
  }

  protected transitionTo(sceneKey: string, location: LocationId): void {
    this.player.setVelocity(0, 0)
    gameStore.setLocation(location)
    this.cameras.main.fadeOut(220, 23, 63, 56)
    this.time.delayedCall(230, () => this.scene.start(sceneKey))
  }

  private handleModalState(open: boolean): void {
    this.modalOpen = open
  }

  private handleDebugTeleport(x: number, y: number): void {
    this.player.setPosition(x, y)
    this.player.setVelocity(0, 0)
  }

  private updateWalkAnimation(moving: boolean, delta: number, directionX: number): void {
    if (!moving) {
      this.player.setScale(this.baseScaleX, this.baseScaleY)
      this.player.setAngle(0)
      return
    }
    this.walkClock += delta * 0.018
    const bounce = Math.sin(this.walkClock)
    const stretch = Math.abs(bounce) * 0.035
    const facing =
      directionX < -0.05 ? -1 : directionX > 0.05 ? 1 : Math.sign(this.player.scaleX) || 1
    this.player.setScale(
      this.baseScaleX * facing * (1 + stretch),
      this.baseScaleY * (1 - stretch),
    )
    this.player.setAngle(bounce * 2.2)
  }

  private updatePositionDiagnostics(): void {
    if (this.time.now < this.nextDiagnosticAt) return
    this.nextDiagnosticAt = this.time.now + 120
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.playerX = String(Math.round(this.player.x))
    status.dataset.playerY = String(Math.round(this.player.y))
  }
}
