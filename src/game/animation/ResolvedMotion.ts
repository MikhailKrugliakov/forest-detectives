export interface MotionPoint { x: number; y: number }

/** Interpolates only between positions already accepted by collision resolution. */
export class ResolvedMotion {
  readonly position: MotionPoint
  private from: MotionPoint
  private to: MotionPoint

  constructor(x: number, y: number) {
    this.position = { x, y }
    this.from = { x, y }
    this.to = { x, y }
  }

  capture(x: number, y: number): void {
    if (Math.hypot(x - this.to.x, y - this.to.y) > 100) {
      this.reset(x, y)
      return
    }
    this.from.x = this.to.x
    this.from.y = this.to.y
    this.to.x = x
    this.to.y = y
  }

  render(x: number, y: number, alpha: number): void {
    // A teleport or a manual correction after the physics step must not smear
    // the sprite through the world. Only interpolate matching physics samples.
    if (Math.hypot(x - this.to.x, y - this.to.y) > 0.01) {
      this.reset(x, y)
      return
    }
    const amount = Math.max(0, Math.min(1, alpha))
    this.position.x = this.from.x + (this.to.x - this.from.x) * amount
    this.position.y = this.from.y + (this.to.y - this.from.y) * amount
  }

  reset(x: number, y: number): void {
    this.from.x = this.to.x = this.position.x = x
    this.from.y = this.to.y = this.position.y = y
  }
}

export interface AnimationPhysicsFrame {
  /** Sum of WORLD_STEP deltas, not the time since the last browser repaint. */
  deltaMs: number
  /** Remaining fixed-step fraction. Never used to extrapolate. */
  alpha: number
  fixed: boolean
}
