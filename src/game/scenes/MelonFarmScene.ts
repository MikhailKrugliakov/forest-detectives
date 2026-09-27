import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { gameStore } from "../../domain/GameStore"
import type { LocationId, SurfaceResourceId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { FONT } from "../ui"
import { addResourceNode, collectResourceNode, resourceIdFromObjectType, resourcePrompt, type RuntimeResourceNode } from "../WorldResources"
import { BaseWorldScene } from "./BaseWorldScene"
import { NpcController } from "../animation/NpcController"

type FarmKind = "npc" | "hero" | "portal" | "resource"

interface FarmObject {
  id: string
  kind: FarmKind
  x: number
  y: number
  label: string
  resource?: RuntimeResourceNode
  resourceId?: SurfaceResourceId
}

const NPCS: Record<string, { asset: string; label: string; dialogue: string; width: number }> = {
  "aunt-melon": {
    asset: "npc-aunt-melon",
    label: "Тётя Дыня",
    dialogue: "«На нашей ферме тихо: только грядки, ручей и добрые соседи. Заглядывай почаще!»",
    width: 150,
  },
  "melon-mitya": {
    asset: "npc-melon-resident",
    label: "Дынька Митя",
    dialogue: "«Я считаю пчёл над подсолнухами. Сегодня их уже семнадцать!»",
    width: 118,
  },
  "melon-lada": {
    asset: "npc-melon-resident",
    label: "Дынька Лада",
    dialogue: "«Если постучать по спелой дыне, она отвечает самым звонким голосом.»",
    width: 112,
  },
  "watermelon-senya": {
    asset: "npc-watermelon-resident",
    label: "Арбуз Сеня",
    dialogue: "«Мы собрали семечки для весенней посадки. Ни одно не потерялось!»",
    width: 122,
  },
  "watermelon-anya": {
    asset: "npc-watermelon-resident",
    label: "Арбузка Аня",
    dialogue: "«Лучшее место для отдыха — тёплая грядка возле водяного канала.»",
    width: 116,
  },
}

const PORTAL_LABELS: Record<string, string> = {
  "forest-village": "← В ДЕРЕВНЮ",
  "watermelon-home": "ДОМИК АРБУЗИКА",
}

export class MelonFarmScene extends BaseWorldScene {
  private objects: FarmObject[] = []
  private nearest: FarmObject | null = null
  private lastPrompt = ""
  private residents!: NpcController

  constructor() {
    super("melon-farm")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("character-select")
      return
    }
    gameStore.setLocation("melon-farm")
    this.objects = []
    this.nearest = null
    this.lastPrompt = ""
    this.cameras.main.setBackgroundColor("#8fb05b")
    this.add.image(1200, 800, "melon-farm-bg").setDisplaySize(2400, 1600).setDepth(0)
    const spawn = gameStore.state.entryFrom === "watermelon-home"
      ? { x: 1890, y: 1270 }
      : gameStore.state.entryFrom === "forest-village"
        ? { x: 430, y: 1375 }
        : character.id === "watermelon"
          ? { x: 1285, y: 735 }
          : { x: 430, y: 1375 }
    this.setupWorld(
      character,
      2400,
      1600,
      spawn.x,
      spawn.y,
      character.id === "watermelon" ? 96 : 102,
      character.id === "watermelon" ? 112 : 140,
    )
    this.loadMapCollisions("melon-farm-map")
    this.residents = new NpcController(this, this.player, "melon-farm-map")
    this.createMapObjects()
    updateGameStatus(
      "melon-farm",
      character.id === "watermelon"
        ? "Ферма тёти Дыни. Арбузик начинает прогулку на своей грядке."
        : "Ферма тёти Дыни. Мирная локация без врагов.",
    )
    this.cameras.main.fadeIn(300, 28, 68, 42)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.time.delayedCall(350, () => {
      EventBus.emit(
        GameEvents.showMessage,
        character.id === "watermelon"
          ? "Арбузик проснулся прямо в любимой грядке. На ферме сегодня спокойно."
          : "На ферме нет врагов. Поговори с арбузами и дынями или загляни в домик Арбузика.",
        4600,
      )
    })
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) return
    this.updateWorldInput(Math.min(delta, 50))
    if (this.modalOpen) return
    this.updateNearest()
    if (!this.interactionPressed() || !this.nearest) return
    if (this.nearest.kind === "portal") {
      const location = this.nearest.id as LocationId
      if (location === "forest-village") this.transitionTo("forest-village", location)
      else this.transitionTo("hero-home", location)
      return
    }
    if (this.nearest.kind === "resource" && this.nearest.resource) {
      if (!collectResourceNode(this.nearest.resource)) return
      const resourceId = this.nearest.resourceId
      this.objects = this.objects.filter((candidate) => candidate !== this.nearest)
      EventBus.emit(
        GameEvents.showMessage,
        resourceId === "scrap" ? "🧰 В старом механизме найдено ⚙️ 10." : "Ресурс убран в рюкзак.",
        2200,
      )
      return
    }
    if (this.nearest.id === "aunt-melon") {
      this.residents.talk(this.nearest.id)
      EventBus.emit(GameEvents.openProduceShop)
      return
    }
    this.residents.talk(this.nearest.id)
    EventBus.emit(GameEvents.showDialogue, `${this.nearest.label}: ${NPCS[this.nearest.id]?.dialogue ?? "«Привет!»"}`, 4200)
  }

  private createMapObjects(): void {
    const selected = gameStore.state.character?.id
    for (const object of this.mapObjects("melon-farm-map")) {
      const id = object.name
      const type = object.type
      const x = object.x ?? 0
      const y = object.y ?? 0
      if (!id || !type || type === "spawn") continue
      const resourceId = resourceIdFromObjectType(type)
      if (resourceId) {
        const resource = addResourceNode(this, id, resourceId, x, y)
        if (resource) this.objects.push({ id, kind: "resource", x, y, label: resourceId, resource, resourceId })
        continue
      }
      if (type === "portal") {
        const label = PORTAL_LABELS[id]
        if (!label) continue
        this.add.text(x, y - 68, label, {
          fontFamily: FONT,
          fontSize: "18px",
          fontStyle: "bold",
          color: "#fff4cf",
          backgroundColor: "#173f38dd",
          padding: { x: 11, y: 6 },
        }).setOrigin(0.5).setDepth(y + 20)
        this.objects.push({ id, kind: "portal", x, y, label })
        continue
      }
      if (type === "hero" && selected !== "watermelon") {
        const target: FarmObject = { id: "watermelon-hero", kind: "hero", x, y, label: "Арбузик" }
        this.addResident("hero-watermelon", "Арбузик", x, y, 118, 132, target)
        this.objects.push(target)
        NPCS["watermelon-hero"] = {
          asset: "hero-watermelon",
          label: "Арбузик",
          dialogue: "«Вот моя любимая грядка! Отсюда лучше всего начинать фермерское расследование.»",
          width: 118,
        }
        continue
      }
      const npc = NPCS[id]
      if (!npc) continue
      const target: FarmObject = { id, kind: "npc", x, y, label: npc.label }
      this.addResident(npc.asset, npc.label, x, y, npc.width, npc.width * 1.22, target)
      this.objects.push(target)
    }
  }

  private addResident(asset: string, label: string, x: number, y: number, width: number, height: number, target: FarmObject): void {
    const image = this.add.image(x, y, asset).setDisplaySize(width, height).setDepth(y + 20)
    const title = this.add.text(x, y + height * 0.55, label, {
      fontFamily: FONT,
      fontSize: "15px",
      fontStyle: "bold",
      color: "#fff4cf",
      backgroundColor: "#173f38dd",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(y + 40)
    this.residents.add(target.id, image, title, target)
  }

  private updateNearest(): void {
    this.nearest = null
    let best = Number.POSITIVE_INFINITY
    for (const object of this.objects) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, object.x, object.y)
      const radius = object.kind === "portal" ? 120 : 130
      if (distance < radius && distance < best) {
        best = distance
        this.nearest = object
      }
    }
    const prompt = this.nearest?.kind === "portal"
      ? `E — ${this.nearest.label.toLowerCase()}`
      : this.nearest?.kind === "resource"
        ? resourcePrompt(this.nearest.resourceId!)
      : this.nearest?.id === "aunt-melon"
        ? "E — купить овощи"
      : this.nearest
        ? "E — поговорить"
        : ""
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }
}
