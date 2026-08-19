import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { CLUES } from "../../domain/clues"
import { gameStore } from "../../domain/GameStore"
import type { Interactable, PuzzleAnswer } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { COLORS } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"

interface WorldInteractable extends Interactable {
  marker: Phaser.GameObjects.Graphics | Phaser.GameObjects.Zone
}

export class ForestClearingScene extends BaseWorldScene {
  private interactables: WorldInteractable[] = []
  private nearest: WorldInteractable | null = null
  private lastPrompt = ""

  constructor() {
    super("forest-clearing")
  }

  create(): void {
    const character = gameStore.state.character
    if (!character) {
      this.scene.start("character-select")
      return
    }

    this.cameras.main.setBackgroundColor("#82b867")

    this.add.image(800, 500, "forest-clearing").setDisplaySize(1600, 1000).setDepth(0)
    this.createInteractables()
    this.setupWorld(
      character,
      1600,
      1000,
      760,
      785,
      character.id === "watermelon" ? 108 : 112,
      character.id === "watermelon" ? 124 : 154,
    )
    this.loadMapCollisions("forest-map")
    // Expose the scene as ready only after setupWorld has attached controls
    // and the debug/accessibility bridge used by browser automation.
    updateGameStatus("forest", `На опушке. Герой: ${character.name}. Улик найдено 0 из 3.`)
    this.cameras.main.fadeIn(350, 23, 63, 56)

    this.scene.launch("ui")
    EventBus.on(GameEvents.answerSelected, this.handleAnswer, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.answerSelected, this.handleAnswer, this)
    })

    this.time.delayedCall(450, () => {
      EventBus.emit(
        GameEvents.showMessage,
        "Белочка-почтальон оставила посылку для Совёнка на старом пне, но она исчезла. Найди три улики!",
        6500,
      )
    })
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) {
      return
    }

    this.updateWorldInput(delta, !gameStore.state.puzzle.completed)
    if (this.modalOpen || gameStore.state.puzzle.completed) return
    this.updateNearestInteractable()

    if (this.nearest && this.interactionPressed()) {
      this.interact(this.nearest)
    }
  }

  private createInteractables(): void {
    const print = this.add.graphics().setDepth(675)
    print.lineStyle(5, 0xdab778, 0.95)
    print.strokeRoundedRect(545, 495, 75, 55, 5)
    print.fillStyle(COLORS.yellow, 0.18)
    print.fillRoundedRect(545, 495, 75, 55, 5)

    const ribbon = this.add.graphics().setDepth(510)
    ribbon.lineStyle(9, 0x4d87cf, 1)
    ribbon.beginPath()
    ribbon.moveTo(855, 395)
    ribbon.lineTo(900, 379)
    ribbon.lineTo(930, 400)
    ribbon.strokePath()
    ribbon.fillStyle(0x8bb9ed, 1)
    ribbon.fillTriangle(928, 399, 952, 387, 948, 412)

    const cardboard = this.add.graphics().setDepth(326)
    cardboard.fillStyle(0xc29461, 1)
    cardboard.fillTriangle(1170, 225, 1222, 235, 1197, 271)
    cardboard.lineStyle(4, 0x4d87cf, 1)
    cardboard.lineBetween(1185, 233, 1208, 239)

    const burrowZone = this.add.zone(1305, 160, 170, 110).setDepth(230)

    this.interactables = [
      {
        id: "parcel-print",
        x: 583,
        y: 522,
        radius: 105,
        prompt: "E — осмотреть след от коробки",
        kind: "clue",
        clueId: "parcel-print",
        marker: print,
      },
      {
        id: "ribbon",
        x: 905,
        y: 395,
        radius: 105,
        prompt: "E — поднять синюю ленту",
        kind: "clue",
        clueId: "ribbon",
        marker: ribbon,
      },
      {
        id: "cardboard",
        x: 1197,
        y: 245,
        radius: 105,
        prompt: "E — осмотреть кусочек картона",
        kind: "clue",
        clueId: "cardboard",
        marker: cardboard,
      },
      {
        id: "burrow",
        x: 1305,
        y: 160,
        radius: 145,
        prompt: "E — исследовать нору",
        kind: "burrow",
        marker: burrowZone,
      },
    ]
  }

  private updateNearestInteractable(): void {
    this.nearest = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const interactable of this.interactables) {
      if (
        interactable.clueId &&
        gameStore.state.puzzle.foundClues.includes(interactable.clueId)
      ) {
        continue
      }
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        interactable.x,
        interactable.y,
      )
      if (distance <= interactable.radius && distance < nearestDistance) {
        this.nearest = interactable
        nearestDistance = distance
      }
    }

    const prompt = this.nearest?.prompt ?? ""
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private interact(interactable: WorldInteractable): void {
    if (interactable.kind === "clue" && interactable.clueId) {
      const clueId = interactable.clueId
      if (gameStore.collectClue(clueId)) {
        interactable.marker.setVisible(false)
        EventBus.emit(
          GameEvents.showMessage,
          `${CLUES[clueId].icon} Найдена улика: ${CLUES[clueId].name}. ${CLUES[clueId].description}`,
          4800,
        )
        updateGameStatus(
          "forest",
          `На опушке. Улик найдено ${gameStore.state.puzzle.foundClues.length} из 3.`,
        )
      }
      return
    }

    if (gameStore.state.puzzle.foundClues.length < 3) {
      EventBus.emit(
        GameEvents.showMessage,
        `В норе темно. Сначала нужно найти все улики — пока найдено ${gameStore.state.puzzle.foundClues.length} из 3.`,
        3800,
      )
      return
    }

    EventBus.emit(GameEvents.showDeduction)
  }

  private handleAnswer(answer: PuzzleAnswer): void {
    const result = gameStore.answer(answer)
    if (!result.correct) {
      EventBus.emit(GameEvents.showMessage, result.message, 6000)
      return
    }

    const parcel = this.add.container(1305, 165).setDepth(380)
    const box = this.add.rectangle(0, 0, 72, 55, 0xc98d52, 1).setStrokeStyle(5, 0x6e452d, 1)
    const tapeV = this.add.rectangle(0, 0, 14, 55, 0x4d87cf, 1)
    const tapeH = this.add.rectangle(0, 0, 72, 10, 0x4d87cf, 1)
    parcel.add([box, tapeV, tapeH])
    parcel.setScale(0.15)
    parcel.setAlpha(0)

    this.tweens.add({
      targets: parcel,
      x: 1230,
      y: 270,
      alpha: 1,
      scale: 1,
      angle: 8,
      duration: 950,
      ease: "Back.Out",
      onComplete: () => {
        EventBus.emit(GameEvents.puzzleSolved)
        updateGameStatus("case-complete", "Дело раскрыто. Посылка найдена в норе.")
      },
    })
  }

}
