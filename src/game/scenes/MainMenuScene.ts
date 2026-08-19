import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { gameStore } from "../../domain/GameStore"
import { MANUAL_SAVE_SLOTS, SAVE_SLOTS, saveManager } from "../../domain/saves"
import type { SaveSlotId } from "../../domain/types"
import { sceneKeyForLocation } from "../SceneRouter"
import { addButton, addPanel, COLORS, FONT } from "../ui"

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("main-menu")
  }

  create(): void {
    updateGameStatus("main-menu", "Главное меню")
    this.cameras.main.setBackgroundColor("#173f38")
    const background = this.add.graphics()
    background.fillGradientStyle(0x173f38, 0x173f38, 0x2f715d, 0x2f715d, 1)
    background.fillRect(0, 0, 1280, 720)
    for (let index = 0; index < 28; index += 1) {
      const x = 25 + ((index * 211) % 1230)
      const y = 25 + ((index * 97) % 670)
      background.fillStyle(index % 2 ? COLORS.cream : COLORS.yellow, 0.1)
      background.fillCircle(x, y, 3 + (index % 5))
    }
    addPanel(this, 315, 70, 650, 580, COLORS.cream)
    this.add.text(640, 112, "ТАЙНА ЛЕСНОЙ ПОСЫЛКИ", { fontFamily: FONT, fontSize: "38px", fontStyle: "bold", color: "#173f38" }).setOrigin(0.5)
    this.add.text(640, 160, "Приключения лесных сыщиков", { fontFamily: FONT, fontSize: "20px", color: "#4f725d" }).setOrigin(0.5)

    const auto = saveManager.read("auto")
    addButton(this, 640, 225, 360, 58, auto ? "▶ Продолжить" : "Продолжить — нет автосейва", () => {
      if (auto) this.loadSlot("auto")
    }, auto ? COLORS.coral : 0x8b958b)
    addButton(this, 640, 298, 360, 58, "Новая игра", () => {
      saveManager.startNewGame()
      this.scene.start("character-select")
    }, COLORS.leaf)

    this.add.text(640, 354, "РУЧНЫЕ СОХРАНЕНИЯ", { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: "#765134" }).setOrigin(0.5)
    MANUAL_SAVE_SLOTS.forEach((slot, index) => {
      const envelope = saveManager.read(slot)
      const y = 407 + index * 65
      const label = envelope
        ? `${index + 1}. ${envelope.summary.characterName} • ${this.locationLabel(envelope.summary.location)} • ${new Date(envelope.savedAt).toLocaleString("ru-RU")}`
        : `${index + 1}. Пустой слот`
      this.add.text(410, y - 11, label, { fontFamily: FONT, fontSize: "14px", color: envelope ? "#173f38" : "#7d8b7f", wordWrap: { width: 390 } })
      addButton(this, 840, y, 150, 40, envelope ? "Загрузить" : "Пусто", () => {
        if (envelope) this.loadSlot(slot)
      }, envelope ? COLORS.blue : 0x8b958b)
    })
    this.updateDiagnostics()
  }

  private loadSlot(slot: SaveSlotId): void {
    const result = saveManager.load(slot)
    if (!result.ok) {
      const status = document.querySelector<HTMLElement>("#game-status")
      if (status) status.dataset.saveError = result.message
      return
    }
    this.scene.start(sceneKeyForLocation(gameStore.state.location))
  }

  private locationLabel(location: string): string {
    return location === "mountain-hollow" ? "Горная Лощина" : location === "wild-forest" ? "Дикий лес" : location === "forest-village" ? "Деревня" : "Приключение"
  }

  private updateDiagnostics(): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.saveSlots = SAVE_SLOTS.map((slot) => `${slot}:${saveManager.read(slot) ? "filled" : "empty"}`).join(",")
  }
}
