import Phaser from "phaser"
import { CHARACTERS } from "../../domain/characters"
import { gameStore } from "../../domain/GameStore"
import { GADGET_IDS, GADGETS } from "../../domain/gadgets"
import { BUILDING_MATERIAL_IDS, BUILDING_MATERIALS } from "../../domain/materials"
import { PRODUCE, PRODUCE_IDS } from "../../domain/produce"
import { PICKAXE_RECIPE, RESOURCES, SURFACE_RESOURCE_IDS } from "../../domain/resources"
import { QUEST_IDS, QUESTS } from "../../domain/quests"
import { ERRAND_IDS, ERRANDS, LOCATION_LABELS } from "../../domain/village"
import { SAVE_SLOTS, saveManager } from "../../domain/saves"
import { healingPotionState } from "../../domain/healing"
import { DIFFICULTIES, DIFFICULTY_IDS } from "../../domain/difficulty"
import type { BuildingMaterialId, DifficultyId, ErrandId, GadgetId, ProduceId, PuzzleAnswer, QuestId, QuestStatus, SaveSlotId } from "../../domain/types"
import { updateGameStatus } from "../../accessibility"
import { EventBus, GameEvents } from "../EventBus"
import { addButton, addPanel, COLORS, FONT } from "../ui"
import { sceneKeyForLocation, WORLD_SCENES } from "../SceneRouter"

export class UIScene extends Phaser.Scene {
  private heroText!: Phaser.GameObjects.Text
  private objectiveText!: Phaser.GameObjects.Text
  private staminaFill!: Phaser.GameObjects.Rectangle
  private staminaText!: Phaser.GameObjects.Text
  private healthBack!: Phaser.GameObjects.Rectangle
  private healthFill!: Phaser.GameObjects.Rectangle
  private healthText!: Phaser.GameObjects.Text
  private potionText!: Phaser.GameObjects.Text
  private controlsText!: Phaser.GameObjects.Text
  private gearText!: Phaser.GameObjects.Text
  private gadgetText!: Phaser.GameObjects.Text
  private weaponText!: Phaser.GameObjects.Text
  private promptText!: Phaser.GameObjects.Text
  private notificationContainer!: Phaser.GameObjects.Container
  private notificationBackground!: Phaser.GameObjects.Graphics
  private notificationText!: Phaser.GameObjects.Text
  private dialogueContainer!: Phaser.GameObjects.Container
  private dialogueText!: Phaser.GameObjects.Text
  private modal: Phaser.GameObjects.Container | null = null
  private notificationTimer: Phaser.Time.TimerEvent | null = null
  private dialogueTimer: Phaser.Time.TimerEvent | null = null
  private modalLocked = false
  private pauseOpen = false
  private pausedWorldScenes: string[] = []
  private inventoryTab: "quests" | "gadgets" | "resources" | "rewards" | "saves" = "quests"

  constructor() {
    super("ui")
  }

