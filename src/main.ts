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
import { BirdPassScene } from "./game/scenes/BirdPassScene"
import { IcePalaceScene, IceThroneScene, KrokOutskirtsScene, SnowCityScene, SnowValleyScene } from "./game/scenes/SnowWorldScene"
import { KrokCityScene } from "./game/scenes/KrokCityScene"
import { BeachScene, SeaScene, TrenchScene } from "./game/scenes/OceanWorldScene"
import { SAVE_SLOTS, saveManager } from "./domain/saves"
import { healingPotionState } from "./domain/healing"
import { SnowfallController } from "./game/SnowfallController"
import { sceneActors } from "./game/animation/AnimatedActor"
import { AnimationGalleryScene } from "./game/scenes/AnimationGalleryScene"

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
    BirdPassScene,
    SnowValleyScene,
    SnowCityScene,
    KrokOutskirtsScene,
    KrokCityScene,
    IcePalaceScene,
    IceThroneScene,
    BeachScene,
    SeaScene,
    TrenchScene,
    ForestMineScene,
    MoleShopScene,
    HeroHomeScene,
    BeaverHouseScene,
    MelonFarmScene,
    UIScene,
    ...(import.meta.env.DEV ? [AnimationGalleryScene] : []),
  ],
}

const game = new Phaser.Game(config)

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
  status.dataset.birdEnemies = String(state.birdPassEnemyDefeats)
  status.dataset.birdPassCleared = String(state.birdPassCleared)
  status.dataset.snowValleyEnemies = String(state.snowValleyEnemyDefeats)
  status.dataset.snowCityEnemies = String(state.snowCityEnemyDefeats)
  status.dataset.krokSiege = String(state.defeatedEnemies.filter((id) => id.startsWith("siege-")).length)
  status.dataset.krokGateOpen = String(state.krokSiegeCleared)
  status.dataset.krokErrands = Object.entries(state.krokErrands).map(([id, item]) => `${id}:${item.status}:${item.completedTargets.length}`).join(",")
  status.dataset.princeQuest = state.princeQuest.status
  status.dataset.premiumAmmo = `${state.produceAmmo["dense-tomato"]},${state.produceAmmo["large-cucumber"]}`
  status.dataset.icePalaceEnemies = String(state.icePalaceEnemyDefeats)
  status.dataset.walrusCleared = String(state.walrusCleared)
  status.dataset.oceanIntro = String(state.ocean.introSeen)
  status.dataset.beachVisited = String(state.ocean.beachVisited)
  status.dataset.returnToMole = String(state.ocean.returnToMole)
  status.dataset.scuba = String(state.ocean.hasScuba)
  status.dataset.sharkCleared = String(state.ocean.sharkCleared)
  status.dataset.ichthyosaurCleared = String(state.ocean.ichthyosaurCleared)
  status.dataset.flood = String(state.walrusCleared && !state.ocean.mechanismDisabled)
  status.dataset.oceanComplete = String(state.ocean.mechanismDisabled)
  status.dataset.chapter = String(state.chapter)
  status.dataset.chapterTwoCompleted = String(state.chapterTwoCompleted)
  status.dataset.difficulty = state.difficulty
  status.dataset.snow = String(SnowfallController.shouldRun(state.location, state.chapter))
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
    getSceneTexts: () => {
      const texts: string[] = []
      const collect = (object: Phaser.GameObjects.GameObject) => {
        if (object instanceof Phaser.GameObjects.Text && object.visible) texts.push(object.text)
        if (object instanceof Phaser.GameObjects.Container && object.visible) object.list.forEach(collect)
      }
      for (const scene of game.scene.getScenes(true)) scene.children.list.forEach(collect)
      return texts
    },
    getAnimationStats: () => ({
      actors: game.scene.getScenes(false).reduce((count, scene) => count + sceneActors(scene).length, 0),
      textures: game.textures.getTextureKeys().filter((key) => key.startsWith("animation:")),
      roofTextures: game.textures.getTextureKeys().filter((key) => key.includes("-organic-v3-roof-")),
      streetSeamTextures: game.textures.getTextureKeys().filter((key) => key.startsWith("krok-street-seam:")),
      modalListeners: EventBus.listenerCount("modal-state"),
      loaderListeners: game.scene.getScenes(false).reduce((count, scene) => count + scene.load.listenerCount(Phaser.Loader.Events.FILE_COMPLETE), 0),
      displayObjects: game.scene.getScenes(false).reduce((count, scene) => count + scene.children.length, 0),
      fps: game.loop.actualFps,
    }),
    // Development-only regression probe: render-only frames must keep walking.
    setPhysicsStepRate: (fps) => {
      if (fps !== 30 && fps !== 60) return
      for (const scene of game.scene.getScenes(true)) scene.physics?.world.setFPS(fps)
    },
    getActors: () => game.scene.getScenes(false).flatMap((scene) => sceneActors(scene).map((actor) => {
      const body = actor.carrier.body as Phaser.Physics.Arcade.Body | null
      const label = actor.carrier.getData("npcLabel") as Phaser.GameObjects.Text | undefined
      const target = actor.carrier.getData("npcTarget") as { x: number; y: number } | undefined
      return {
        key: actor.assetKey, name: actor.carrier.name,
        x: actor.carrier.x, y: actor.carrier.y,
        action: actor.action, facing: actor.facing, frame: String(actor.visual.frame.name), ready: actor.ready,
        texture: actor.visual.texture.key,
        sheetsReady: actor.ready && (!actor.assetKey.startsWith("hero-") || actor.utilityReady && actor.actionsReady && actor.motionReady && (!actor.locomotionAvailable || actor.locomotionReady)),
        gait: actor.gaitSnapshot,
        bodyWidth: body?.width ?? 0, bodyHeight: body?.height ?? 0,
        visualX: actor.visual.x, visualY: actor.visual.y,
        labelX: label?.x, labelY: label?.y, targetX: target?.x, targetY: target?.y,
      }
    })),
    store: gameStore,
    selectCharacter: (id) => gameStore.selectCharacter(id),
    collectClue: (id) => gameStore.collectClue(id),
    answer: (answer) => gameStore.answer(answer),
    beginVillage: () => gameStore.beginVillageChapter(),
    beginChapterThree: () => gameStore.beginChapterThree(),
    setDifficulty: (id) => gameStore.setDifficulty(id),
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
    refillHealingPotions: (now) => gameStore.refillHealingPotions(now),
    acceptKrokErrand: (id) => gameStore.acceptKrokErrand(id),
    completeKrokTarget: (id, target) => gameStore.completeKrokTarget(id, target),
    turnInKrokErrand: (id) => gameStore.turnInKrokErrand(id),
    acceptPrinceQuest: () => gameStore.acceptPrinceQuest(),
    turnInPrinceQuest: () => gameStore.turnInPrinceQuest(),
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
