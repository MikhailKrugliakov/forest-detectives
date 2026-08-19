import Phaser from "phaser"
import { COLORS, FONT } from "../ui"

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot")
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.ink)
    this.add
      .text(640, 330, "Тайна лесной посылки", {
        fontFamily: FONT,
        fontSize: "48px",
        fontStyle: "bold",
        color: "#fff4cf",
      })
      .setOrigin(0.5)
    this.add
      .text(640, 395, "Готовим опушку…", {
        fontFamily: FONT,
        fontSize: "24px",
        color: "#d8edc6",
      })
      .setOrigin(0.5)

    this.time.delayedCall(80, () => this.scene.start("preload"))
  }
}