  create(): void {
    this.createHud()
    this.createMessageBoxes()

    EventBus.on(GameEvents.showMessage, this.showNotification, this)
    EventBus.on(GameEvents.showDialogue, this.showDialogue, this)
    EventBus.on(GameEvents.promptChanged, this.setPrompt, this)
    EventBus.on(GameEvents.toggleInventory, this.toggleInventory, this)
    EventBus.on(GameEvents.openInventory, this.openInventory, this)
    EventBus.on(GameEvents.showDeduction, this.openDeduction, this)
    EventBus.on(GameEvents.puzzleSolved, this.showCompletion, this)
    EventBus.on(GameEvents.openQuest, this.openQuest, this)
    EventBus.on(GameEvents.openErrand, this.openErrand, this)
    EventBus.on(GameEvents.openShop, this.openShop, this)
    EventBus.on(GameEvents.openMaterials, this.openMaterialsShop, this)
    EventBus.on(GameEvents.openProduceShop, this.openProduceShop, this)
    EventBus.on(GameEvents.mountainComplete, this.showMountainCompletion, this)
    EventBus.on(GameEvents.birdPassComplete, this.showBirdPassCompletion, this)
    EventBus.on("close-modal", this.closeModal, this)
    this.input.keyboard?.on("keydown-ESC", this.handleEscape, this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(GameEvents.showMessage, this.showNotification, this)
      EventBus.off(GameEvents.showDialogue, this.showDialogue, this)
      EventBus.off(GameEvents.promptChanged, this.setPrompt, this)
      EventBus.off(GameEvents.toggleInventory, this.toggleInventory, this)
      EventBus.off(GameEvents.openInventory, this.openInventory, this)
      EventBus.off(GameEvents.showDeduction, this.openDeduction, this)
      EventBus.off(GameEvents.puzzleSolved, this.showCompletion, this)
      EventBus.off(GameEvents.openQuest, this.openQuest, this)
      EventBus.off(GameEvents.openErrand, this.openErrand, this)
      EventBus.off(GameEvents.openShop, this.openShop, this)
      EventBus.off(GameEvents.openMaterials, this.openMaterialsShop, this)
      EventBus.off(GameEvents.openProduceShop, this.openProduceShop, this)
      EventBus.off(GameEvents.mountainComplete, this.showMountainCompletion, this)
      EventBus.off(GameEvents.birdPassComplete, this.showBirdPassCompletion, this)
      EventBus.off("close-modal", this.closeModal, this)
      this.input.keyboard?.off("keydown-ESC", this.handleEscape, this)
    })
  }

  update(): void {
    const state = gameStore.state
    const character = state.character
    if (!character) {
      return
    }
    this.heroText.setText(
      `${character.name}\nСИЛ ${character.stats.strength}  ЛОВ ${character.stats.agility}  ВЫН ${character.stats.endurance}  ИНТ ${character.stats.intelligence}`,
    )
    const clueCount = state.puzzle.foundClues.length
    if (state.chapter === 1) {
      this.objectiveText.setText(`ДЕЛО: ПРОПАВШАЯ ПОСЫЛКА  •  УЛИКИ ${clueCount}/3`)
    } else {
      const completed = QUEST_IDS.filter((id) => state.quests[id].status === "completed").length
      const location = LOCATION_LABELS[state.location]
      if (state.location === "mountain-hollow") {
        const guardians = ["guardian-axe", "guardian-flamethrower"].filter((id) => state.defeatedEnemies.includes(id)).length
        this.objectiveText.setText(`${location}  •  ПОБЕДЫ ${state.mountainEnemyDefeats}  •  СТРАЖНИКИ ${guardians}/2`)
      } else if (state.location === "bird-pass") {
        const turtle = state.birdPassCleared ? "ПОБЕЖДЁН" : "АКТИВЕН"
        this.objectiveText.setText(`${location}  •  ПОБЕДЫ ${state.birdPassEnemyDefeats}  •  БРОНЕПАНЦИРЬ ${turtle}`)
      } else {
        this.objectiveText.setText(`${location}  •  ЗАДАНИЯ ${completed}/4  •  ПОБЕЖДЕНО ${state.totalEnemyDefeats}`)
      }
    }
    const staminaRatio = state.maxStamina === 0 ? 0 : state.stamina / state.maxStamina
    this.staminaFill.width = 188 * staminaRatio
    this.staminaText.setText(`Бег ${Math.ceil(state.stamina)}/${state.maxStamina}`)
    const healthRatio = state.maxHealth === 0 ? 0 : state.health / state.maxHealth
    this.healthFill.width = 188 * healthRatio
    this.healthText.setText(`Здоровье ${state.health}/${state.maxHealth}`)
    const potions = healingPotionState(state.healingPotionReadyAt)
    const potionCooldown = potions.nextReadyAt == null ? "" : ` • ${Math.max(1, Math.ceil((potions.nextReadyAt - Date.now()) / 1000))}с`
    this.potionText.setText(`🧪 Зелья ${potions.ready}/3${potionCooldown}`)
    this.healthBack.setVisible(state.chapter >= 2)
    this.healthFill.setVisible(state.chapter >= 2)
    this.healthText.setVisible(state.chapter >= 2)
    this.potionText.setVisible(state.chapter >= 2)
    this.controlsText.setText(
      state.chapter >= 2
        ? `УПРАВЛЕНИЕ\nWASD — идти\nShift — бег\nR — оружие\nQ — гаджет\nT — зелье\nПробел — атака\nE — действие\nEsc — пауза\n${DIFFICULTIES[state.difficulty].name}`
        : "УПРАВЛЕНИЕ\nWASD — идти\nShift — бежать\nE — осмотреть",
    )
    this.gearText.setText(`⚙️ ${state.gears}`)
    const equipped = state.equippedGadget ? GADGETS[state.equippedGadget] : null
    this.gadgetText.setText(equipped ? `Q: ${equipped.icon} ${equipped.name}` : "Q: гаджет не выбран")
    const weapon = state.equippedWeapon
    const weaponAmmo = weapon === "melee" ? "∞" : String(state.produceAmmo[weapon])
    const weaponName = weapon === "melee" ? character.equipment.name : PRODUCE[weapon].name
    const weaponIcon = weapon === "melee" ? character.equipment.icon : PRODUCE[weapon].icon
    this.weaponText.setText(`R: ${weaponIcon} ${weaponName}  •  ${weaponAmmo}`)
    this.gearText.setVisible(state.chapter >= 2)
    this.gadgetText.setVisible(state.chapter >= 2)
    this.weaponText.setVisible(state.chapter >= 2)
  }

  private createHud(): void {
    const left = this.add.graphics()
    left.fillStyle(COLORS.ink, 0.92)
    left.fillRoundedRect(18, 18, 335, 143, 18)
    left.lineStyle(3, COLORS.cream, 0.7)
    left.strokeRoundedRect(18, 18, 335, 143, 18)

    this.heroText = this.add.text(36, 31, "", {
      fontFamily: FONT,
      fontSize: "19px",
      fontStyle: "bold",
      color: "#fff4cf",
      lineSpacing: 8,
    })

    const objectiveBackground = this.add.rectangle(640, 36, 490, 45, COLORS.ink, 0.91)
    objectiveBackground.setStrokeStyle(3, COLORS.cream, 0.7)
    this.objectiveText = this.add
      .text(640, 36, "", {
        fontFamily: FONT,
        fontSize: "17px",
        fontStyle: "bold",
        color: "#fff4cf",
      })
      .setOrigin(0.5)

    const staminaBack = this.add.rectangle(38, 94, 192, 12, 0x0b2722, 1).setOrigin(0, 0.5)
    staminaBack.setStrokeStyle(1, COLORS.cream, 0.65)
    this.staminaFill = this.add.rectangle(40, 94, 188, 8, COLORS.yellow, 1).setOrigin(0, 0.5)
    this.staminaText = this.add
      .text(238, 84, "", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#d8edc6",
      })

    this.healthBack = this.add.rectangle(38, 117, 192, 12, 0x0b2722, 1).setOrigin(0, 0.5)
    this.healthBack.setStrokeStyle(1, COLORS.cream, 0.65)
    this.healthFill = this.add.rectangle(40, 117, 188, 8, COLORS.coral, 1).setOrigin(0, 0.5)
    this.healthText = this.add.text(238, 107, "", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#ffd5ca",
    })
    this.potionText = this.add.text(38, 132, "", {
      fontFamily: FONT,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#d8edc6",
    })

    addButton(this, 1175, 47, 166, 58, "🎒 Инвентарь  I", () => this.toggleInventory(), COLORS.leafDark)

    this.gearText = this.add.text(870, 66, "", {
      fontFamily: FONT,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#fff4cf",
      backgroundColor: "#173f38dd",
      padding: { x: 10, y: 5 },
    })
    this.gadgetText = this.add.text(870, 103, "", {
      fontFamily: FONT,
      fontSize: "14px",
      color: "#d8edc6",
      backgroundColor: "#173f38cc",
      padding: { x: 9, y: 4 },
    })
    this.weaponText = this.add.text(870, 136, "", {
      fontFamily: FONT,
      fontSize: "14px",
      fontStyle: "bold",
      color: "#fff4cf",
      backgroundColor: "#173f38cc",
      padding: { x: 9, y: 4 },
    })

    this.controlsText = this.add
      .text(1262, 520, "", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#fff4cf",
        backgroundColor: "#173f38cc",
        padding: { x: 11, y: 9 },
        lineSpacing: 3,
        wordWrap: { width: 190 },
      })
      .setOrigin(1, 0)
    this.controlsText.setAlpha(0.92)

    this.promptText = this.add
      .text(1262, 342, "", {
        fontFamily: FONT,
        fontSize: "15px",
        fontStyle: "bold",
        color: "#fff4cf",
        backgroundColor: "#173f38e8",
        padding: { x: 11, y: 8 },
        wordWrap: { width: 255 },
        align: "left",
      })
      .setOrigin(1, 0)
      .setDepth(300)
      .setVisible(false)
  }

  private createMessageBoxes(): void {
    this.notificationBackground = this.add.graphics()
    this.notificationText = this.add.text(994, 194, "", {
      fontFamily: FONT,
      fontSize: "15px",
      color: "#fff4cf",
      lineSpacing: 3,
      wordWrap: { width: 240 },
      align: "left",
    })
    this.notificationContainer = this.add.container(0, 0, [this.notificationBackground, this.notificationText])
    this.notificationContainer.setDepth(300).setVisible(false)

    const dialogueBackground = this.add.graphics()
    dialogueBackground.fillStyle(COLORS.ink, 0.95)
    dialogueBackground.fillRoundedRect(235, 505, 810, 120, 20)
    dialogueBackground.lineStyle(4, COLORS.yellow, 1)
    dialogueBackground.strokeRoundedRect(235, 505, 810, 120, 20)
    const dialogueLabel = this.add.text(270, 519, "💬  ДИАЛОГ", {
      fontFamily: FONT,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#f7c948",
    })
    this.dialogueText = this.add
      .text(270, 545, "", {
        fontFamily: FONT,
        fontSize: "21px",
        color: "#fff4cf",
        wordWrap: { width: 740 },
        align: "center",
      })
      .setOrigin(0, 0)
    this.dialogueContainer = this.add.container(0, 0, [dialogueBackground, dialogueLabel, this.dialogueText])
    this.dialogueContainer.setDepth(350).setVisible(false)

    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) {
      status.dataset.notificationPlacement = "right"
      status.dataset.promptPlacement = "right"
      status.dataset.controlsPlacement = "right"
      status.dataset.dialoguePlacement = "bottom"
      status.dataset.modalOpen = "false"
    }
  }

  private showNotification(message: string, duration = 4200): void {
    this.notificationTimer?.remove(false)
    this.tweens.killTweensOf(this.notificationContainer)
    this.notificationText.setText(message)
    const height = Phaser.Math.Clamp(this.notificationText.height + 30, 64, 148)
    this.notificationBackground.clear()
    this.notificationBackground.fillStyle(COLORS.ink, 0.9)
    this.notificationBackground.fillRoundedRect(975, 178, 287, height, 14)
    this.notificationBackground.lineStyle(2, COLORS.cream, 0.72)
    this.notificationBackground.strokeRoundedRect(975, 178, 287, height, 14)
    this.notificationContainer.setVisible(true).setAlpha(0)
    this.tweens.add({ targets: this.notificationContainer, alpha: 1, duration: 140 })
    this.setMessageDiagnostic("notification", message)
    this.notificationTimer = this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: this.notificationContainer,
        alpha: 0,
        duration: 180,
        onComplete: () => this.notificationContainer.setVisible(false),
      })
    })
  }

  private showDialogue(message: string, duration = 4200): void {
    this.dialogueTimer?.remove(false)
    this.tweens.killTweensOf(this.dialogueContainer)
    this.dialogueText.setText(message)
    this.dialogueText.setPosition(640, 570).setOrigin(0.5)
    this.dialogueContainer.setVisible(true).setAlpha(0)
    this.tweens.add({ targets: this.dialogueContainer, alpha: 1, duration: 170 })
    this.setMessageDiagnostic("dialogue", message)
    this.dialogueTimer = this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: this.dialogueContainer,
        alpha: 0,
        duration: 220,
        onComplete: () => this.dialogueContainer.setVisible(false),
      })
    })
  }

  private setMessageDiagnostic(kind: "notification" | "dialogue", message: string): void {
    const status = document.querySelector<HTMLElement>("#game-status")
    if (!status) return
    status.dataset.lastMessageKind = kind
    if (kind === "notification") status.dataset.lastNotification = message
    else status.dataset.lastDialogue = message
  }

  private setPrompt(prompt: string): void {
    this.promptText.setText(prompt).setVisible(prompt.length > 0 && !this.modal)
  }

  private toggleInventory(): void {
    if (this.modal) {
      this.closeModal()
    } else {
      this.openInventory()
    }
  }

  private openInventory(): void {
    if (this.modal) return
    this.modalLocked = false
    const state = gameStore.state
    const character = state.character
    if (!character) return

    const elements: Phaser.GameObjects.GameObject[] = []
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.72)
    shade.setInteractive()
    const panel = addPanel(this, 210, 82, 860, 560)
    elements.push(shade, panel)

    elements.push(
      this.add.text(250, 112, "РЮКЗАК СЫЩИКА", {
        fontFamily: FONT,
        fontSize: "31px",
        fontStyle: "bold",
        color: "#173f38",
      }),
    )
    elements.push(
      this.add.text(1000, 115, "Esc — закрыть", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#4f725d",
      }).setOrigin(1, 0),
    )

    if (state.chapter === 1 && this.inventoryTab === "saves") {
      elements.push(addButton(this, 950, 170, 160, 38, "← К уликам", () => this.switchInventoryTab("quests"), COLORS.leaf))
      this.populateSaves(elements)
      this.modal = this.add.container(0, 0, elements).setDepth(400)
      this.setModalState(true)
      return
    }

    elements.push(
      this.add.image(323, 245, character.assetKey).setDisplaySize(135, 170),
      this.add.text(415, 172, `${character.name} • ${character.ability}`, {
        fontFamily: FONT,
        fontSize: "23px",
        fontStyle: "bold",
        color: "#173f38",
      }),
      this.add.text(
        415,
        215,
        `Сила ${character.stats.strength}   Ловкость ${character.stats.agility}\nВыносливость ${character.stats.endurance}   Интеллект ${character.stats.intelligence}`,
        {
          fontFamily: FONT,
          fontSize: "18px",
          color: "#345c4d",
          lineSpacing: 9,
        },
      ),
      this.add.text(415, 285, `${character.equipment.icon} ${character.equipment.name}`, {
        fontFamily: FONT,
        fontSize: "20px",
        fontStyle: "bold",
        color: "#765134",
      }),
      this.add.text(415, 320, character.equipment.description, {
        fontFamily: FONT,
        fontSize: "15px",
        color: "#4e5547",
        wordWrap: { width: 560 },
      }),
    )

    if (state.chapter >= 2) {
      elements.push(
        addButton(this, 300, 378, 150, 42, "Задания", () => this.switchInventoryTab("quests"), this.inventoryTab === "quests" ? COLORS.coral : 0x7d8b7f),
        addButton(this, 470, 378, 150, 42, "Гаджеты", () => this.switchInventoryTab("gadgets"), this.inventoryTab === "gadgets" ? COLORS.coral : 0x7d8b7f),
        addButton(this, 645, 378, 170, 42, "Ресурсы", () => this.switchInventoryTab("resources"), this.inventoryTab === "resources" ? COLORS.coral : 0x7d8b7f),
        addButton(this, 820, 378, 150, 42, "Награды", () => this.switchInventoryTab("rewards"), this.inventoryTab === "rewards" ? COLORS.coral : 0x7d8b7f),
        addButton(this, 985, 378, 140, 42, "Сохранения", () => this.switchInventoryTab("saves"), this.inventoryTab === "saves" ? COLORS.coral : 0x7d8b7f),
      )
      if (this.inventoryTab === "quests") this.populateQuestJournal(elements)
      else if (this.inventoryTab === "gadgets") this.populateGadgets(elements)
      else if (this.inventoryTab === "resources") this.populateResources(elements)
      else if (this.inventoryTab === "rewards") this.populateRewards(elements)
      else this.populateSaves(elements)
    } else {
      elements.push(
        this.add.text(250, 382, `УЛИКИ  ${state.puzzle.foundClues.length}/3`, {
        fontFamily: FONT,
        fontSize: "23px",
        fontStyle: "bold",
        color: "#173f38",
        }),
      )

      if (state.puzzle.foundClues.length === 0) {
        elements.push(
          this.add.text(250, 430, "Здесь появятся найденные улики. Осмотри опушку!", {
            fontFamily: FONT,
            fontSize: "18px",
            color: "#657266",
          }),
        )
      } else {
        state.inventory
          .filter((item) => item.type === "clue")
          .forEach((item, index) => {
            const x = 250 + index * 250
            elements.push(
              this.add.rectangle(x + 108, 476, 225, 120, 0xefe5c5, 1).setStrokeStyle(2, 0x8b7855, 0.8),
              this.add.text(x + 16, 430, item.icon, { fontFamily: FONT, fontSize: "31px", color: "#173f38" }),
              this.add.text(x + 58, 432, item.name, {
                fontFamily: FONT,
                fontSize: "17px",
                fontStyle: "bold",
                color: "#173f38",
                wordWrap: { width: 148 },
              }),
              this.add.text(x + 16, 478, item.description, {
                fontFamily: FONT,
                fontSize: "13px",
                color: "#4e5547",
                wordWrap: { width: 190 },
                maxLines: 3,
              }),
            )
          })
      }

      const canThink = state.puzzle.foundClues.length >= 2
      const thinkButton = addButton(
      this,
      898,
      592,
      285,
      58,
      canThink ? `💡 Подумать (ИНТ ${character.stats.intelligence})` : "Нужно 2 улики",
      () => {
        if (!canThink) {
          this.showNotification("Сначала найди хотя бы две улики.", 2600)
          return
        }
        this.showNotification(gameStore.analyze(), 6500)
      },
      canThink ? COLORS.coral : 0x8b958b,
    )
      elements.push(thinkButton)
      elements.push(addButton(this, 640, 592, 190, 48, "💾 Сохранения", () => this.switchInventoryTab("saves"), COLORS.blue))
    }

    this.modal = this.add.container(0, 0, elements).setDepth(400)
    this.setModalState(true)
  }

  private openDeduction(): void {
    this.closeModal()
    this.modalLocked = false
    const elements: Phaser.GameObjects.GameObject[] = []
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.75).setInteractive()
    const panel = addPanel(this, 300, 128, 680, 470)
    elements.push(shade, panel)
    elements.push(
      this.add
        .text(640, 172, "КУДА ПРОПАЛА ПОСЫЛКА?", {
          fontFamily: FONT,
          fontSize: "32px",
          fontStyle: "bold",
          color: "#173f38",
        })
        .setOrigin(0.5),
      this.add
        .text(640, 228, "Сопоставь три улики и выбери вывод.", {
          fontFamily: FONT,
          fontSize: "19px",
          color: "#4f725d",
        })
        .setOrigin(0.5),
    )

    const answers: Array<[string, PuzzleAnswer, number]> = [
      ["🌊 Посылка у ручья", "stream", 305],
      ["🌳 Посылка на дереве", "tree", 385],
      ["🕳️ Посылка в норе", "burrow", 465],
    ]
    answers.forEach(([label, answer, y]) => {
      elements.push(
        addButton(this, 640, y, 470, 58, label, () => {
          EventBus.emit(GameEvents.answerSelected, answer)
          if (answer === "burrow") this.closeModal()
        }, answer === "burrow" ? COLORS.leaf : COLORS.blue),
      )
    })
    elements.push(addButton(this, 915, 555, 88, 40, "Назад", () => this.closeModal(), 0x7d8b7f))
    this.modal = this.add.container(0, 0, elements).setDepth(410)
    this.setModalState(true)
  }

  private showCompletion(): void {
    this.closeModal()
    this.modalLocked = true
    const character = gameStore.state.character ?? CHARACTERS[0]!
    const elements: Phaser.GameObjects.GameObject[] = []
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.78).setInteractive()
    const panel = addPanel(this, 315, 112, 650, 500, COLORS.cream)
    elements.push(shade, panel)
    elements.push(
      this.add
        .text(640, 164, "ДЕЛО РАСКРЫТО!", {
          fontFamily: FONT,
          fontSize: "43px",
          fontStyle: "bold",
          color: "#173f38",
          stroke: "#f3c969",
          strokeThickness: 5,
        })
        .setOrigin(0.5),
      this.add.image(520, 335, character.assetKey).setDisplaySize(150, 190),
      this.add
        .text(740, 292, "📦", {
          fontFamily: FONT,
          fontSize: "76px",
        })
        .setOrigin(0.5),
      this.add
        .text(740, 376, "Все следы привели к норе.\nПосылка для Совёнка найдена!", {
          fontFamily: FONT,
          fontSize: "22px",
          fontStyle: "bold",
          color: "#345c4d",
          align: "center",
          lineSpacing: 8,
        })
        .setOrigin(0.5),
      this.add
        .text(640, 458, `Улик: 3/3   •   Подсказок: ${gameStore.state.puzzle.hintsUsed}`, {
          fontFamily: FONT,
          fontSize: "18px",
          color: "#765134",
        })
        .setOrigin(0.5),
      addButton(this, 520, 538, 250, 60, "В деревню →", () => this.startVillage(), COLORS.coral),
      addButton(this, 790, 538, 250, 60, "Сыграть заново", () => this.restartGame(), COLORS.leaf),
    )
    this.modal = this.add.container(0, 0, elements).setDepth(420)
    this.setModalState(true)
  }

  private populateQuestJournal(elements: Phaser.GameObjects.GameObject[]): void {
    QUEST_IDS.forEach((id, index) => {
      const quest = QUESTS[id]
      const status = gameStore.state.quests[id].status
      const progress = gameStore.questProgress(id)
      const y = 423 + index * 46
      elements.push(
        this.add.rectangle(445, y + 18, 365, 40, status === "completed" ? 0xdcebd5 : 0xefe5c5, 1).setStrokeStyle(2, 0x8b7855, 0.65),
        this.add.text(275, y + 2, `${quest.icon} ${quest.title}`, {
          fontFamily: FONT,
          fontSize: "14px",
          fontStyle: "bold",
          color: "#173f38",
        }),
        this.add.text(275, y + 21, `${this.questStatusLabel(status)} • ${Math.min(progress, quest.target)}/${quest.target}`, {
          fontFamily: FONT,
          fontSize: "12px",
          color: status === "ready" ? "#b54f3d" : "#4f725d",
        }),
      )
    })
    ERRAND_IDS.forEach((id, index) => {
      const errand = ERRANDS[id]
      const status = gameStore.state.errands[id].status
      const y = 414 + index * 35
      elements.push(
        this.add.rectangle(842, y + 15, 365, 31, status === "completed" ? 0xdcebd5 : 0xefe5c5, 1).setStrokeStyle(1, 0x8b7855, 0.65),
        this.add.text(672, y + 2, `${errand.icon} ${errand.title}`, { fontFamily: FONT, fontSize: "12px", fontStyle: "bold", color: "#173f38" }),
        this.add.text(1005, y + 4, `${this.questStatusLabel(status)} • ${gameStore.errandProgress(id)}/${errand.target}`, { fontFamily: FONT, fontSize: "10px", color: status === "ready" ? "#b54f3d" : "#4f725d" }).setOrigin(1, 0),
      )
    })
  }

  private populateGadgets(elements: Phaser.GameObjects.GameObject[]): void {
    GADGET_IDS.forEach((id, index) => {
      const gadget = GADGETS[id]
      const owned = gameStore.state.ownedGadgets.includes(id)
      const equipped = gameStore.state.equippedGadget === id
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = 445 + column * 400
      const y = 465 + row * 105
      elements.push(
        this.add.rectangle(x, y, 360, 88, owned ? 0xdcebd5 : 0xefe5c5, 1).setStrokeStyle(2, equipped ? COLORS.coral : 0x8b7855, 0.8),
        this.add.image(x - 135, y, gadget.assetKey).setDisplaySize(72, 72),
        this.add.text(x - 88, y - 30, `${gadget.icon} ${gadget.name}`, { fontFamily: FONT, fontSize: "15px", fontStyle: "bold", color: "#173f38" }),
        this.add.text(x - 88, y - 5, owned ? (equipped ? "Экипирован" : "Куплен") : `Цена: ⚙️ ${gadget.price}`, { fontFamily: FONT, fontSize: "13px", color: equipped ? "#b54f3d" : "#4f725d" }),
      )
      if (owned && !equipped) {
        elements.push(addButton(this, x + 95, y + 22, 125, 30, "Выбрать", () => {
          gameStore.equipGadget(id)
          this.switchInventoryTab("gadgets")
        }, COLORS.leaf))
      }
    })
  }

  private populateRewards(elements: Phaser.GameObjects.GameObject[]): void {
    const rewards = gameStore.state.inventory.filter((item) => item.type === "reward")
    const materials = gameStore.state.inventory.filter((item) => item.type === "building-material")
    elements.push(
      this.add.text(270, 430, `⚙️ Шестерёнки: ${gameStore.state.gears}`, { fontFamily: FONT, fontSize: "22px", fontStyle: "bold", color: "#765134" }),
      this.add.text(270, 470, `Домашние испытания: ${gameStore.state.completedHomeChallenges.length}/5`, { fontFamily: FONT, fontSize: "18px", color: "#345c4d" }),
      this.add.text(270, 508, "Памятные награды:", { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: "#173f38" }),
      this.add.text(270, 545, rewards.length ? rewards.map((item) => `${item.icon} ${item.name}`).join("   ") : "Пока наград нет", { fontFamily: FONT, fontSize: "16px", color: "#4f725d", wordWrap: { width: 720 } }),
      this.add.text(270, 585, materials.length ? `Материалы Бобра: ${materials.map((item) => `${item.icon} ${item.name}`).join("   ")}` : "Материалы Бобра: пока не куплены", { fontFamily: FONT, fontSize: "15px", color: "#765134", wordWrap: { width: 720 } }),
    )
  }

  private populateResources(elements: Phaser.GameObjects.GameObject[]): void {
    const state = gameStore.state
    SURFACE_RESOURCE_IDS.forEach((id, index) => {
      const resource = RESOURCES[id]
      const x = 340 + index * 205
      elements.push(
        this.add.rectangle(x, 470, 185, 94, 0xefe5c5, 1).setStrokeStyle(2, 0x8b7855, 0.7),
        this.add.text(x - 72, 435, resource.icon, { fontFamily: FONT, fontSize: "32px" }),
        this.add.text(x - 30, 440, resource.name, { fontFamily: FONT, fontSize: "15px", fontStyle: "bold", color: "#173f38" }),
        this.add.text(x, 488, `${state.resources[id]} / ${PICKAXE_RECIPE[id]}`, { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: state.resources[id] >= PICKAXE_RECIPE[id] ? "#4f725d" : "#b54f3d" }).setOrigin(0.5),
      )
    })
    elements.push(
      this.add.text(270, 535, `⛓️ Железо: ${state.resources.iron}     💎 Алмазы: ${state.resources.diamond}`, { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: "#345c4d" }),
      this.add.text(270, 575, state.hasPickaxe ? "⛏️ Каменная кирка создана. Можно добывать руду в шахте." : "Рецепт кирки: 3 камня + 2 палки + 1 верёвка + 1 хлам", { fontFamily: FONT, fontSize: "17px", color: state.hasPickaxe ? "#4f725d" : "#765134" }),
    )
    if (!state.hasPickaxe) {
      elements.push(addButton(this, 870, 575, 250, 48, gameStore.canCraftPickaxe() ? "Создать кирку" : "Не хватает ресурсов", () => {
        if (gameStore.craftPickaxe()) {
          this.showNotification("⛏️ Кирка готова! Теперь можно добывать железо и алмазы.", 2600)
          this.switchInventoryTab("resources")
        }
      }, gameStore.canCraftPickaxe() ? COLORS.coral : 0x8b958b))
    }
  }

  private populateSaves(elements: Phaser.GameObjects.GameObject[]): void {
    elements.push(this.add.text(270, 417, "Автосейв обновляется только при переходе между локациями.", {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#765134",
      wordWrap: { width: 740 },
    }))
    SAVE_SLOTS.forEach((slot, index) => {
      const envelope = saveManager.read(slot)
      const y = 462 + index * 43
      const slotName = slot === "auto" ? "Автосейв" : `Слот ${index}`
      const summary = envelope
        ? `${envelope.summary.characterName} • ${LOCATION_LABELS[envelope.summary.location]}`
        : "Пусто"
      const savedAt = envelope ? new Date(envelope.savedAt).toLocaleString("ru-RU") : ""
      elements.push(
        this.add.rectangle(642, y, 744, 38, envelope ? 0xefe5c5 : 0xe2e1d5, 1).setStrokeStyle(1, 0x8b7855, 0.65),
        this.add.text(282, y - 8, slotName, {
          fontFamily: FONT,
          fontSize: "12px",
          fontStyle: "bold",
          color: envelope ? "#173f38" : "#657266",
        }),
        this.add.text(360, envelope ? y - 14 : y - 8, summary, {
          fontFamily: FONT,
          fontSize: "11px",
          fontStyle: envelope ? "bold" : "normal",
          color: envelope ? "#173f38" : "#7d8b7f",
          fixedWidth: slot === "auto" ? 470 : 320,
          maxLines: 1,
        }),
      )
      if (savedAt) {
        elements.push(this.add.text(360, y + 2, savedAt, {
          fontFamily: FONT,
          fontSize: "10px",
          color: "#765134",
          fixedWidth: slot === "auto" ? 470 : 320,
          maxLines: 1,
        }))
      }
      if (slot !== "auto") {
        elements.push(addButton(this, 748, y, 104, 28, envelope ? "Перезаписать" : "Сохранить", () => this.saveToSlot(slot), COLORS.leaf, "13px"))
      }
      if (envelope) {
        elements.push(addButton(this, slot === "auto" ? 950 : 858, y, 92, 28, "Загрузить", () => this.loadFromSlot(slot), COLORS.blue, "13px"))
        if (slot !== "auto") elements.push(addButton(this, 966, y, 88, 28, "Удалить", () => this.deleteSlot(slot), COLORS.coral, "13px"))
      }
    })
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) {
      status.dataset.saveMenuOpen = "true"
      status.dataset.saveSlots = SAVE_SLOTS.map((slot) => `${slot}:${saveManager.read(slot) ? "filled" : "empty"}`).join(",")
    }
  }

  private switchInventoryTab(tab: "quests" | "gadgets" | "resources" | "rewards" | "saves"): void {
    this.closeModal()
    this.inventoryTab = tab
    this.openInventory()
  }

  private saveToSlot(slot: SaveSlotId): void {
    if (saveManager.read(slot) && !window.confirm("Перезаписать выбранный слот?")) return
    const result = saveManager.save(slot)
    this.showNotification(result.message, 2200)
    this.switchInventoryTab("saves")
  }

  private loadFromSlot(slot: SaveSlotId): void {
    if (!window.confirm("Загрузить сохранение? Несохранённый прогресс текущей игры будет потерян.")) return
    const result = saveManager.load(slot)
    if (!result.ok) {
      this.showNotification(result.message, 2600)
      return
    }
    this.startLoadedLocation()
  }

  private deleteSlot(slot: SaveSlotId): void {
    if (!window.confirm("Удалить это сохранение?")) return
    saveManager.remove(slot)
    this.showNotification("Слот удалён.", 1600)
    this.switchInventoryTab("saves")
  }

  private startLoadedLocation(): void {
    const sceneKey = sceneKeyForLocation(gameStore.state.location)
    this.modal?.destroy(true)
    this.modal = null
    WORLD_SCENES.forEach((key) => this.scene.stop(key))
    this.scene.start(sceneKey)
  }

  private openQuest(id: QuestId): void {
    this.closeModal()
    this.modalLocked = false
    const quest = QUESTS[id]
    const status = gameStore.state.quests[id].status
    const progress = gameStore.questProgress(id)
    const elements: Phaser.GameObjects.GameObject[] = []
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.74).setInteractive()
    const panel = addPanel(this, 315, 135, 650, 450)
    elements.push(shade, panel)
    elements.push(
      this.add.text(640, 178, `${quest.icon} ${quest.npcName}`, {
        fontFamily: FONT,
        fontSize: "29px",
        fontStyle: "bold",
        color: "#173f38",
      }).setOrigin(0.5),
      this.add.text(640, 230, quest.title, {
        fontFamily: FONT,
        fontSize: "25px",
        fontStyle: "bold",
        color: "#765134",
      }).setOrigin(0.5),
      this.add.text(640, 300, quest.description, {
        fontFamily: FONT,
        fontSize: "19px",
        color: "#345c4d",
        align: "center",
        wordWrap: { width: 535 },
      }).setOrigin(0.5),
      this.add.text(640, 382, `Прогресс: ${Math.min(progress, quest.target)} из ${quest.target}\n${this.questStatusLabel(status)}`, {
        fontFamily: FONT,
        fontSize: "20px",
        fontStyle: "bold",
        color: status === "ready" ? "#b54f3d" : "#4f725d",
        align: "center",
      }).setOrigin(0.5),
    )

    if (status === "available") {
      elements.push(addButton(this, 640, 480, 300, 58, "Принять задание", () => {
        gameStore.acceptQuest(id)
        this.openQuest(id)
      }, COLORS.coral))
    } else if (status === "ready") {
      elements.push(addButton(this, 640, 480, 300, 58, "Сдать задание", () => {
        gameStore.turnInQuest(id)
        if (gameStore.state.villageSaved) this.showChapterCompletion()
        else this.openQuest(id)
      }, COLORS.coral))
    } else if (status === "completed") {
      elements.push(this.add.text(640, 485, `${quest.reward.icon} Награда получена: ${quest.reward.name}`, {
        fontFamily: FONT,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#4f725d",
      }).setOrigin(0.5))
    }
    elements.push(addButton(this, 875, 548, 120, 40, "Закрыть", () => this.closeModal(), 0x7d8b7f))
    this.modal = this.add.container(0, 0, elements).setDepth(430)
    this.setModalState(true)
  }

  private openErrand(id: ErrandId): void {
    this.closeModal()
    this.modalLocked = false
    const errand = ERRANDS[id]
    const status = gameStore.state.errands[id].status
    const progress = gameStore.errandProgress(id)
    const elements: Phaser.GameObjects.GameObject[] = []
    elements.push(
      this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.74).setInteractive(),
      addPanel(this, 315, 145, 650, 430),
      this.add.text(640, 190, `${errand.icon} ${errand.npcName}`, { fontFamily: FONT, fontSize: "29px", fontStyle: "bold", color: "#173f38" }).setOrigin(0.5),
      this.add.text(640, 240, errand.title, { fontFamily: FONT, fontSize: "24px", fontStyle: "bold", color: "#765134" }).setOrigin(0.5),
      this.add.text(640, 305, errand.description, { fontFamily: FONT, fontSize: "19px", color: "#345c4d", align: "center", wordWrap: { width: 520 } }).setOrigin(0.5),
      this.add.text(640, 380, `Прогресс: ${progress}/${errand.target} • Награда: ⚙️ ${errand.reward}${errand.rewardItem ? ` + ${errand.rewardItem.icon} ${errand.rewardItem.name}` : ""}\n${this.questStatusLabel(status)}`, { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: status === "ready" ? "#b54f3d" : "#4f725d", align: "center", wordWrap: { width: 560 } }).setOrigin(0.5),
    )
    if (status === "available") {
      elements.push(addButton(this, 640, 472, 280, 56, "Принять поручение", () => {
        gameStore.acceptErrand(id)
        this.openErrand(id)
      }, COLORS.coral))
    } else if (status === "ready") {
      elements.push(addButton(this, 640, 472, 280, 56, "Завершить поручение", () => {
        gameStore.turnInErrand(id)
        this.openErrand(id)
      }, COLORS.coral))
    } else if (status === "completed") {
      elements.push(this.add.text(640, 472, errand.rewardItem ? `⚙️ ${errand.reward} и ${errand.rewardItem.icon} ${errand.rewardItem.name} получены` : "⚙️ Награда получена", { fontFamily: FONT, fontSize: "19px", fontStyle: "bold", color: "#4f725d" }).setOrigin(0.5))
    }
    elements.push(addButton(this, 875, 538, 120, 40, "Закрыть", () => this.closeModal(), 0x7d8b7f))
    this.modal = this.add.container(0, 0, elements).setDepth(430)
    this.setModalState(true)
  }

  private openShop(id: GadgetId): void {
    this.closeModal()
    this.modalLocked = false
    const gadget = GADGETS[id]
    const owned = gameStore.state.ownedGadgets.includes(id)
    const equipped = gameStore.state.equippedGadget === id
    const canBuy = gameStore.state.gears >= gadget.price
    const elements: Phaser.GameObjects.GameObject[] = []
    elements.push(
      this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.76).setInteractive(),
      addPanel(this, 300, 115, 680, 500),
      this.add.image(470, 335, gadget.assetKey).setDisplaySize(230, 230),
      this.add.text(745, 185, `${gadget.icon} ${gadget.name}`, { fontFamily: FONT, fontSize: "28px", fontStyle: "bold", color: "#173f38" }).setOrigin(0.5),
      this.add.text(745, 280, gadget.description, { fontFamily: FONT, fontSize: "19px", color: "#345c4d", align: "center", wordWrap: { width: 390 } }).setOrigin(0.5),
      this.add.text(745, 370, owned ? (equipped ? "Устройство экипировано" : "Устройство уже куплено") : `Цена: ⚙️ ${gadget.price}\nВ рюкзаке: ⚙️ ${gameStore.state.gears}`, { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: equipped ? "#b54f3d" : "#765134", align: "center" }).setOrigin(0.5),
    )
    if (!owned) {
      elements.push(addButton(this, 745, 480, 260, 58, canBuy ? "Купить" : "Не хватает шестерёнок", () => {
        if (gameStore.purchaseGadget(id)) this.openShop(id)
      }, canBuy ? COLORS.coral : 0x8b958b))
    } else if (!equipped) {
      elements.push(addButton(this, 745, 480, 260, 58, "Экипировать", () => {
        gameStore.equipGadget(id)
        this.openShop(id)
      }, COLORS.leaf))
    }
    elements.push(addButton(this, 875, 562, 120, 40, "Закрыть", () => this.closeModal(), 0x7d8b7f))
    this.modal = this.add.container(0, 0, elements).setDepth(440)
    this.setModalState(true)
  }

  private openMaterialsShop(): void {
    this.closeModal()
    this.modalLocked = false
    const elements: Phaser.GameObjects.GameObject[] = []
    elements.push(
      this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.76).setInteractive(),
      addPanel(this, 260, 105, 760, 520),
      this.add.text(640, 150, "🦫 МАТЕРИАЛЫ БОБРА", {
        fontFamily: FONT,
        fontSize: "30px",
        fontStyle: "bold",
        color: "#173f38",
      }).setOrigin(0.5),
      this.add.text(640, 198, `Учебные ловушки с мягкими стопорами  •  В рюкзаке ⚙️ ${gameStore.state.gears}`, {
        fontFamily: FONT,
        fontSize: "17px",
        color: "#4f725d",
      }).setOrigin(0.5),
    )
    BUILDING_MATERIAL_IDS.forEach((id, index) => {
      const material = BUILDING_MATERIALS[id]
      const owned = gameStore.state.ownedBuildingMaterials.includes(id)
      const canBuy = gameStore.state.gears >= material.price
      const x = 470 + index * 340
      elements.push(
        this.add.rectangle(x, 385, 300, 300, owned ? 0xdcebd5 : 0xefe5c5, 1).setStrokeStyle(3, owned ? COLORS.leaf : 0x8b7855, 0.8),
        this.add.text(x, 285, material.icon, { fontFamily: FONT, fontSize: "62px" }).setOrigin(0.5),
        this.add.text(x, 340, material.name, { fontFamily: FONT, fontSize: "19px", fontStyle: "bold", color: "#173f38", align: "center" }).setOrigin(0.5),
        this.add.text(x, 407, material.description, { fontFamily: FONT, fontSize: "15px", color: "#345c4d", align: "center", wordWrap: { width: 250 } }).setOrigin(0.5),
        this.add.text(x, 485, owned ? "Куплено" : `Цена: ⚙️ ${material.price}`, { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: owned ? "#4f725d" : "#765134" }).setOrigin(0.5),
      )
      if (!owned) {
        elements.push(addButton(this, x, 545, 230, 46, canBuy ? "Купить комплект" : "Не хватает шестерёнок", () => {
          this.buyMaterial(id)
        }, canBuy ? COLORS.coral : 0x8b958b))
      }
    })
    elements.push(addButton(this, 930, 585, 120, 40, "Закрыть", () => this.closeModal(), 0x7d8b7f))
    this.modal = this.add.container(0, 0, elements).setDepth(440)
    this.setModalState(true)
  }

  private buyMaterial(id: BuildingMaterialId): void {
    if (gameStore.purchaseBuildingMaterial(id)) this.openMaterialsShop()
  }

  private openProduceShop(): void {
    this.closeModal()
    this.modalLocked = false
    const elements: Phaser.GameObjects.GameObject[] = []
    elements.push(
      this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.76).setInteractive(),
      addPanel(this, 260, 100, 760, 525),
      this.add.text(640, 145, "🌿 ЛАВОЧКА ТЁТИ ДЫНИ", {
        fontFamily: FONT,
        fontSize: "30px",
        fontStyle: "bold",
        color: "#173f38",
      }).setOrigin(0.5),
      this.add.text(640, 192, `Любой набор: 2 овоща за ⚙️ 1  •  В рюкзаке ⚙️ ${gameStore.state.gears}`, {
        fontFamily: FONT,
        fontSize: "17px",
        color: "#4f725d",
      }).setOrigin(0.5),
    )
    PRODUCE_IDS.forEach((id, index) => {
      const produce = PRODUCE[id]
      const x = 470 + index * 340
      elements.push(
        this.add.rectangle(x, 385, 300, 300, 0xefe5c5, 1).setStrokeStyle(3, 0x8b7855, 0.8),
        this.add.text(x, 278, produce.icon, { fontFamily: FONT, fontSize: "66px" }).setOrigin(0.5),
        this.add.text(x, 335, produce.name, { fontFamily: FONT, fontSize: "21px", fontStyle: "bold", color: "#173f38" }).setOrigin(0.5),
        this.add.text(x, 405, produce.description, { fontFamily: FONT, fontSize: "15px", color: "#345c4d", align: "center", wordWrap: { width: 250 } }).setOrigin(0.5),
        this.add.text(x, 478, `В рюкзаке: ${produce.icon} ${gameStore.state.produceAmmo[id]}`, { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: "#765134" }).setOrigin(0.5),
        addButton(this, x, 540, 230, 46, gameStore.state.gears >= produce.price ? "Купить 2 за ⚙️ 1" : "Не хватает шестерёнок", () => {
          this.buyProduce(id)
        }, gameStore.state.gears >= produce.price ? COLORS.coral : 0x8b958b),
      )
    })
    elements.push(
      this.add.text(640, 584, "R — переключить оружие  •  Помидор или огурец: 0,5 урона", { fontFamily: FONT, fontSize: "15px", color: "#4f725d" }).setOrigin(0.5),
      addButton(this, 940, 594, 110, 38, "Закрыть", () => this.closeModal(), 0x7d8b7f),
    )
    this.modal = this.add.container(0, 0, elements).setDepth(440)
    this.setModalState(true)
  }

  private buyProduce(id: ProduceId): void {
    if (gameStore.purchaseProduce(id)) this.openProduceShop()
  }

  private showMountainCompletion(): void {
    this.closeModal(true)
    this.modalLocked = true
    updateGameStatus("mountain-complete", "Горная Лощина освобождена.")
    const character = gameStore.state.character ?? CHARACTERS[0]!
    const elements: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.82).setInteractive(),
      addPanel(this, 300, 105, 680, 510, COLORS.cream),
      this.add.text(640, 155, "ГОРНАЯ ЛОЩИНА ОСВОБОЖДЕНА!", { fontFamily: FONT, fontSize: "34px", fontStyle: "bold", color: "#173f38", stroke: "#f3c969", strokeThickness: 4 }).setOrigin(0.5),
      this.add.image(465, 350, character.assetKey).setDisplaySize(145, 190),
      this.add.text(735, 290, "⛰️  ⛓️ ×4  💎 ×2", { fontFamily: FONT, fontSize: "42px" }).setOrigin(0.5),
      this.add.text(735, 382, "Оба медведя-стражника отключены.\nПолучен Знак Горной Лощины и редкие ресурсы!", { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#345c4d", align: "center", lineSpacing: 8 }).setOrigin(0.5),
      addButton(this, 505, 540, 285, 58, "Остаться в Лощине", () => {
        this.closeModal(true)
        updateGameStatus("mountain-hollow", "Горная Лощина свободна.")
      }, COLORS.leaf),
      addButton(this, 810, 540, 265, 58, "В Птичий перевал", () => this.goToBirdPass(), COLORS.coral),
    ]
    this.modal = this.add.container(0, 0, elements).setDepth(470)
    this.setModalState(true)
  }

  private goToBirdPass(): void {
    this.modal?.destroy(true)
    this.modal = null
    this.modalLocked = false
    gameStore.setLocation("bird-pass")
    this.scene.stop("mountain-hollow")
    this.scene.start("bird-pass")
  }

  private showChapterCompletion(): void {
    this.closeModal()
    this.modalLocked = true
    updateGameStatus("chapter-complete", "Деревня спасена. Путь к финалу второй главы остаётся открытым.")
    const character = gameStore.state.character ?? CHARACTERS[0]!
    const elements: Phaser.GameObjects.GameObject[] = []
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.8).setInteractive()
    const panel = addPanel(this, 300, 105, 680, 510, COLORS.cream)
    elements.push(
      shade,
      panel,
      this.add.text(640, 155, "ДЕРЕВНЯ СПАСЕНА!", {
        fontFamily: FONT,
        fontSize: "40px",
        fontStyle: "bold",
        color: "#173f38",
        stroke: "#f3c969",
        strokeThickness: 5,
      }).setOrigin(0.5),
      this.add.image(475, 345, character.assetKey).setDisplaySize(145, 190),
      this.add.text(740, 300, "📯  🛠️  🏅  🎖️", { fontFamily: FONT, fontSize: "45px" }).setOrigin(0.5),
      this.add.text(740, 380, "Письма возвращены, робозвери обезврежены,\nа защита дома Бобра отключена. Приключение продолжается!", {
        fontFamily: FONT,
        fontSize: "20px",
        fontStyle: "bold",
        color: "#345c4d",
        align: "center",
        lineSpacing: 7,
      }).setOrigin(0.5),
      addButton(this, 510, 540, 270, 58, "Продолжить прогулку", () => this.closeModal(true), COLORS.leaf),
      addButton(this, 795, 540, 250, 58, "В Дикий лес", () => this.goToWildForest(), COLORS.coral),
    )
    this.modal = this.add.container(0, 0, elements).setDepth(450)
    this.setModalState(true)
  }

  private goToWildForest(): void {
    this.modal?.destroy(true)
    this.modal = null
    this.modalLocked = false
    gameStore.setLocation("wild-forest")
    this.scene.stop("forest-village")
    this.scene.start("wild-forest")
  }

  private showBirdPassCompletion(): void {
    this.closeModal(true)
    this.modalLocked = true
    updateGameStatus("bird-pass-complete", "Бронепанцирь побеждён. Вторая глава завершена.")
    const character = gameStore.state.character ?? CHARACTERS[0]!
    const elements: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.84).setInteractive(),
      addPanel(this, 285, 92, 710, 536, COLORS.cream),
      this.add.text(640, 145, "ПТИЧИЙ ПЕРЕВАЛ ОСВОБОЖДЁН!", { fontFamily: FONT, fontSize: "34px", fontStyle: "bold", color: "#173f38", stroke: "#9cf4ff", strokeThickness: 4 }).setOrigin(0.5),
      this.add.image(455, 350, character.assetKey).setDisplaySize(145, 190),
      this.add.text(745, 280, "🪶  ⚙️ ×8  🏅", { fontFamily: FONT, fontSize: "45px" }).setOrigin(0.5),
      this.add.text(745, 382, "Робочерепаха Бронепанцирь отключена.\nВторая глава завершена — в деревне начинается зима.", { fontFamily: FONT, fontSize: "20px", fontStyle: "bold", color: "#345c4d", align: "center", lineSpacing: 8, wordWrap: { width: 440 } }).setOrigin(0.5),
      addButton(this, 500, 548, 285, 58, "Остаться на перевале", () => {
        this.closeModal(true)
        updateGameStatus("bird-pass", "Птичий перевал свободен.")
      }, COLORS.leaf),
      addButton(this, 810, 548, 295, 58, "В деревню — глава 3", () => this.startChapterThreeFromPass(), COLORS.coral),
    ]
    this.modal = this.add.container(0, 0, elements).setDepth(480)
    this.setModalState(true)
  }

  private startChapterThreeFromPass(): void {
    this.modal?.destroy(true)
    this.modal = null
    this.modalLocked = false
    gameStore.beginChapterThree()
    this.scene.stop("bird-pass")
    this.scene.start("forest-village")
    updateGameStatus("chapter-three", "Глава 3. В деревне начинается снегопад.")
  }

  private openPause(): void {
    if (this.modal || this.pauseOpen) return
    this.pauseOpen = true
    this.pausedWorldScenes = WORLD_SCENES.filter((key) => this.scene.isActive(key))
    for (const key of this.pausedWorldScenes) this.scene.pause(key)
    this.renderPauseModal()
    updateGameStatus("pause-menu", `Пауза. Сложность: ${DIFFICULTIES[gameStore.state.difficulty].name}.`)
  }

  private renderPauseModal(): void {
    this.modal?.destroy(true)
    const difficulty = gameStore.state.difficulty
    const elements: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(640, 360, 1280, 720, 0x071b17, 0.76).setInteractive(),
      addPanel(this, 345, 75, 590, 570, COLORS.cream),
      this.add.text(640, 125, "ПАУЗА", { fontFamily: FONT, fontSize: "38px", fontStyle: "bold", color: "#173f38" }).setOrigin(0.5),
      this.add.text(640, 170, "Сложность можно изменить в любой момент", { fontFamily: FONT, fontSize: "17px", color: "#4f725d" }).setOrigin(0.5),
    ]
    DIFFICULTY_IDS.forEach((id, index) => {
      const definition = DIFFICULTIES[id]
      const y = 235 + index * 72
      const selected = id === difficulty
      elements.push(
        addButton(this, 510, y, 250, 50, `${selected ? "✓ " : ""}${definition.name}`, () => this.selectDifficulty(id), selected ? COLORS.coral : COLORS.leafDark),
        this.add.text(660, y, definition.description, { fontFamily: FONT, fontSize: "14px", color: "#345c4d", wordWrap: { width: 235 } }).setOrigin(0, 0.5),
      )
    })
    elements.push(
      addButton(this, 640, 570, 300, 54, "Продолжить  •  Esc", () => this.closePause(), COLORS.blue),
    )
    this.modal = this.add.container(0, 0, elements).setDepth(520)
    this.setModalState(true)
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) status.dataset.pauseOpen = "true"
  }

  private selectDifficulty(id: DifficultyId): void {
    if (gameStore.setDifficulty(id)) {
      saveManager.save("auto")
      EventBus.emit(GameEvents.showMessage, `Сложность: ${DIFFICULTIES[id].name}.`, 1500)
    }
    this.renderPauseModal()
    updateGameStatus("pause-menu", `Пауза. Сложность: ${DIFFICULTIES[id].name}.`)
  }

  private closePause(): void {
    if (!this.pauseOpen) return
    this.modal?.destroy(true)
    this.modal = null
    this.modalLocked = false
    this.pauseOpen = false
    this.setModalState(false)
    for (const key of this.pausedWorldScenes) {
      if (this.scene.isPaused(key)) this.scene.resume(key)
    }
    this.pausedWorldScenes = []
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) {
      status.dataset.pauseOpen = "false"
      status.dataset.screen = gameStore.state.location
      status.textContent = `Игра продолжена. ${LOCATION_LABELS[gameStore.state.location]}.`
    }
  }

  private questStatusLabel(status: QuestStatus): string {
    if (status === "available") return "Не принято"
    if (status === "active") return "Выполняется"
    if (status === "ready") return "Можно сдавать"
    return "Выполнено"
  }

  private closeModal(force = false): void {
    if (this.pauseOpen) {
      this.closePause()
      return
    }
    if (!this.modal || (this.modalLocked && !force)) return
    this.modal.destroy(true)
    this.modal = null
    this.modalLocked = false
    this.setModalState(false)
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) status.dataset.saveMenuOpen = "false"
  }

  private handleEscape(): void {
    if (this.pauseOpen) this.closePause()
    else if (this.modal) this.closeModal()
    else this.openPause()
  }

  private setModalState(open: boolean): void {
    this.promptText.setVisible(!open && this.promptText.text.length > 0)
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) status.dataset.modalOpen = String(open)
    EventBus.emit("modal-state", open)
  }

  private restartGame(): void {
    this.modal?.destroy(true)
    this.modal = null
    saveManager.startNewGame()
    this.scene.stop("forest-clearing")
    this.scene.stop("forest-village")
    this.scene.stop("wild-forest")
    this.scene.stop("mountain-hollow")
    this.scene.stop("bird-pass")
    this.scene.stop("forest-mine")
    this.scene.stop("melon-farm")
    this.scene.stop("mole-shop")
    this.scene.stop("hero-home")
    this.scene.stop("beaver-house")
    this.scene.stop()
    this.scene.start("character-select")
  }

  private startVillage(): void {
    this.modal?.destroy(true)
    this.modal = null
    gameStore.beginVillageChapter()
    this.scene.stop("forest-clearing")
    this.scene.stop()
    this.scene.start("forest-village")
  }
}
