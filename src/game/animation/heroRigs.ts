import layouts from "./heroRigLayout.json" with { type: "json" }
import type { FacingDirection } from "./catalog"

/** Add an entry only once its transparent, separately drawn parts are shipped. */
export const HERO_RIGS: ReadonlySet<string> = new Set(["hero-wolf", "hero-fox", "hero-rabbit", "hero-watermelon", "hero-sheepwolf"])

export function heroRigLayout(key: string, facing: FacingDirection) {
  const config = layouts[key as keyof typeof layouts] ?? layouts["hero-wolf"]
  const row = ["down", "up", "left", "right"].indexOf(facing)
  const height = config.heights[row]!
  const legLength = height * config.legRatio
  const spread = facing === "down" || facing === "up" ? config.hipSpread : 3
  return { row, height, legLength, hips: [{ x: 64 - spread, y: 118 - legLength }, { x: 64 + spread, y: 118 - legLength }] as const }
}
