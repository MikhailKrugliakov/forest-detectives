import type { FacingDirection } from "./catalog"

export interface GaitLeg {
  angle: number
  lift: number
  shiftY: number
  footX: number
  footY: number
}

/** Full two-foot cycle, evaluated continuously, not by blending bitmap poses. */
export function gaitLeg(phase: number, leg: 0 | 1, facing: FacingDirection, length: number, running: boolean, amount = 1): GaitLeg {
  const turn = ((phase + leg * 0.5) % 1 + 1) % 1
  const forward = Math.cos(turn * Math.PI * 2) * length * (running ? 0.57 : 0.42) * amount
  // The first half is planted; only the returning foot lifts off the floor.
  const lift = turn > 0.5 ? Math.sin((turn - 0.5) * Math.PI * 2) * length * (running ? 0.21 : 0.13) * amount : 0
  if (facing === "left" || facing === "right") {
    const footX = forward * (facing === "right" ? 1 : -1)
    const angle = -Math.asin(footX / length)
    return { angle, lift, shiftY: 0, footX, footY: Math.cos(angle) * length - lift }
  }
  const shiftY = forward * (facing === "down" ? 0.3 : -0.3)
  return { angle: 0, lift, shiftY, footX: 0, footY: length + shiftY - lift }
}

export class HeroGait {
  phase = 0
  amount = 0
  advance(distance: number, delta: number, moving: boolean, running: boolean, scale = 1, paused = false): void {
    if (paused) return
    if (distance >= 100) { this.reset(); return }
    if (moving) this.phase = (this.phase + Math.max(0, distance) / ((running ? 104 : 78) * scale)) % 1
    const target = moving ? 1 : 0
    this.amount += (target - this.amount) * (1 - Math.exp(-Math.max(0, delta) / 55))
    if (Math.abs(this.amount - target) < 0.001) this.amount = target
  }
  reset(): void { this.phase = 0; this.amount = 0 }
}
