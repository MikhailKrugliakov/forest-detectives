import Phaser from "phaser"
import { actorFor } from "../animation/AnimatedActor"
import { updateGameStatus } from "../../accessibility"
import { GADGETS } from "../../domain/gadgets"
import { BEAVER_ROOM_ORDER, gameStore } from "../../domain/GameStore"
import { scaledTrapDamage } from "../../domain/difficulty"
import { BEAVER_CHECKPOINTS as CHECKPOINTS } from "../../domain/beaverLayout"
import type { BeaverRoomId, GadgetId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { COLORS, FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"

interface Station {
  room: BeaverRoomId
  index: number
  x: number
  y: number
  icon: string
}

const FLOOR_ROUTE = [20, 15, 16, 11, 12, 7, 2] as const
const ROOM_SEQUENCES: Partial<Record<BeaverRoomId, readonly number[]>> = {
  launchers: [1, 0, 2],
  gas: [1, 3, 0, 2],
  battery: [0, 2, 1],
  control: [2, 0, 3, 1],
}

export class BeaverHouseScene extends BaseWorldScene {
  private stations: Station[] = []
  private floorTiles: Phaser.GameObjects.Rectangle[] = []
  private nearestStation: Station | null = null
  private floorLever = false
  private floorStep = 0
  private lastFloorCell = -1
  private roomStep = 0
  private atFloorLever = false
  private atJetpad = false
  private atExit = false
  private flying = false
  private gasTickAt = 0
  private gadgetLastUsed: Partial<Record<GadgetId, number>> = {}
  private maskUntil = 0
  private shieldUntil = 0
  private trapTime = 0
  private lastPrompt = ""
  private chasmBarrier!: Phaser.Physics.Arcade.StaticGroup

  constructor() {
    super("beaver-house")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("character-select")
      return
    }
    gameStore.setLocation("beaver-house")
    this.trapTime = 0
    this.gasTickAt = 0
    this.maskUntil = 0
    this.shieldUntil = 0
    this.gadgetLastUsed = {}
    this.stations = []
    this.floorTiles = []
    this.flying = false
    this.cameras.main.setBackgroundColor("#171813")
    this.add.image(1200, 800, "beaver-house-bg").setDisplaySize(2400, 1600)
    const checkpoint = gameStore.state.beaverHouse.chasmCrossed && gameStore.state.quests["beaver-security"].status !== "ready"
      ? { x: 1940, y: 1050 }
      : CHECKPOINTS[gameStore.state.beaverHouse.checkpoint]
    this.setupWorld(character, 2400, 1600, checkpoint.x, checkpoint.y, 90, character.id === "watermelon" ? 104 : 124)
    this.loadMapCollisions("beaver-house-map")
    this.chasmBarrier = this.addCollisionRectangles([
      { x: 1755, y: 650, width: 150, height: 870 },
    ])
    this.createFloorPuzzle()
    this.createStations()
    this.createLabels()
    updateGameStatus("beaver-house", `Дом Бобра. Комнат пройдено: ${gameStore.state.beaverHouse.completedRooms.length}/5.`)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    EventBus.emit(GameEvents.showMessage, "Ловушки предупреждают перед ударом. Решай комнаты по порядку и ищи контрольные точки.", 5200)
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) return
    this.updateWorldInput(delta, !this.flying && actorFor(this.player)?.activeAction !== "defeat")
    if (this.modalOpen || actorFor(this.player)?.activeAction === "defeat") return
    this.trapTime += Math.max(0, Math.min(delta, 50))
    const time = this.trapTime
    if (this.flying) return
    this.updateFloor(time)
    this.updateGas(time)
    this.updateNearest()
    if (this.gadgetPressed()) this.useGadget(time)
    if (!this.interactionPressed()) return
    if (this.atExit) {
      this.transitionTo("forest-village", "forest-village")
      return
    }
    if (this.atFloorLever && this.currentRoom() === "floor") {
      this.revealFloor()
      return
    }
    if (this.nearestStation) this.pressStation(this.nearestStation, time)
  }

  private createFloorPuzzle(): void {
    const startX = 290
    const startY = 330
    const size = 82
    for (let index = 0; index < 25; index += 1) {
      const x = startX + (index % 5) * size
      const y = startY + Math.floor(index / 5) * size
      const tile = this.add.rectangle(x, y, 74, 74, 0x7a4d28, 0.22).setStrokeStyle(2, 0xd1a45d, 0.35).setDepth(700)
      this.floorTiles.push(tile)
    }
    this.add.text(350, 650, "🕹️", { fontFamily: FONT, fontSize: "45px" }).setOrigin(0.5).setDepth(720)
  }

  private createStations(): void {
    const definitions: Station[] = [
      { room: "launchers", index: 0, x: 1010, y: 300, icon: "🔴" },
      { room: "launchers", index: 1, x: 1210, y: 300, icon: "🔵" },
      { room: "launchers", index: 2, x: 1410, y: 300, icon: "🟡" },
      { room: "gas", index: 0, x: 1660, y: 300, icon: "🔴" },
      { room: "gas", index: 1, x: 1810, y: 300, icon: "🔵" },
      { room: "gas", index: 2, x: 1960, y: 300, icon: "🟡" },
      { room: "gas", index: 3, x: 2110, y: 300, icon: "🟢" },
      { room: "battery", index: 0, x: 980, y: 910, icon: "◀️" },
      { room: "battery", index: 1, x: 1190, y: 910, icon: "⏺️" },
      { room: "battery", index: 2, x: 1400, y: 910, icon: "▶️" },
      { room: "control", index: 0, x: 1990, y: 1160, icon: "◆" },
      { room: "control", index: 1, x: 2100, y: 1160, icon: "●" },
      { room: "control", index: 2, x: 2210, y: 1160, icon: "▲" },
      { room: "control", index: 3, x: 2320, y: 1160, icon: "■" },
    ]
    definitions.forEach((station) => {
      this.add.circle(station.x, station.y, 36, COLORS.yellow, 0.3).setStrokeStyle(3, COLORS.yellow, 0.7).setDepth(station.y + 20)
      this.add.text(station.x, station.y, station.icon, { fontFamily: FONT, fontSize: "27px" }).setOrigin(0.5).setDepth(station.y + 21)
    })
    this.stations = definitions
  }

  private createLabels(): void {
    const labels: Array<[number, number, string]> = [
      [500, 190, "1. ПРОВАЛИВАЮЩИЙСЯ ПОЛ"],
      [1210, 170, "2. СТЕННЫЕ ПУСКОВЫЕ"],
      [1890, 170, "3. ГАЗОВАЯ ЛАБОРАТОРИЯ"],
      [1190, 790, "4. СИЛОВАЯ ДВЕРЬ"],
      [1790, 920, "🚀 ПРОПАСТЬ"],
      [2160, 1030, "5. ГЛАВНЫЙ ПУЛЬТ"],
      [520, 1260, "← В ДЕРЕВНЮ"],
    ]
    labels.forEach(([x, y, text]) => {
      this.add.text(x, y, text, { fontFamily: FONT, fontSize: "17px", fontStyle: "bold", color: "#fff4cf", backgroundColor: "#173f38dd", padding: { x: 9, y: 5 } }).setOrigin(0.5).setDepth(y + 30)
    })
    this.add.circle(1670, 1050, 58, COLORS.blue, 0.3).setStrokeStyle(4, COLORS.yellow, 0.8).setDepth(1100)
    this.add.circle(1940, 1050, 58, COLORS.blue, 0.3).setStrokeStyle(4, COLORS.yellow, 0.8).setDepth(1100)
  }

  private updateFloor(time: number): void {
    if (this.currentRoom() !== "floor" || !this.floorLever) return
    const startX = 290
    const startY = 330
    const size = 82
    const column = Math.round((this.player.x - startX) / size)
    const row = Math.round((this.player.y - startY) / size)
    if (column < 0 || column > 4 || row < 0 || row > 4) {
      this.lastFloorCell = -1
      return
    }
    const index = row * 5 + column
    if (index === this.lastFloorCell) return
    this.lastFloorCell = index
    if (FLOOR_ROUTE[this.floorStep] === index) {
      this.floorStep += 1
      this.floorTiles[index]?.setFillStyle(COLORS.leaf, 0.62)
      if (this.floorStep === FLOOR_ROUTE.length) this.finishRoom("floor")
      return
    }
    if (time > 250) this.triggerTrap(15, "Доска провалилась! Маршрут начинается заново.", time)
  }

  private updateGas(time: number): void {
    if (this.currentRoom() !== "gas") return
    const inGas = this.player.x > 1550 && this.player.x < 2260 && this.player.y > 180 && this.player.y < 700
    if (!inGas || time < this.gasTickAt) return
    this.gasTickAt = time + 1000
    if (time < this.maskUntil) return
    this.triggerTrap(8, "Ядовитый газ! Поверни вентили или используй противогаз.", time, false)
  }

  private updateNearest(): void {
    this.nearestStation = null
    let best = Number.POSITIVE_INFINITY
    const room = this.currentRoom()
    this.stations.forEach((station) => {
      if (station.room !== room) return
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, station.x, station.y)
      if (distance < 100 && distance < best) {
        best = distance
        this.nearestStation = station
      }
    })
    this.atFloorLever = Phaser.Math.Distance.Between(this.player.x, this.player.y, 350, 650) < 105
    this.atJetpad = Phaser.Math.Distance.Between(this.player.x, this.player.y, 1670, 1050) < 120
    this.atExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, 520, 1160) < 110

    let prompt = ""
    if (this.atExit) prompt = "E — вернуться в деревню"
    else if (this.atFloorLever && room === "floor") prompt = "E — показать безопасный путь"
    else if (this.nearestStation) prompt = "E — переключить механизм"
    else if (this.atJetpad && room === "control") prompt = "Q — использовать реактивный ранец"
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private revealFloor(): void {
    this.floorLever = true
    this.floorTiles.forEach((tile, index) => {
      if (FLOOR_ROUTE.includes(index as (typeof FLOOR_ROUTE)[number])) tile.setFillStyle(COLORS.leaf, 0.75)
    })
    EventBus.emit(GameEvents.showMessage, "Запомни зелёную дорожку — через две секунды подсветка исчезнет!", 2200)
    this.time.delayedCall(2000, () => {
      this.floorTiles.forEach((tile, index) => {
        if (this.floorStep === 0 || !FLOOR_ROUTE.slice(0, this.floorStep).includes(index as (typeof FLOOR_ROUTE)[number])) {
          tile.setFillStyle(0x7a4d28, 0.22)
        }
      })
    })
  }

  private pressStation(station: Station, time: number): void {
    const sequence = ROOM_SEQUENCES[station.room]
    if (!sequence) return
    if (sequence[this.roomStep] !== station.index) {
      this.roomStep = 0
      const damage = station.room === "gas" ? 8 : station.room === "battery" ? 15 : 10
      this.triggerTrap(damage, "Неверный порядок — ловушка сработала!", time)
      return
    }
    this.roomStep += 1
    EventBus.emit(GameEvents.showMessage, `Верно: ${this.roomStep}/${sequence.length}`, 1200)
    if (this.roomStep === sequence.length) this.finishRoom(station.room)
  }

  private useGadget(time: number): void {
    const id = gameStore.state.equippedGadget
    if (!id) {
      EventBus.emit(GameEvents.showMessage, "Активный гаджет не выбран.", 2200)
      return
    }
    const gadget = GADGETS[id]
    const lastUsed = this.gadgetLastUsed[id] ?? -gadget.cooldownMs
    if (time - lastUsed < gadget.cooldownMs) {
      const seconds = Math.ceil((gadget.cooldownMs - (time - lastUsed)) / 1000)
      EventBus.emit(GameEvents.showMessage, `${gadget.name}: перезарядка ${seconds} сек.`, 1600)
      return
    }
    if (id === "jetpack") {
      if (!this.atJetpad || this.currentRoom() !== "control") {
        EventBus.emit(GameEvents.showMessage, "Ранец запускается только с отмеченной площадки.", 2200)
        return
      }
      this.gadgetLastUsed[id] = time
      this.flyAcrossChasm()
      return
    }
    if (id === "magnetic-glove") {
      if (this.currentRoom() !== "battery" || Phaser.Math.Distance.Between(this.player.x, this.player.y, 1190, 910) > 260) {
        EventBus.emit(GameEvents.showMessage, "Рядом нет отмеченного металлического механизма.", 2200)
        return
      }
      this.gadgetLastUsed[id] = time
      actorFor(this.player)?.play("gadget", { duration: 600 })
      this.finishRoom("battery")
      EventBus.emit(GameEvents.showMessage, "Магнитная перчатка притянула батарею прямо в гнездо!", 2600)
      return
    }
    this.gadgetLastUsed[id] = time
    actorFor(this.player)?.play("gadget", { duration: 600 })
    if (id === "gas-mask") {
      this.maskUntil = time + gadget.durationMs
      this.player.setTint(0x8ce6d1)
      this.time.delayedCall(gadget.durationMs, () => this.player?.clearTint())
      EventBus.emit(GameEvents.showMessage, "Противогаз включён на 8 секунд.", 1800)
    } else {
      this.shieldUntil = time + gadget.durationMs
      this.player.setTint(0x6cc7ff)
      this.time.delayedCall(gadget.durationMs, () => {
        if (this.trapTime >= this.shieldUntil) this.player?.clearTint()
      })
      EventBus.emit(GameEvents.showMessage, "Импульсный щит ждёт следующий удар.", 1800)
    }
  }

  private flyAcrossChasm(): void {
    this.flying = true
    this.player.setVelocity(0, 0)
    this.player.setTint(0xffd66b)
    actorFor(this.player)?.play("gadget", { duration: GADGETS.jetpack.durationMs })
    this.setChasmCollision(false)
    this.tweens.add({
      targets: this.player,
      x: 1940,
      y: 1050,
      duration: GADGETS.jetpack.durationMs,
      ease: "Sine.easeInOut",
      onComplete: () => {
        gameStore.crossBeaverChasm()
        this.flying = false
        this.setChasmCollision(true)
        this.player.setAngle(0).clearTint()
        EventBus.emit(GameEvents.showMessage, "Перелёт выполнен! Осталось отключить главный пульт.", 2600)
      },
    })
  }

  private setChasmCollision(enabled: boolean): void {
    for (const child of this.chasmBarrier.children) {
      const body = (child as Phaser.GameObjects.Rectangle & {
        body: Phaser.Physics.Arcade.StaticBody
      }).body
      body.enable = enabled
    }
  }

  private triggerTrap(damage: number, message: string, time: number, resetRoom = true): void {
    if (time < this.shieldUntil) {
      this.shieldUntil = 0
      this.player.clearTint()
      EventBus.emit(GameEvents.showMessage, "Импульсный щит заблокировал ловушку!", 1800)
      return
    }
    const scaledDamage = scaledTrapDamage(damage, gameStore.state.difficulty)
    const result = gameStore.takeDamage(scaledDamage)
    const actor = actorFor(this.player)
    actor?.play(result.knockedOut ? "defeat" : "hurt", {
      duration: result.knockedOut ? 550 : 210,
      onComplete: result.knockedOut ? () => {
        ;(this.player.body as Phaser.Physics.Arcade.Body).enable = true
        actor.cancel()
        this.resetCurrentRoom()
      } : undefined,
    })
    if (result.knockedOut) {
      this.player.setVelocity(0, 0)
      ;(this.player.body as Phaser.Physics.Arcade.Body).enable = false
    }
    this.cameras.main.shake(180, 0.009)
    this.player.setTint(0xff8b72)
    this.time.delayedCall(180, () => this.player?.clearTint())
    EventBus.emit(GameEvents.showMessage, `${message} −${scaledDamage} здоровья.`, 2400)
    if (resetRoom && !result.knockedOut) this.resetCurrentRoom()
  }

  private resetCurrentRoom(): void {
    this.roomStep = 0
    this.floorStep = 0
    this.lastFloorCell = -1
    const checkpoint = CHECKPOINTS[gameStore.state.beaverHouse.checkpoint]
    this.player.setPosition(checkpoint.x, checkpoint.y).setVelocity(0, 0)
    if (this.currentRoom() === "floor") this.floorTiles.forEach((tile) => tile.setFillStyle(0x7a4d28, 0.22))
  }

  private finishRoom(room: BeaverRoomId): void {
    if (!gameStore.completeBeaverRoom(room)) return
    this.roomStep = 0
    updateGameStatus("beaver-house", `Дом Бобра. Комнат пройдено: ${gameStore.state.beaverHouse.completedRooms.length}/5.`)
    if (room === "control") {
      EventBus.emit(GameEvents.showMessage, "Главный пульт отключён! Вернись к Бобру и сдай задание.", 4200)
    } else {
      EventBus.emit(GameEvents.showMessage, `Контрольная точка сохранена. Комната ${gameStore.state.beaverHouse.completedRooms.length}/5 пройдена.`, 2800)
    }
  }

  private currentRoom(): BeaverRoomId | null {
    return BEAVER_ROOM_ORDER[gameStore.state.beaverHouse.completedRooms.length] ?? null
  }
}
