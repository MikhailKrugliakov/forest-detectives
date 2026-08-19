import Phaser from "phaser"
import { updateGameStatus } from "../../accessibility"
import { CHARACTERS } from "../../domain/characters"
import { gameStore } from "../../domain/GameStore"
import type { CharacterDefinition } from "../../domain/types"
import { addPanel, FONT } from "../ui"

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super("character-select")
  }

  create(): void {
    updateGameStatus("character-select", "Выберите героя")
    this.cameras.main.setBackgroundColor("#173f38")

    const background = this.add.graphics()
    background.fillGradientStyle(0x173f38, 0x173f38, 0x2f715d, 0x2f715d, 1)
    background.fillRect(0, 0, 1280, 720)
    for (let index = 0; index < 22; index += 1) {
      const x = 30 + ((index * 193) % 1240)
      const y = 35 + ((index * 107) % 650)
      background.fillStyle(index % 2 === 0 ? 0xf3c969 : 0xd8edc6, 0.12)
      background.fillCircle(x, y, 3 + (index % 4))
    }

    this.add
      .text(640, 42, "ТАЙНА ЛЕСНОЙ ПОСЫЛКИ", {
        fontFamily: FONT,
        fontSize: "42px",
        fontStyle: "bold",
        color: "#fff4cf",
        stroke: "#173f38",
        strokeThickness: 7,
      })
      .setOrigin(0.5, 0)
    this.add
      .text(640, 100, "Выбери сыщика", {
        fontFamily: FONT,
        fontSize: "25px",
        color: "#d8edc6",
      })
      .setOrigin(0.5, 0)

    CHARACTERS.forEach((character, index) => this.createCharacterCard(character, index))

    this.add
      .text(640, 686, "Нажми на карточку героя, чтобы начать расследование", {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#fff4cf",
      })
      .setOrigin(0.5)
  }

  private createCharacterCard(character: CharacterDefinition, index: number): void {
    const width = 230
    const height = 525
    const x = 13 + index * 253
    const y = 145
    const panel = addPanel(this, x, y, width, height, 0xfffbeb)
    const accent = this.add.rectangle(x + width / 2, y + 9, width - 18, 12, character.accent, 1)
    const portrait = this.add.image(x + width / 2, y + 119, character.assetKey)
    portrait.setDisplaySize(125, 168)

    const title = this.add
      .text(x + width / 2, y + 218, character.name, {
        fontFamily: FONT,
        fontSize: "23px",
        fontStyle: "bold",
        color: "#173f38",
      })
      .setOrigin(0.5)
    const subtitle = this.add
      .text(x + width / 2, y + 250, character.subtitle, {
        fontFamily: FONT,
        fontSize: "14px",
        fontStyle: "bold",
        color: "#4f725d",
      })
      .setOrigin(0.5)

    const stats = [
      ["СИЛ", character.stats.strength],
      ["ЛОВ", character.stats.agility],
      ["ВЫН", character.stats.endurance],
      ["ИНТ", character.stats.intelligence],
    ] as const

    stats.forEach(([label, value], statIndex) => {
      const rowY = y + 286 + statIndex * 31
      this.add.text(x + 24, rowY, label, {
        fontFamily: FONT,
        fontSize: "16px",
        fontStyle: "bold",
        color: "#173f38",
      })
      this.add.rectangle(x + 72, rowY + 8, 112, 13, 0xd9ddc5, 1).setOrigin(0, 0.5)
      this.add.rectangle(x + 72, rowY + 8, 11.2 * value, 13, character.accent, 1).setOrigin(0, 0.5)
      this.add
        .text(x + 205, rowY, String(value), {
          fontFamily: FONT,
          fontSize: "16px",
          fontStyle: "bold",
          color: "#173f38",
        })
        .setOrigin(0.5, 0)
    })

    this.add
      .text(x + width / 2, y + 423, `${character.equipment.icon} ${character.equipment.name}`, {
        fontFamily: FONT,
        fontSize: "15px",
        fontStyle: "bold",
        color: "#173f38",
        align: "center",
        wordWrap: { width: width - 24 },
      })
      .setOrigin(0.5, 0)
    this.add
      .text(x + width / 2, y + 465, character.ability, {
        fontFamily: FONT,
        fontSize: "15px",
        color: "#745a32",
      })
      .setOrigin(0.5, 0)

    const hitArea = this.add.zone(x + width / 2, y + height / 2, width, height)
    hitArea.setInteractive({ useHandCursor: true })
    hitArea.on("pointerover", () => {
      this.tweens.add({ targets: [panel, accent, portrait, title, subtitle], y: "-=7", duration: 120 })
      portrait.setTint(0xffffee)
    })
    hitArea.on("pointerout", () => {
      this.tweens.add({ targets: [panel, accent, portrait, title, subtitle], y: "+=7", duration: 120 })
      portrait.clearTint()
    })
    hitArea.on("pointerup", () => {
      gameStore.selectCharacter(character.id)
      this.cameras.main.fadeOut(250, 23, 63, 56)
      this.time.delayedCall(260, () => this.scene.start("forest-clearing"))
    })
  }
}
