import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { gameStore } from "../../domain/GameStore"
import { KROK_CITY_SIZE, KROK_ERRANDS } from "../../domain/krok"
import { KROK_CITY_SECTORS, KROK_CITY_SECTOR_SIZE, KROK_RESIDENTS } from "../../domain/krokCityLayout"
import { KROK_CITY_ROADS, isOnRoad } from "../../domain/roads"
import type { KrokErrandId, LocationId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { RoadCollisionController } from "../RoadCollisionController"
import { FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"
import { NpcController } from "../animation/NpcController"
import { KrokRoofOcclusion } from "../KrokRoofOcclusion"
import { KrokStreetSeams } from "../KrokStreetSeams"

interface CityObject {
  id: string
  type: string
  x: number
  y: number
  marker: Phaser.GameObjects.GameObject
}

export class KrokCityScene extends BaseWorldScene {
  private interactables: CityObject[] = []
  private nearest: CityObject | null = null
  private lastPrompt = ""
  private readonly roadCollision = new RoadCollisionController(KROK_CITY_ROADS)
  private residents!: NpcController
  private roofOcclusion!: KrokRoofOcclusion

  constructor() { super("krok-city") }

  preload(): void {
    if (!this.cache.tilemap.exists("krok-city-map")) this.load.tilemapTiledJSON("krok-city-map", "assets/maps/krok-city.tmj")
    for (const background of new Set(KROK_CITY_SECTORS.map(({ background }) => background))) {
      const key = `krok-city-${background}-organic-v3`
      if (!this.textures.exists(key)) this.load.image(key, `assets/world/${key}.jpg`)
    }
    for (const role of ["guard", "prince", "resident", "merchant"]) {
      if (!this.textures.exists(`krok-${role}`)) this.load.image(`krok-${role}`, `assets/npc/krok-${role}.png`)
    }
    for (const id of ["dense-tomato", "large-cucumber"]) {
      if (!this.textures.exists(id)) this.load.image(id, `assets/items/${id}.png`)
    }
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) { this.scene.start("main-menu"); return }
    if (gameStore.state.chapter < 3 || !gameStore.state.krokSiegeCleared) {
      this.scene.start(gameStore.state.chapter < 3 ? "forest-village" : "krok-outskirts")
      return
    }
    gameStore.setLocation("krok-city")
    this.interactables = []
    this.nearest = null
    this.lastPrompt = ""
    this.cameras.main.setBackgroundColor("#a9d1df")
    this.createCityTerrain()
    const from = gameStore.state.entryFrom
    const spawn = from === "ice-palace" ? { x: 9300, y: 2400 } : { x: 300, y: 800 }
    const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
    const debugX = Number(params?.get("x"))
    const debugY = Number(params?.get("y"))
    if (params?.has("x") && params.has("y") && Number.isFinite(debugX) && Number.isFinite(debugY)) {
      spawn.x = Phaser.Math.Clamp(debugX, 100, KROK_CITY_SIZE.width - 100)
      spawn.y = Phaser.Math.Clamp(debugY, 100, KROK_CITY_SIZE.height - 100)
    }
    this.setupWorld(character, KROK_CITY_SIZE.width, KROK_CITY_SIZE.height, spawn.x, spawn.y, character.id === "watermelon" ? 96 : 102, character.id === "watermelon" ? 112 : 140)
    this.roadCollision.track(this.player, true)
    // The map now describes actual buildings, not four huge solid quarters.
    // Keep these footprints intact: roads must never carve through a house.
    this.loadMapCollisions("krok-city-map")
    this.residents = new NpcController(this, this.player, "krok-city-map", ({ x, y }) => isOnRoad(KROK_CITY_ROADS, x, y))
    this.createObjects()
    this.updateDiagnostics()
    updateGameStatus("krok-city", "Мирный город Кроков. Найди Принца в восточном квартале.")
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.cameras.main.fadeIn(280, 65, 105, 150)
    this.time.delayedCall(350, () => EventBus.emit(GameEvents.showMessage, "Город Кроков: овощи на северной рыночной улице, аптека — на южной. Принц ждёт на востоке.", 5000))
  }

  private createCityTerrain(): void {
    // Keep buildings, snow, courtyards and lamplight in the same painting.
    // No detached house sprites or rectangular paving overlays on top of it.
    const { width, height } = KROK_CITY_SECTOR_SIZE
    this.roofOcclusion = new KrokRoofOcclusion(this)
    for (const [index, { background }] of KROK_CITY_SECTORS.entries()) {
      this.add.image(index % 4 * width, Math.floor(index / 4) * height, `krok-city-${background}-organic-v3`)
        .setOrigin(0).setDisplaySize(width, height).setDepth(-2)
      this.roofOcclusion.addSector(`krok-city-${background}-organic-v3`, index % 4 * width, Math.floor(index / 4) * height, width)
    }
    new KrokStreetSeams(this).addSectorStreets(KROK_CITY_SECTORS.map(({ background }) => `krok-city-${background}-organic-v3`), 4, width, height)
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) return
    this.updateWorldInput(Math.min(delta, 50))
    this.roofOcclusion.update(this.player)
    const onRoad = this.roadCollision.constrain(this.player)
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) status.dataset.playerOnRoad = String(onRoad)
    if (this.modalOpen) return
    this.findNearest()
    if (this.interactionPressed() && this.nearest) this.interact(this.nearest)
  }

  private createObjects(): void {
    for (const object of this.mapObjects("krok-city-map")) {
      if (!object.name || !object.type) continue
      const x = object.x ?? 0
      const y = object.y ?? 0
      let marker: Phaser.GameObjects.GameObject
      let residentImage: Phaser.GameObjects.Image | undefined
      let residentTitle: Phaser.GameObjects.Text | undefined
      if (["quest", "merchant", "prince", "resident", "guard"].includes(object.type)) {
        const role = object.type === "quest" || object.type === "resident" ? "resident" : object.type
        const sprite = this.add.image(x, y, `krok-${role}`).setDisplaySize(role === "guard" ? 116 : 135, role === "prince" ? 178 : 155).setDepth(y + 8)
        residentImage = sprite
        marker = sprite
        const title = object.type === "quest" ? KROK_ERRANDS[object.name as KrokErrandId]?.npcName : object.type === "prince" ? "Крок-Принц" : object.type === "merchant" ? object.name === "market-potions" ? "Аптекарь" : "Торговец" : object.type === "guard" ? "Стражник-Крок" : KROK_RESIDENTS[object.name]?.name ?? "Житель Кроков"
        residentTitle = this.add.text(x, y - 108, title ?? "Крок", { fontFamily: FONT, fontSize: "17px", color: "#fffaf0", backgroundColor: "#173b57dd", padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(y + 20)
      } else if (object.type === "portal") {
        marker = this.add.text(x, y - 75, object.name === "ice-palace" ? "ЛЕДЯНОЙ ДВОРЕЦ →" : "← КРЕПОСТНЫЕ ВОРОТА", { fontFamily: FONT, fontSize: "19px", fontStyle: "bold", color: "#ffffff", backgroundColor: "#173b57dd", padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(y + 20)
      } else {
        const errand = object.type as KrokErrandId
        if (!(errand in KROK_ERRANDS)) continue
        const completed = gameStore.state.krokErrands[errand].completedTargets.includes(object.name)
        marker = this.add.text(x, y, completed ? "✓" : KROK_ERRANDS[errand].icon, { fontFamily: FONT, fontSize: "36px", color: completed ? "#b3e7c7" : "#fffaf0", backgroundColor: "#173b5799", padding: { x: 6, y: 2 } }).setOrigin(0.5).setDepth(y + 20)
      }
      const target: CityObject = { id: object.name, type: object.type, x, y, marker }
      if (residentImage) this.residents.add(target.id, residentImage, residentTitle, target)
      this.interactables.push(target)
    }
  }

  private findNearest(): void {
    this.nearest = null
    let bestDistance = 140
    for (const object of this.interactables) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, object.x, object.y)
      if (distance < bestDistance) { bestDistance = distance; this.nearest = object }
    }
    const prompt = this.nearest ? `E — ${this.nearest.type === "portal" ? "перейти" : this.nearest.type === "merchant" ? "торговать" : this.nearest.type === "quest" || this.nearest.type === "prince" ? "поговорить" : "осмотреть"}` : ""
    if (prompt !== this.lastPrompt) { this.lastPrompt = prompt; EventBus.emit(GameEvents.promptChanged, prompt) }
  }

  private interact(object: CityObject): void {
    if (["quest", "merchant", "prince", "resident", "guard"].includes(object.type)) this.residents.talk(object.id, 5000)
    if (object.type === "portal") {
      if (object.id === "ice-palace" && !gameStore.canEnterIcePalace()) {
        EventBus.emit(GameEvents.showMessage, "Дворцовый проход откроется после поручения Принца.", 2400)
        return
      }
      this.transitionTo(object.id, object.id as LocationId)
      return
    }
    if (object.type === "merchant") {
      EventBus.emit(object.id === "market-potions" ? GameEvents.openKrokPotions : GameEvents.openKrokMarket)
      return
    }
    if (object.type === "prince") {
      if (gameStore.state.princeQuest.status === "available") {
        gameStore.acceptPrinceQuest()
        EventBus.emit(GameEvents.showDialogue, "Крок-Принц: Спасибо за крепость! Во дворце Морж удерживает трон. Найди и победи его — проход открыт.", 5000)
      } else if (gameStore.state.princeQuest.status === "ready") {
        gameStore.turnInPrinceQuest()
        EventBus.emit(GameEvents.showDialogue, "Крок-Принц: Ты победил Моржа! Возьми Печать Кроков и восемь шестерёнок.", 4500)
      } else EventBus.emit(GameEvents.showDialogue, gameStore.state.princeQuest.status === "completed" ? "Крок-Принц: Кроки навсегда запомнят твою помощь." : "Крок-Принц: Дорога ко дворцу открыта. Мы ждём вестей о Морже.", 3400)
      this.updateDiagnostics()
      return
    }
    if (object.type === "quest") {
      const id = object.id as KrokErrandId
      const status = gameStore.state.krokErrands[id].status
      if (status === "available") {
        gameStore.acceptKrokErrand(id)
        EventBus.emit(GameEvents.showDialogue, `${KROK_ERRANDS[id].npcName}: ${KROK_ERRANDS[id].description} Поможешь?`, 4200)
      } else if (status === "ready") {
        gameStore.turnInKrokErrand(id)
        EventBus.emit(GameEvents.showDialogue, `${KROK_ERRANDS[id].npcName}: Спасибо за помощь! Вот четыре шестерёнки.`, 3600)
      } else EventBus.emit(GameEvents.showDialogue, status === "completed" ? `${KROK_ERRANDS[id].npcName}: Твоя помощь очень пригодилась!` : `${KROK_ERRANDS[id].npcName}: Успехи уже есть, продолжай!`, 3200)
      this.updateDiagnostics()
      return
    }
    if (object.type in KROK_ERRANDS) {
      const id = object.type as KrokErrandId
      if (gameStore.completeKrokTarget(id, object.id)) {
        if (object.marker instanceof Phaser.GameObjects.Text) object.marker.setText("✓")
        EventBus.emit(GameEvents.showMessage, `${KROK_ERRANDS[id].icon} ${KROK_ERRANDS[id].title}: ${gameStore.state.krokErrands[id].completedTargets.length}/${KROK_ERRANDS[id].target}`, 2000)
      } else EventBus.emit(GameEvents.showMessage, gameStore.state.krokErrands[id].status === "available" ? `Сначала поговори с ${KROK_ERRANDS[id].npcName}.` : "Уже выполнено.", 1600)
      this.updateDiagnostics()
      return
    }
    const lines = object.type === "guard"
      ? ["Стражник-Крок: Стены снова наши. Копья наготове.", "Стражник-Крок: Принц ждёт тебя на востоке."]
      : KROK_RESIDENTS[object.id]?.lines ?? ["Житель Кроков: Добро пожаловать в наш город!"]
    EventBus.emit(GameEvents.showDialogue, lines[object.id.length % lines.length], 3300)
  }

  private updateDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.krokErrands = Object.entries(gameStore.state.krokErrands).map(([id, item]) => `${id}:${item.status}:${item.completedTargets.length}`).join(",")
    status.dataset.princeQuest = gameStore.state.princeQuest.status
    status.dataset.krokGateOpen = String(gameStore.state.krokSiegeCleared)
  }
}
