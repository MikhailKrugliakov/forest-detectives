import Phaser from "phaser"
import "./style.css"
import { updateGameStatus } from "./accessibility"
import { gameStore } from "./domain/GameStore"
import { EventBus } from "./game/EventBus"
import { BootScene } from "./game/scenes/BootScene"
import { CharacterSelectScene } from "./game/scenes/CharacterSelectScene"
import { ForestClearingScene } from "./game/scenes/ForestClearingScene"
import { ForestVillageScene } from "./game/scenes/ForestVillageScene"
import { PreloadScene } from "./game/scenes/PreloadScene"
import { UIScene } from "./game/scenes/UIScene"
import { WildForestScene } from "./game/scenes/WildForestScene"
import { ForestMineScene } from "./game/scenes/ForestMineScene"
import { MoleShopScene } from "./game/scenes/MoleShopScene"
import { HeroHomeScene } from "./game/scenes/HeroHomeScene"
import { BeaverHouseScene } from "./game/scenes/BeaverHouseScene"
import { MelonFarmScene } from "./game/scenes/MelonFarmScene"
import { MainMenuScene } from "./game/scenes/MainMenuScene"
import { MountainHollowScene } from "./game/scenes/MountainHollowScene"
import { SAVE_SLOTS, saveManager } from "./domain/saves"
import { healingPotionState } from "./domain/healing"

updateGameStatus("loading", "Игра загружается")
saveManager.bindAutosave()

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 1280,
  height: 720,
  backgroundColor: "#173f38",
  render: {
    antialias: true,
    pixelArt: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      fps: 60,
      fixedStep: true,
    },
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    CharacterSelectScene,
    ForestClearingScene,
    ForestVillageScene,
    WildForestScene,
    MountainHollowScene,
    ForestMineScene,
    MoleShopScene,
    HeroHomeScene,
    BeaverHouseScene,
    MelonFarmScene,
    UIScene,
  ],
}

new Phaser.Game(config)

gameStore.subscribe((state) => {
  const status = document.querySelector<HTMLElement>("#game-status")
  if (!status) return
  status.dataset.character = state.character?.id ?? ""
  status.dataset.clues = String(state.puzzle.foundClues.length)
  status.dataset.completed = String(state.puzzle.completed)
  status.dataset.location = state.location
  status.dataset.health = String(state.health)
  const potionState = healingPotionState(state.healingPotionReadyAt)
  status.dataset.healingPotions = String(potionState.ready)
  status.dataset.healingPotionReadyAt = state.healingPotionReadyAt.join(",")
  status.dataset.enemies = String(state.totalEnemyDefeats)
  status.dataset.wildForestEnemies = String(state.wildForestEnemyDefeats)
  status.dataset.mountainEnemies = String(state.mountainEnemyDefeats)
  status.dataset.mountainCleared = String(state.mountainCleared)
  status.dataset.mountainUnlocked = String(gameStore.isMountainUnlocked())
  status.dataset.uniqueEnemies = String(state.defeatedEnemies.length)
  status.dataset.enemyDefeatCounts = Object.entries(state.enemyDefeatCounts).map(([id, count]) => `${id}:${count}`).join(",")
  status.dataset.enemyGearDrops = String(state.enemyGearDrops.filter(({ collected }) => !collected).length)
  status.dataset.entryFrom = state.entryFrom ?? ""
  status.dataset.enemyRespawns = Object.entries(state.enemyRespawnAt)
    .map(([id, at]) => `${id}:${at}`)
    .join(",")
  status.dataset.quests = Object.values(state.quests).map(({ status: questStatus }) => questStatus).join(",")
  status.dataset.gears = String(state.gears)
  status.dataset.gadget = state.equippedGadget ?? ""
  status.dataset.errands = Object.values(state.errands).map(({ status: errandStatus }) => errandStatus).join(",")
  status.dataset.homeChallenges = String(state.completedHomeChallenges.length)
  status.dataset.beaverRooms = String(state.beaverHouse.completedRooms.length)
  status.dataset.buildingMaterials = state.ownedBuildingMaterials.join(",")
  status.dataset.weapon = state.equippedWeapon
  status.dataset.tomatoes = String(state.produceAmmo.tomato)
  status.dataset.cucumbers = String(state.produceAmmo.cucumber)
  status.dataset.chasmCrossed = String(state.beaverHouse.chasmCrossed)
  status.dataset.resources = Object.entries(state.resources).map(([id, amount]) => `${id}:${amount}`).join(",")
  status.dataset.pickaxe = String(state.hasPickaxe)
  status.dataset.mineSeed = String(state.mineSeed)
  status.dataset.mineEntrance = String(state.mineEntranceIndex)
  status.dataset.saveSlots = SAVE_SLOTS.map((slot) => `${slot}:${saveManager.read(slot) ? "filled" : "empty"}`).join(",")
})

if (import.meta.env.DEV) {
  window.__FOREST_GAME__ = {
    store: gameStore,
    selectCharacter: (id) => gameStore.selectCharacter(id),
    collectClue: (id) => gameStore.collectClue(id),
    answer: (answer) => gameStore.answer(answer),
    beginVillage: () => gameStore.beginVillageChapter(),
    setLocation: (location) => gameStore.setLocation(location),
    acceptQuest: (id) => gameStore.acceptQuest(id),
    turnInQuest: (id) => gameStore.turnInQuest(id),
    collectLetter: (id) => gameStore.collectLetter(id),
    defeatEnemy: (id) => gameStore.defeatEnemy(id),
    collectPart: (id) => gameStore.collectPart(id),
    collectEnemyGearDrop: (id) => gameStore.collectEnemyGearDrop(id),
    takeDamage: (amount) => gameStore.takeDamage(amount),
    useHealingPotion: (now) => gameStore.useHealingPotion(now),
    awardGears: (source, amount) => gameStore.awardGears(source, amount),
    purchaseGadget: (id) => gameStore.purchaseGadget(id),
    purchaseBuildingMaterial: (id) => gameStore.purchaseBuildingMaterial(id),
    purchaseProduce: (id) => gameStore.purchaseProduce(id),
    collectResource: (nodeId, id) => gameStore.collectResource(nodeId, id),
    craftPickaxe: () => gameStore.craftPickaxe(),
    equipWeapon: (id) => gameStore.equipWeapon(id),
    cycleWeapon: () => gameStore.cycleWeapon(),
    equipGadget: (id) => gameStore.equipGadget(id),
    acceptErrand: (id) => gameStore.acceptErrand(id),
    completeErrandTarget: (id, target) => gameStore.completeErrandTarget(id, target),
    turnInErrand: (id) => gameStore.turnInErrand(id),
    completeHomeChallenge: (id) => gameStore.completeHomeChallenge(id),
    completeBeaverRoom: (id) => gameStore.completeBeaverRoom(id),
    crossBeaverChasm: () => gameStore.crossBeaverChasm(),
    saveGame: (slot) => saveManager.save(slot).ok,
    loadGame: (slot) => saveManager.load(slot).ok,
    deleteSave: (slot) => saveManager.remove(slot),
    damageEnemy: (id, amount) => EventBus.emit("debug-damage-enemy", id, amount),
    teleport: (x, y) => EventBus.emit("debug-teleport", x, y),
  }
}
