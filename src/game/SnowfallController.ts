import Phaser from "phaser"

const OUTDOOR_SCENES = new Set([
  "forest-clearing",
  "forest-village",
  "wild-forest",
  "melon-farm",
  "mountain-hollow",
  "bird-pass",
  "snow-valley",
  "snow-city",
  "krok-outskirts",
  "krok-city",
])

interface Snowflake {
  shape: Phaser.GameObjects.Arc
  speed: number
  drift: number
}

export class SnowfallController {
  private readonly flakes: Snowflake[] = []

  static shouldRun(sceneKey: string, chapter: number): boolean {
    return chapter === 3 && OUTDOOR_SCENES.has(sceneKey)
  }

  constructor(private readonly scene: Phaser.Scene) {
    for (let index = 0; index < 68; index += 1) {
      const radius = 1.4 + (index % 5) * 0.55
      const shape = scene.add.circle(
        Phaser.Math.Between(0, 1280),
        Phaser.Math.Between(0, 720),
        radius,
        0xf7fbff,
        0.42 + (index % 4) * 0.12,
      ).setScrollFactor(0).setDepth(8800)
      this.flakes.push({
        shape,
        speed: 28 + (index % 8) * 8,
        drift: 7 + (index % 6) * 3,
      })
    }
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this)
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this)
    for (const { shape } of this.flakes) shape.destroy()
    this.flakes.length = 0
  }

  private update(_time: number, delta: number): void {
    const seconds = Math.min(delta, 50) / 1000
    for (const flake of this.flakes) {
      flake.shape.y += flake.speed * seconds
      flake.shape.x += Math.sin((flake.shape.y + flake.speed) * 0.018) * flake.drift * seconds
      if (flake.shape.y > 728) {
        flake.shape.y = -8
        flake.shape.x = Phaser.Math.Between(0, 1280)
      }
      if (flake.shape.x < -8) flake.shape.x = 1288
      else if (flake.shape.x > 1288) flake.shape.x = -8
    }
  }
}
