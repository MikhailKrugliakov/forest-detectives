import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { gameStore } from "../../domain/GameStore"
import { createMineOreLayout, RESOURCES } from "../../domain/resources"
import { EventBus, GameEvents } from "../EventBus"
import { FONT } from "../ui"
import { addResourceNode, collectResourceNode, resourcePrompt, type RuntimeResourceNode } from "../WorldResources"
import { BaseWorldScene } from "./BaseWorldScene"

const EXIT = { x: 165, y: 1390 }

export class ForestMineScene extends BaseWorldScene {
  private ores: RuntimeResourceNode[] = []
  private nearestOre: RuntimeResourceNode | null = null
  private atExit = false
  private lastPrompt = ""

  constructor() {
    super("forest-mine")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("character-select")
      return
    }
    this.ores = []
    this.nearestOre = null
    this.atExit = false
    this.lastPrompt = ""
    gameStore.setLocation("forest-mine")
    this.cameras.main.setBackgroundColor("#111d22")
    this.add.image(1200, 800, "forest-mine-bg").setDisplaySize(2400, 1600).setDepth(0)
    this.setupWorld(
      character,
      2400,
      1600,
      220,
      1330,
      character.id === "watermelon" ? 96 : 102,
      character.id === "watermelon" ? 112 : 140,
    )
    this.loadMapCollisions("forest-mine-map")
    this.createOres()
    this.add.text(EXIT.x, EXIT.y + 46, "← ДИКИЙ ЛЕС", {
      fontFamily: FONT,
      fontSize: "19px",
      fontStyle: "bold",
      color: "#fff4cf",
      backgroundColor: "#173f38dd",
      padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setDepth(1750)
    updateGameStatus(
      "forest-mine",
      gameStore.state.hasPickaxe
        ? "Лесная шахта. Кирка готова — здесь можно добывать железо и алмазы."
        : "Лесная шахта. Для добычи руды нужно создать кирку в инвентаре.",
    )
    this.cameras.main.fadeIn(300, 10, 18, 22)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    this.time.delayedCall(350, () => {
      EventBus.emit(
        GameEvents.showMessage,
        gameStore.state.hasPickaxe
          ? "Подойди к залежи и нажми E, чтобы добыть руду."
          : "Собери 3 камня, 2 палки, верёвку и хлам. Кирка создаётся во вкладке «Ресурсы».",
        4800,
      )
    })
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) return
    this.updateWorldInput(Math.min(delta, 50))
    if (this.modalOpen) return
    this.updateNearest()
    if (!this.interactionPressed()) return
    if (this.nearestOre) {
      this.mine(this.nearestOre)
      return
    }
    if (this.atExit) this.transitionTo("wild-forest", "wild-forest")
  }

  private createOres(): void {
    const slots = this.mapObjects("forest-mine-map").filter(({ type }) => type === "ore-slot")
    const layout = createMineOreLayout(gameStore.state.mineSeed, slots.map(({ name }) => name))
    const typeById = new Map(layout.map(({ id, resourceId }) => [id, resourceId]))
    for (const slot of slots) {
      const resourceId = typeById.get(slot.name)
      if (!resourceId) continue
      const ore = addResourceNode(this, slot.name, resourceId, slot.x ?? 0, slot.y ?? 0)
      if (ore) this.ores.push(ore)
    }
    this.updateDiagnostics()
  }

  private updateNearest(): void {
    this.nearestOre = null
    let best = Number.POSITIVE_INFINITY
    for (const ore of this.ores) {
      if (!ore.marker.active) continue
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, ore.x, ore.y)
      if (distance < 115 && distance < best) {
        best = distance
        this.nearestOre = ore
      }
    }
    this.atExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, EXIT.x, EXIT.y) < 145
    const prompt = this.nearestOre
      ? resourcePrompt(this.nearestOre.resourceId)
      : this.atExit
        ? "E — вернуться в Дикий лес"
        : ""
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private mine(ore: RuntimeResourceNode): void {
    if (!gameStore.state.hasPickaxe) {
      EventBus.emit(GameEvents.showMessage, "⛏️ Сначала создай кирку: I → Ресурсы.", 2400)
      return
    }
    const swing = this.add.text(this.player.x + 35, this.player.y - 30, "⛏️", {
      fontFamily: FONT,
      fontSize: "40px",
    }).setOrigin(0.5).setDepth(2300).setAngle(-35)
    this.tweens.add({ targets: swing, angle: 35, duration: 160, yoyo: true, onComplete: () => swing.destroy() })
    if (!collectResourceNode(ore)) return
    this.ores = this.ores.filter((candidate) => candidate !== ore)
    const resource = RESOURCES[ore.resourceId]
    EventBus.emit(GameEvents.showMessage, `${resource.icon} Добыто: ${resource.name}.`, 2200)
    this.updateDiagnostics()
  }

  private updateDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.mineOres = String(this.ores.length)
    status.dataset.mineIron = String(this.ores.filter(({ resourceId }) => resourceId === "iron").length)
    status.dataset.mineDiamonds = String(this.ores.filter(({ resourceId }) => resourceId === "diamond").length)
  }
}
