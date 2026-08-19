import Phaser from "phaser"

export const EventBus = new Phaser.Events.EventEmitter()

export const GameEvents = {
  showMessage: "show-message",
  showDialogue: "show-dialogue",
  promptChanged: "prompt-changed",
  toggleInventory: "toggle-inventory",
  openInventory: "open-inventory",
  showDeduction: "show-deduction",
  answerSelected: "answer-selected",
  puzzleSolved: "puzzle-solved",
  openQuest: "open-quest",
  openErrand: "open-errand",
  openShop: "open-shop",
  openMaterials: "open-materials",
  openProduceShop: "open-produce-shop",
  chapterComplete: "chapter-complete",
  mountainComplete: "mountain-complete",
} as const
