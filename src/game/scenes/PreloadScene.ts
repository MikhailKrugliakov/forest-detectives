import Phaser from "phaser"
import { gameStore } from "../../domain/GameStore"
import type { CharacterId } from "../../domain/types"
import { COLORS, FONT } from "../ui"

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("preload")
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.ink)
    const track = this.add.rectangle(640, 390, 460, 22, 0x0d2924, 1)
    track.setStrokeStyle(2, COLORS.cream, 0.7)
    const bar = this.add.rectangle(414, 390, 0, 14, COLORS.yellow, 1).setOrigin(0, 0.5)
    const label = this.add
      .text(640, 335, "Собираем улики…", {
        fontFamily: FONT,
        fontSize: "30px",
        fontStyle: "bold",
        color: "#fff4cf",
      })
      .setOrigin(0.5)

    this.load.on("progress", (value: number) => {
      bar.width = 452 * value
    })
    this.load.on("complete", () => label.setText("Всё готово!"))

    this.load.image("forest-clearing", "assets/world/forest-clearing.png")
    this.load.image("hero-wolf", "assets/characters/wolf.png")
    this.load.image("hero-fox", "assets/characters/fox.png")
    this.load.image("hero-rabbit", "assets/characters/rabbit.png")
    this.load.image("hero-watermelon", "assets/characters/watermelon.png")
    this.load.image("hero-sheepwolf", "assets/characters/sheepwolf.png")
    this.load.image("npc-squirrel", "assets/npcs/squirrel-postie.png")
    this.load.image("npc-beaver", "assets/npcs/beaver-maker.png")
    this.load.image("npc-owl", "assets/npcs/owl-guardian.png")
    this.load.image("npc-mole", "assets/npcs/uncle-mole.png")
    this.load.image("npc-tim", "assets/npcs/tim-hedgehog.png")
    this.load.image("npc-marta", "assets/npcs/marta-badger.png")
    this.load.image("npc-filya", "assets/npcs/filya-raccoon.png")
    this.load.image("npc-aunt-melon", "assets/npcs/aunt-melon-runtime.png")
    this.load.image("npc-melon-resident", "assets/npcs/melon-resident-runtime.png")
    this.load.image("npc-watermelon-resident", "assets/npcs/watermelon-resident-runtime.png")
    this.load.image("npc-zlata", "assets/npcs/zlata-bear.png")
    this.load.image("npc-luchik", "assets/npcs/luchik-goat.png")
    this.load.image("npc-kvak", "assets/npcs/kvak-frog.png")
    this.load.image("robot-hare", "assets/enemies/robot-hare-runtime.png")
    this.load.image("robot-wolf", "assets/enemies/robot-wolf-runtime.png")
    this.load.image("robot-boar", "assets/enemies/robot-boar-runtime.png")
    this.load.image("robot-beetle", "assets/enemies/robot-beetle.png")
    this.load.image("robot-wasp", "assets/enemies/robot-wasp.png")
    this.load.image("robot-mantis", "assets/enemies/robot-mantis.png")
    this.load.image("guardian-axe", "assets/enemies/guardian-axe.png")
    this.load.image("guardian-flamethrower", "assets/enemies/guardian-flamethrower.png")
    this.load.image("robot-sparrow", "assets/enemies/robot-sparrow.png")
    this.load.image("robot-owl", "assets/enemies/robot-owl.png")
    this.load.image("robot-hawk", "assets/enemies/robot-hawk.png")
    this.load.image("turtle-guardian", "assets/enemies/turtle-guardian.png")
    this.load.image("forest-village-bg", "assets/world/forest-village-expanded.png")
    this.load.image("forest-village-west-bg", "assets/world/forest-village-west.png")
    this.load.image("wild-forest-bg", "assets/world/wild-forest.png")
    this.load.image("mountain-hollow-west-bg", "assets/world/mountain-hollow-west.png")
    this.load.image("mountain-hollow-east-bg", "assets/world/mountain-hollow-east.png")
    this.load.image("bird-pass-west-bg", "assets/world/bird-pass-west.png")
    this.load.image("bird-pass-east-bg", "assets/world/bird-pass-east.png")
    this.load.image("forest-mine-bg", "assets/world/forest-mine.png")
    this.load.image("melon-farm-bg", "assets/world/melon-farm.png")
    this.load.image("mole-shop-bg", "assets/interiors/mole-shop.png")
    this.load.image("beaver-house-bg", "assets/interiors/beaver-house.png")
    this.load.image("wolf-home-bg", "assets/interiors/wolf-home.png")
    this.load.image("fox-home-bg", "assets/interiors/fox-home.png")
    this.load.image("rabbit-home-bg", "assets/interiors/rabbit-home.png")
    this.load.image("watermelon-home-bg", "assets/interiors/watermelon-home.png")
    this.load.image("sheepwolf-home-bg", "assets/interiors/sheepwolf-home.png")
    this.load.image("gadget-jetpack", "assets/gadgets/jetpack.png")
    this.load.image("gadget-magnetic-glove", "assets/gadgets/magnetic-glove.png")
    this.load.image("gadget-gas-mask", "assets/gadgets/gas-mask.png")
    this.load.image("gadget-pulse-shield", "assets/gadgets/pulse-shield.png")
    this.load.tilemapTiledJSON("forest-map", "assets/maps/forest-clearing.tmj")
    this.load.tilemapTiledJSON("forest-village-map", "assets/maps/forest-village.tmj")
    this.load.tilemapTiledJSON("wild-forest-map", "assets/maps/wild-forest.tmj")
    this.load.tilemapTiledJSON("mountain-hollow-map", "assets/maps/mountain-hollow.tmj")
    this.load.tilemapTiledJSON("bird-pass-map", "assets/maps/bird-pass.tmj")
    this.load.tilemapTiledJSON("forest-mine-map", "assets/maps/forest-mine.tmj")
    this.load.tilemapTiledJSON("melon-farm-map", "assets/maps/melon-farm.tmj")
    this.load.tilemapTiledJSON("beaver-house-map", "assets/maps/beaver-house.tmj")
  }

  create(): void {
    const debugScene = import.meta.env.DEV
      ? new URLSearchParams(window.location.search).get("scene")
      : null
    if (["forest-village", "wild-forest", "mountain-hollow", "bird-pass", "forest-mine", "melon-farm", "mole-shop", "beaver-house", "hero-home"].includes(debugScene ?? "")) {
      const debugHero = new URLSearchParams(window.location.search).get("hero")
      const hero: CharacterId = ["wolf", "fox", "rabbit", "watermelon", "sheepwolf"].includes(debugHero ?? "")
        ? debugHero as CharacterId
        : "sheepwolf"
      gameStore.selectCharacter(hero)
      gameStore.beginVillageChapter()
      if (debugScene === "wild-forest") {
        gameStore.acceptQuest("robot-sweep")
        gameStore.setLocation("wild-forest")
      }
      if (debugScene === "forest-mine") gameStore.setLocation("forest-mine")
      if (debugScene === "mountain-hollow") {
        gameStore.defeatEnemy("boar-3")
        gameStore.setLocation("mountain-hollow")
      }
      if (debugScene === "bird-pass") {
        gameStore.defeatEnemy("guardian-axe")
        gameStore.defeatEnemy("guardian-flamethrower")
        gameStore.setLocation("bird-pass")
      }
      if (debugScene === "beaver-house") {
        gameStore.acceptQuest("beaver-security")
        gameStore.awardGears("debug", 12)
        gameStore.purchaseGadget("jetpack")
        gameStore.setLocation("beaver-house")
      }
      if (debugScene === "mole-shop") gameStore.setLocation("mole-shop")
      if (debugScene === "melon-farm") gameStore.setLocation("melon-farm", null)
      if (debugScene === "hero-home") gameStore.setLocation("sheepwolf-home")
      this.scene.start(debugScene!)
      return
    }
    this.scene.start("main-menu")
  }
}
