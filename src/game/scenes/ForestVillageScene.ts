import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { CHARACTERS } from "../../domain/characters"
import { gameStore } from "../../domain/GameStore"
import { ERRANDS } from "../../domain/village"
import type { CharacterId, ErrandId, LocationId, QuestId, SurfaceResourceId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { FONT } from "../ui"
import { addResourceNode, collectResourceNode, resourceIdFromObjectType, resourcePrompt, type RuntimeResourceNode } from "../WorldResources"
import { BaseWorldScene } from "./BaseWorldScene"

type VillageKind = "quest" | "errand" | "hero" | "portal" | "task" | "materials" | "resource"

interface VillageObject {
  id: string
  kind: VillageKind
  x: number
  y: number
  label: string
  marker?: Phaser.GameObjects.Text
  taskId?: ErrandId
  resource?: RuntimeResourceNode
  resourceId?: SurfaceResourceId
}

const QUEST_NPCS: Record<string, { asset: string; label: string }> = {
  "lost-letters": { asset: "npc-squirrel", label: "Белочка-почтальон" },
  "robot-parts": { asset: "npc-beaver", label: "Бобр-мастер" },
  "robot-sweep": { asset: "npc-owl", label: "Сова-хранительница" },
}

const ERRAND_NPCS: Record<ErrandId, { asset: string; label: string }> = {
  "garden-beds": { asset: "npc-tim", label: "Ёжик Тим" },
  "bakery-delivery": { asset: "npc-marta", label: "Барсучиха Марта" },
  "village-lanterns": { asset: "npc-filya", label: "Енот Филя" },
  "mushroom-hunt": { asset: "npc-zlata", label: "Медведица Злата" },
  "fence-repair": { asset: "npc-luchik", label: "Козлик Лучик" },
  "trail-signs": { asset: "npc-kvak", label: "Лягушонок Квак" },
}

const TASK_ICONS: Record<ErrandId, string> = {
  "garden-beds": "💧",
  "bakery-delivery": "🥐",
  "village-lanterns": "🏮",
  "mushroom-hunt": "🍄",
  "fence-repair": "🔨",
  "trail-signs": "🪧",
}

const PORTAL_LABELS: Partial<Record<LocationId, string>> = {
  "mole-shop": "МАГАЗИН КРОТА",
  "beaver-house": "ДОМ БОБРА",
  "wolf-home": "ДОМ ВОЛЧОНКА",
  "fox-home": "ДОМ ЛИСИЧКИ",
  "rabbit-home": "ДОМ ЗАЙЧОНКА",
  "sheepwolf-home": "ДОМ ОВЦЕВОЛКА",
  "wild-forest": "ДИКИЙ ЛЕС →",
  "melon-farm": "ФЕРМА ТЁТИ ДЫНИ →",
}

const VILLAGE_ENTRY_SPAWNS: Partial<Record<LocationId, { x: number; y: number }>> = {
  "wild-forest": { x: 2180, y: 455 },
  "melon-farm": { x: 1440, y: 1390 },
  "mole-shop": { x: 1360, y: 805 },
  "beaver-house": { x: 970, y: 1080 },
  "wolf-home": { x: 390, y: 620 },
  "fox-home": { x: 2040, y: 765 },
  "rabbit-home": { x: 970, y: 1430 },
  "sheepwolf-home": { x: 2100, y: 1370 },
}

const HERO_START_SPAWNS: Record<CharacterId, { x: number; y: number }> = {
  wolf: { x: 390, y: 620 },
  fox: { x: 2040, y: 765 },
  rabbit: { x: 970, y: 1430 },
  sheepwolf: { x: 2100, y: 1370 },
  watermelon: { x: 1440, y: 1390 },
}

export class ForestVillageScene extends BaseWorldScene {
  private objects: VillageObject[] = []
  private nearest: VillageObject | null = null
  private lastPrompt = ""

  constructor() {
    super("forest-village")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("character-select")
      return
    }
    if (gameStore.state.chapter !== 2) gameStore.beginVillageChapter()
    else gameStore.setLocation("forest-village")

    this.objects = []
    this.nearest = null
    this.lastPrompt = ""
    this.cameras.main.setBackgroundColor("#6f9e58")
    this.add.image(-1200, 800, "forest-village-west-bg").setDisplaySize(2400, 1600).setDepth(0)
    this.add.image(1200, 800, "forest-village-bg").setDisplaySize(2400, 1600).setDepth(0)
    const entryFrom = gameStore.state.entryFrom
    const spawn = entryFrom === "forest-clearing"
      ? HERO_START_SPAWNS[character.id]
      : (entryFrom ? VILLAGE_ENTRY_SPAWNS[entryFrom] : undefined) ?? { x: 1200, y: 1010 }
    this.setupWorld(
      character,
      4800,
      1600,
      spawn.x,
      spawn.y,
      character.id === "watermelon" ? 96 : 102,
      character.id === "watermelon" ? 112 : 140,
      -2400,
      0,
    )
    this.loadMapCollisions("forest-village-map")
    this.createMapObjects()
    this.add.text(-180, 790, "←  ЗАПАДНЫЙ РАЙОН", {
      fontFamily: FONT,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#fff4cf",
      backgroundColor: "#173f38dd",
      padding: { x: 11, y: 6 },
    }).setOrigin(0.5).setDepth(820)
    // Accessibility reports the location as ready only after controls, portals,
    // and the debug/test bridge have been attached by setupWorld().
    updateGameStatus("forest-village", `Расширенная деревня. Герой: ${character.name}.`)
    this.cameras.main.fadeIn(300, 23, 63, 56)

    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.time.delayedCall(350, () => {
      EventBus.emit(
        GameEvents.showMessage,
        gameStore.state.villageSaved
          ? "В деревне снова спокойно. Магазин и все дома остаются открыты!"
          : "Исследуй дома и новый западный район, помоги соседям и загляни к дядюшке Кроту.",
        5200,
      )
    })
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) return
    this.updateWorldInput(delta)
    if (this.modalOpen) return
    this.updateNearest()
    if (!this.interactionPressed() || !this.nearest) return
    this.interact(this.nearest)
  }

  private createMapObjects(): void {
    const selected = gameStore.state.character?.id
    const mapObjects = this.mapObjects("forest-village-map")
    mapObjects.forEach((object) => {
      const id = object.name
      const type = object.type
      const x = object.x ?? 0
      const y = object.y ?? 0
      if (!id || !type || type === "spawn") return

      const resourceId = resourceIdFromObjectType(type)
      if (resourceId) {
        const resource = addResourceNode(this, id, resourceId, x, y)
        if (resource) this.objects.push({ id, kind: "resource", x, y, label: resourceId, resource, resourceId })
        return
      }

      if (type === "quest" && QUEST_NPCS[id]) {
        const npc = QUEST_NPCS[id]
        this.addNpc(npc.asset, npc.label, x, y, id === "robot-sweep" ? 150 : 135)
        this.objects.push({ id, kind: "quest", x, y, label: npc.label })
        return
      }
      if (type === "errand" && id in ERRAND_NPCS) {
        const errandId = id as ErrandId
        const npc = ERRAND_NPCS[errandId]
        this.addNpc(npc.asset, npc.label, x, y, 135)
        this.objects.push({ id, kind: "errand", x, y, label: npc.label })
        return
      }
      if (type === "hero") {
        const heroId = id as CharacterId
        if (heroId === selected || heroId === "watermelon") return
        const hero = CHARACTERS.find(({ id: candidate }) => candidate === heroId)
        if (!hero) return
        this.addNpc(hero.assetKey, hero.name, x, y, 105)
        this.objects.push({ id, kind: "hero", x, y, label: hero.name })
        return
      }
      if (type === "portal") {
        const location = id as LocationId
        const label = PORTAL_LABELS[location]
        if (!label) return
        this.addPortalLabel(x, y, label)
        this.objects.push({ id, kind: "portal", x, y, label })
        return
      }
      if (type === "materials") {
        const marker = this.add
          .text(x, y, "🧰", { fontFamily: FONT, fontSize: "38px" })
          .setOrigin(0.5)
          .setDepth(y + 20)
        this.add
          .text(x, y + 50, "Материалы Бобра", {
            fontFamily: FONT,
            fontSize: "15px",
            fontStyle: "bold",
            color: "#fff4cf",
            backgroundColor: "#173f38dd",
            padding: { x: 8, y: 4 },
          })
          .setOrigin(0.5)
          .setDepth(y + 21)
        this.objects.push({ id, kind: "materials", x, y, label: "материалы Бобра", marker })
        return
      }
      if (type in ERRANDS) {
        const taskId = type as ErrandId
        // The squirrel and owl are both quest NPCs and bakery recipients.
        // Their delivery is handled by the quest-NPC interaction above; adding
        // a second object at the exact same point makes nearest selection
        // ambiguous and can hide the main quest dialog.
        if (taskId === "bakery-delivery" && (id === "squirrel" || id === "owl")) return
        const icon = TASK_ICONS[taskId]
        const marker = this.add
          .text(x, y, icon, { fontFamily: FONT, fontSize: "35px" })
          .setOrigin(0.5)
          .setDepth(y + 15)
          .setAlpha(this.taskDone(taskId, id) ? 0.28 : 1)
        this.objects.push({ id, kind: "task", taskId, x, y, label: ERRANDS[taskId].title, marker })
      }
    })
  }

  private addNpc(asset: string, label: string, x: number, y: number, width: number): void {
    const image = this.add.image(x, y, asset).setDisplaySize(width, width * 1.35).setDepth(y + 20)
    if (asset === "hero-watermelon") image.setDisplaySize(112, 125)
    this.add
      .text(x, y + width * 0.82, label, {
        fontFamily: FONT,
        fontSize: "16px",
        fontStyle: "bold",
        color: "#fff4cf",
        backgroundColor: "#173f38dd",
        padding: { x: 9, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(y + 40)
    const blocker = this.add.rectangle(x, y + width * 0.28, width * 0.42, width * 0.3, 0x000000, 0)
    this.physics.add.existing(blocker, true)
    this.physics.add.collider(this.player, blocker)
  }

  private addPortalLabel(x: number, y: number, label: string): void {
    this.add
      .text(x, y - 72, label, {
        fontFamily: FONT,
        fontSize: "17px",
        fontStyle: "bold",
        color: "#fff4cf",
        backgroundColor: "#173f38dd",
        padding: { x: 11, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(y + 10)
  }

  private updateNearest(): void {
    this.nearest = null
    let best = Number.POSITIVE_INFINITY
    for (const object of this.objects) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, object.x, object.y)
      const radius = object.kind === "portal" ? 105 : 125
      if (distance < radius && distance < best) {
        if (object.kind === "task" && object.taskId && this.taskDone(object.taskId, object.id)) continue
        best = distance
        this.nearest = object
      }
    }

    let prompt = ""
    if (this.nearest?.kind === "portal") prompt = `E — ${this.nearest.label.toLowerCase()}`
    else if (this.nearest?.kind === "materials") prompt = "E — посмотреть материалы Бобра"
    else if (this.nearest?.kind === "task") prompt = `E — ${this.taskPrompt(this.nearest.taskId!)}`
    else if (this.nearest?.kind === "resource") prompt = resourcePrompt(this.nearest.resourceId!)
    else if (this.nearest) prompt = "E — поговорить"
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private interact(object: VillageObject): void {
    if (object.kind === "quest") {
      const deliveryTarget = object.id === "lost-letters" ? "squirrel" : object.id === "robot-sweep" ? "owl" : null
      if (
        deliveryTarget &&
        gameStore.state.errands["bakery-delivery"].status === "active" &&
        this.tryTask("bakery-delivery", deliveryTarget)
      ) return
      if (object.id === "robot-parts") {
        const parts = gameStore.state.quests["robot-parts"].status
        const security = gameStore.state.quests["beaver-security"].status
        const questId = parts === "available" || parts === "ready" || security === "completed"
          ? "robot-parts"
          : "beaver-security"
        EventBus.emit(GameEvents.openQuest, questId)
      } else {
        EventBus.emit(GameEvents.openQuest, object.id as QuestId)
      }
      return
    }
    if (object.kind === "errand") {
      EventBus.emit(GameEvents.openErrand, object.id as ErrandId)
      return
    }
    if (object.kind === "hero") {
      const hero = CHARACTERS.find(({ id }) => id === object.id)
      EventBus.emit(
        GameEvents.showDialogue,
        hero ? `${hero.name}: «Загляни ко мне домой — там осталось небольшое испытание!»` : "Привет!",
        3200,
      )
      return
    }
    if (object.kind === "task" && object.taskId) {
      this.tryTask(object.taskId, object.id, object.marker)
      return
    }
    if (object.kind === "materials") {
      EventBus.emit(GameEvents.openMaterials)
      return
    }
    if (object.kind === "resource" && object.resource) {
      if (!collectResourceNode(object.resource)) return
      this.objects = this.objects.filter((candidate) => candidate !== object)
      EventBus.emit(
        GameEvents.showMessage,
        object.resourceId === "scrap" ? "🧰 Хлам разобран: найдено ⚙️ 10." : `${object.resource.resourceId === "stone" ? "🪨" : object.resource.resourceId === "stick" ? "🪵" : "🧶"} Ресурс убран в рюкзак.`,
        2200,
      )
      return
    }
    this.enterPortal(object.id as LocationId)
  }

  private tryTask(id: ErrandId, targetId: string, marker?: Phaser.GameObjects.Text): boolean {
    const status = gameStore.state.errands[id].status
    if (status === "available") {
      EventBus.emit(GameEvents.showMessage, `Сначала поговори: ${ERRANDS[id].npcName} ждёт рядом.`, 2600)
      return true
    }
    if (status !== "active") return false
    const completed = gameStore.completeErrandTarget(id, targetId)
    if (!completed) return false
    marker?.setAlpha(0.28)
    const current = gameStore.errandProgress(id)
    EventBus.emit(
      GameEvents.showMessage,
      current >= ERRANDS[id].target
        ? `${ERRANDS[id].icon} Готово! Вернись к ${ERRANDS[id].npcName}.`
        : `${ERRANDS[id].icon} ${current}/${ERRANDS[id].target}`,
      2600,
    )
    return true
  }

  private enterPortal(location: LocationId): void {
    if (location === "wild-forest") {
      if (!gameStore.hasAcceptedQuest()) {
        EventBus.emit(GameEvents.showMessage, "Сначала возьми хотя бы одно основное задание.", 2800)
        return
      }
      this.transitionTo("wild-forest", location)
      return
    }
    if (location === "beaver-house" && gameStore.state.quests["beaver-security"].status === "available") {
      EventBus.emit(GameEvents.openQuest, "beaver-security")
      return
    }
    if (location === "mole-shop") {
      this.transitionTo("mole-shop", location)
      return
    }
    if (location === "melon-farm") {
      this.transitionTo("melon-farm", location)
      return
    }
    if (location === "beaver-house") {
      this.transitionTo("beaver-house", location)
      return
    }
    if (location.endsWith("-home")) this.transitionTo("hero-home", location)
  }

  private taskDone(id: ErrandId, targetId: string): boolean {
    return gameStore.state.errands[id].completedTargets.includes(targetId)
  }

  private taskPrompt(id: ErrandId): string {
    if (id === "garden-beds") return "полить клумбу"
    if (id === "bakery-delivery") return "вручить корзинку"
    if (id === "village-lanterns") return "зажечь фонарь"
    if (id === "mushroom-hunt") return "собрать корзинку грибов"
    if (id === "fence-repair") return "починить ограду"
    return "установить указатель"
  }
}
