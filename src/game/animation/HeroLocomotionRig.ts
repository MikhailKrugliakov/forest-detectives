import type Phaser from "phaser"
import type { ActorAction, FacingDirection } from "./catalog"
import { HeroGait, gaitLeg } from "./HeroGait"
import { heroRigLayout } from "./heroRigs"

export class HeroLocomotionRig {
  readonly body: Phaser.GameObjects.Sprite
  readonly legs: readonly [Phaser.GameObjects.Sprite, Phaser.GameObjects.Sprite]
  readonly gait = new HeroGait()
  active = false
  private previous: { x: number; y: number } | null = null
  private feet: { x: number; y: number }[] = []
  constructor(scene: Phaser.Scene, private readonly assetKey: string, private readonly texture: string) {
    this.body = scene.add.sprite(0, 0, texture, "0").setVisible(false)
    this.legs = [scene.add.sprite(0, 0, texture, "1").setVisible(false), scene.add.sprite(0, 0, texture, "2").setVisible(false)]
  }
  get snapshot() { return { active: this.active, phase: this.gait.phase, amount: this.gait.amount, feet: this.feet.map((foot) => ({ ...foot })) } }
  hide(): void { this.active = false; this.body.setVisible(false); for (const leg of this.legs) leg.setVisible(false) }
  update(carrier: Phaser.GameObjects.Image, x: number, y: number, footY: number, displayHeight: number, delta: number,
    facing: FacingDirection, action: ActorAction, moving: boolean, reset: boolean): boolean {
    const preview = carrier.name === "gallery" && (action === "walk" || action === "run")
    const scale = displayHeight / 128
    const running = action === "run"
    const distance = preview ? delta * (running ? 240 : 150) / 1000 : this.previous ? Math.hypot(x - this.previous.x, y - this.previous.y) : 0
    this.previous = { x, y }
    if (reset) this.gait.reset()
    else this.gait.advance(distance, delta, moving || preview, running, scale)
    this.active = action === "idle" || action === "walk" || action === "run"
    if (!this.active) { this.hide(); return false }
    const layout = heroRigLayout(this.assetKey, facing)
    this.body.setTexture(this.texture, String(layout.row * 3)).setDisplaySize(displayHeight, displayHeight)
      .setOrigin(0.5, 118 / 128).setPosition(x, footY).setDepth(carrier.depth).setVisible(true).setAlpha(carrier.alpha)
      .setTint(carrier.tintTopLeft, carrier.tintTopRight, carrier.tintBottomLeft, carrier.tintBottomRight)
    this.feet = []
    for (const [index, leg] of this.legs.entries()) {
      const hip = layout.hips[index]!
      const pose = gaitLeg(this.gait.phase, index as 0 | 1, facing, layout.legLength, running, this.gait.amount)
      const hipX = x + (hip.x - 64) * scale, hipY = footY + (hip.y - 118) * scale
      const near = facing === "left" ? index === 0 : index === 1
      leg.setTexture(this.texture, String(layout.row * 3 + index + 1)).setDisplaySize(displayHeight, displayHeight)
        .setOrigin(hip.x / 128, hip.y / 128).setPosition(hipX, hipY + (pose.shiftY - pose.lift) * scale)
        .setRotation(pose.angle).setDepth(carrier.depth - (near ? 0.01 : 0.02)).setVisible(true).setAlpha(carrier.alpha)
        .setTint(carrier.tintTopLeft, carrier.tintTopRight, carrier.tintBottomLeft, carrier.tintBottomRight)
      this.feet.push({ x: hipX + pose.footX * scale, y: hipY + pose.footY * scale })
    }
    return true
  }
  dispose(): void { this.body.destroy(); for (const leg of this.legs) leg.destroy() }
}
