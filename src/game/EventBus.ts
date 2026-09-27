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
  openScubaShop: "open-scuba-shop",
  oceanIntro: "ocean-intro",
  oceanComplete: "ocean-complete",
  openMaterials: "open-materials",
  openProduceShop: "open-produce-shop",
  openKrokMarket: "open-krok-market",
  openKrokPotions: "open-krok-potions",
  chapterComplete: "chapter-complete",
  mountainComplete: "mountain-complete",
  birdPassComplete: "bird-pass-complete",
  walrusComplete: "walrus-complete",
  togglePause: "toggle-pause",
} as const
