import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { getCharacter } from "../../domain/characters"
import { gameStore } from "../../domain/GameStore"
import type { CharacterId, LocationId } from "../../domain/types"
import { EventBus, GameEvents } from "../EventBus"
import { COLORS, FONT } from "../ui"
import { BaseWorldScene } from "./BaseWorldScene"

interface ChallengeConfig {
  title: string
  hint: string
  icon: string
  count: number
  order: readonly number[]
  usesSpace: boolean
}

const CHALLENGES: Record<CharacterId, ChallengeConfig> = {
  wolf: { title: "Школа лассо", hint: "Попади по мишеням слева направо", icon: "🎯", count: 3, order: [0, 1, 2], usesSpace: true },
  fox: { title: "Зеркальный луч", hint: "Поверни зеркала: середина, слева, справа", icon: "🪞", count: 3, order: [1, 0, 2], usesSpace: false },
  rabbit: { title: "Порядок улик", hint: "Выбери карточки: 3, 1, 4, 2", icon: "📚", count: 4, order: [2, 0, 3, 1], usesSpace: false },
  watermelon: { title: "Свежий ветер", hint: "Настрой вентиляторы: слева, справа, середина", icon: "🌬️", count: 3, order: [0, 2, 1], usesSpace: false },
  sheepwolf: { title: "Бейсбольный замах", hint: "Отбей пять мячей по очереди", icon: "⚾", count: 5, order: [0, 1, 2, 3, 4], usesSpace: true },
}

const LOCATION_OWNER: Partial<Record<LocationId, CharacterId>> = {
  "wolf-home": "wolf",
  "fox-home": "fox",
  "rabbit-home": "rabbit",
  "watermelon-home": "watermelon",
  "sheepwolf-home": "sheepwolf",
}

export class HeroHomeScene extends BaseWorldScene {
  private owner!: CharacterId
  private markers: Phaser.GameObjects.Container[] = []
  private nearestIndex = -1
  private progress = 0
  private atExit = false
  private lastPrompt = ""

  constructor() {
    super("hero-home")
  }

  create(): void {
    const character = gameStore.state.character
    const owner = LOCATION_OWNER[gameStore.state.location]
    if (!character || !owner) {
      this.scene.start("forest-village")
      return
    }
    this.owner = owner
    const homeowner = getCharacter(owner)
    updateGameStatus(`${owner}-home`, `${homeowner.name}: домашнее испытание.`)
    this.add.image(640, 400, `${owner}-home-bg`).setDisplaySize(1280, 800)
    this.setupWorld(character, 1280, 800, 640, 690, 92, character.id === "watermelon" ? 106 : 128)
    this.createChallenge()
    if (owner !== character.id) {
      this.add.image(190, 420, homeowner.assetKey).setDisplaySize(owner === "watermelon" ? 130 : 120, owner === "watermelon" ? 145 : 165).setDepth(450)
      this.add.text(190, 520, homeowner.name, { fontFamily: FONT, fontSize: "17px", color: "#fff4cf", backgroundColor: "#173f38dd", padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(530)
    }
    const exitLabel = owner === "watermelon" ? "↓  НА ФЕРМУ" : "↓  В ДЕРЕВНЮ"
    this.add.text(640, 748, exitLabel, { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: "#fff4cf", backgroundColor: "#173f38dd", padding: { x: 12, y: 6 } }).setOrigin(0.5).setDepth(760)
    if (!this.scene.isActive("ui")) this.scene.launch("ui")
    const config = CHALLENGES[owner]
    EventBus.emit(GameEvents.showMessage, `${config.title}. ${config.hint}.`, 4300)
  }

  update(_time: number, delta: number): void {
    this.updateWorldInput(delta)
    if (this.modalOpen) return
    this.updateNearest()
    const config = CHALLENGES[this.owner]
    // JustDown is edge-triggered, so read E once and reuse the result both for
    // an E-based challenge and for the exit zone.
    const interactPressed = this.interactionPressed()
    const challengePressed = config.usesSpace ? this.attackPressed() : interactPressed
    if (challengePressed && this.nearestIndex >= 0) {
      this.choose(this.nearestIndex)
      return
    }
    if (interactPressed && this.atExit) {
      if (this.owner === "watermelon") this.transitionTo("melon-farm", "melon-farm")
      else this.transitionTo("forest-village", "forest-village")
    }
  }

  private createChallenge(): void {
    const config = CHALLENGES[this.owner]
    const completed = gameStore.state.completedHomeChallenges.includes(this.owner)
    for (let index = 0; index < config.count; index += 1) {
      const x = 420 + index * (440 / Math.max(1, config.count - 1))
      const circle = this.add.circle(0, 0, 37, COLORS.yellow, completed ? 0.28 : 0.72)
      const icon = this.add.text(0, 0, config.icon, { fontFamily: FONT, fontSize: "33px" }).setOrigin(0.5)
      const number = this.add.text(0, 45, String(index + 1), { fontFamily: FONT, fontSize: "14px", fontStyle: "bold", color: "#fff4cf", backgroundColor: "#173f38cc", padding: { x: 6, y: 2 } }).setOrigin(0.5)
      this.markers.push(this.add.container(x, 330, [circle, icon, number]).setDepth(360))
    }
    if (completed) this.progress = config.order.length
  }

  private updateNearest(): void {
    this.nearestIndex = -1
    let best = Number.POSITIVE_INFINITY
    this.markers.forEach((marker, index) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, marker.x, marker.y)
      if (distance < 105 && distance < best) {
        best = distance
        this.nearestIndex = index
      }
    })
    this.atExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, 640, 720) < 82
    const config = CHALLENGES[this.owner]
    let prompt = ""
    if (this.nearestIndex >= 0 && this.progress < config.order.length) {
      prompt = config.usesSpace ? "Пробел — выполнить действие" : "E — настроить"
    } else if (this.atExit) prompt = this.owner === "watermelon" ? "E — вернуться на ферму" : "E — вернуться в деревню"
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt
      EventBus.emit(GameEvents.promptChanged, prompt)
    }
  }

  private choose(index: number): void {
    const config = CHALLENGES[this.owner]
    if (this.progress >= config.order.length) return
    if (config.order[this.progress] !== index) {
      this.progress = 0
      this.markers.forEach((marker) => marker.setAlpha(1))
      EventBus.emit(GameEvents.showMessage, "Последовательность сбилась. Посмотри на подсказку и попробуй снова.", 2600)
      return
    }
    this.markers[index]?.setAlpha(0.35)
    this.progress += 1
    if (this.progress < config.order.length) return
    const rewarded = gameStore.completeHomeChallenge(this.owner)
    EventBus.emit(
      GameEvents.showMessage,
      rewarded ? `Испытание пройдено! Получено ⚙️ 2.` : "Это испытание уже пройдено.",
      3200,
    )
  }
}
