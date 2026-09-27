import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { GADGETS } from "../../domain/gadgets"
import { gameStore } from "../../domain/GameStore"
import type { GadgetId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"
import { NpcController } from "../animation/NpcController"

interface ShopStand {
  id: GadgetId
  x: number
  y: number
}

const STANDS: readonly ShopStand[] = [
  { id: "jetpack", x: 540, y: 330 },
  { id: "magnetic-glove", x: 860, y: 330 },
  { id: "gas-mask", x: 540, y: 555 },
  { id: "pulse-shield", x: 860, y: 555 },
]

export class MoleShopScene extends BaseWorldScene {
  private nearestStand: ShopStand | null = null
  private atExit = false
  private atMole = false
  private lastPrompt = ""
  private residents!: NpcController
  private scubaLabel?: Phaser.GameObjects.Text

  constructor() {
    super("mole-shop")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("character-select")
      return
    }
    this.scubaLabel = undefined
    gameStore.setLocation("mole-shop")
    updateGameStatus("mole-shop", `Магазин дядюшки Крота. Шестерёнки: ${gameStore.state.gears}.`)
    this.add.image(700, 450, "mole-shop-bg").setDisplaySize(1400, 900)
    this.setupWorld(character, 1400, 900, 700, 760, 96, character.id === "watermelon" ? 110 : 132)
    this.residents = new NpcController(this, this.player)
    const mole = this.add.image(1110, 560, "npc-mole").setDisplaySize(180, 230).setDepth(590)
    const title = this.add
      .text(1110, 690, "Дядюшка Крот", {
        fontFamily: FONT,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#fff4cf",
        backgroundColor: "#173f38dd",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(700)
    this.residents.add("mole", mole, title)

    STANDS.forEach(({ id, x, y }) => {
      const gadget = GADGETS[id]
      this.add.image(x, y - 15, gadget.assetKey).setDisplaySize(125, 125).setDepth(y + 10)
      this.add
        .text(x, y + 74, `${gadget.icon} ${gadget.name}\n⚙️ ${gameStore.shopPrice(gadget.price)}`, {
          fontFamily: FONT,
          fontSize: "15px",
          fontStyle: "bold",
          color: "#173f38",
          backgroundColor: "#fff4cfdd",
          padding: { x: 8, y: 5 },
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(y + 20)
    })
    if (gameStore.state.ocean.beachVisited) {
      this.add.image(1110, 325, "scuba").setDisplaySize(100, 100).setDepth(500)
      this.scubaLabel = this.add.text(1110, 404, gameStore.state.ocean.hasScuba ? "АКВАЛАНГ КУПЛЕН" : "АКВАЛАНГ • ⚙️ 40\nE — поговорить с Кротом", { fontFamily: FONT, fontSize: "17px", color: "#fff4cf", backgroundColor: "#173f38dd", padding: { x: 9, y: 6 }, align: "center" }).setOrigin(0.5).setDepth(510)
    }
    this.add
      .text(700, 835, "↓  В ДЕРЕВНЮ", {
        fontFamily: FONT,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#fff4cf",
        backgroundColor: "#173f38dd",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(850)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    EventBus.emit(GameEvents.showMessage, "Выбери витрину. Купленные устройства можно менять в рюкзаке.", 4300)
  }

  update(_time: number, delta: number): void {
    if (this.scubaLabel && gameStore.state.ocean.hasScuba) this.scubaLabel.setText("АКВАЛАНГ КУПЛЕН")
    this.updateWorldInput(delta)
    if (this.modalOpen) return
    this.updateNearest()
    if (!this.interactionPressed()) return
    if (this.nearestStand) EventBus.emit(GameEvents.openShop, this.nearestStand.id)
    else if (this.atMole) {
      this.residents.talk("mole", 3400)
      if (gameStore.state.ocean.beachVisited) {
        EventBus.emit(GameEvents.openScubaShop)
        return
      }
      EventBus.emit(GameEvents.showDialogue, "Крот: «Для мастерской Бобра точно пригодится реактивный ранец!»", 3400)
    }
    else if (this.atExit) this.transitionTo("forest-village", "forest-village")
  }

  private updateNearest(): void {
    this.nearestStand = null
    let best = Number.POSITIVE_INFINITY
    for (const stand of STANDS) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, stand.x, stand.y)
      if (distance < 130 && distance < best) {
        best = distance
        this.nearestStand = stand
      }
    }
    this.atMole = Phaser.Math.Distance.Between(this.player.x, this.player.y, 1110, 590) < 145
    this.atExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, 700, 805) < 100
    let prompt = ""
    if (this.nearestStand) prompt = "E — осмотреть устройство"
    else if (this.atMole) prompt = "E — поговорить с Кротом"
    else if (this.atExit) prompt = "E — вернуться в деревню"
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }
}
