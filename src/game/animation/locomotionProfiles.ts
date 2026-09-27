import type { FacingDirection } from "./catalog"

type DirectionScales = Readonly<Record<FacingDirection, number>>

// Each coefficient is median walking height / median running height across
// eight existing atlas frames (alpha > 100). It stays constant for the entire
// direction: limb movement must never trigger per-frame resizing. The artwork
// is unchanged; independently packed sheets now share the same body scale.
const HERO_RUN_SCALES: Readonly<Record<string, DirectionScales>> = {
  "hero-wolf": { down: 109 / 91.5, up: 105 / 83, left: 104 / 83, right: 103 / 85 },
  "hero-fox": { down: 108.5 / 107.5, up: 103 / 99, left: 103 / 102, right: 108 / 101 },
  "hero-rabbit": { down: 99 / 110, up: 96 / 107.5, left: 88 / 105.5, right: 86 / 106.5 },
  "hero-watermelon": { down: 83 / 112, up: 81.5 / 109.5, left: 82 / 107, right: 82 / 108 },
  "hero-sheepwolf": { down: 110.5 / 98, up: 112.5 / 95.5, left: 105 / 91.5, right: 108 / 91.5 },
}

const DEFAULT_IDLE_OFFSETS = [0, 1, 2, 3] as const
const HERO_IDLE_OFFSETS: Readonly<Record<string, Partial<Readonly<Record<FacingDirection, readonly number[]>>>>> = {
  // These omitted poses turn front-on despite belonging to a side-facing row.
  "hero-rabbit": { left: [0, 1, 2, 1], right: [0, 1, 2, 1] },
  "hero-watermelon": { left: [0, 1, 2, 1] },
  "hero-sheepwolf": { left: [0, 1, 3, 1] },
}

/** Run-row visual correction only; never apply to physics or other actions. */
export function heroRunScale(key: string, facing: FacingDirection): number {
  return HERO_RUN_SCALES[key]?.[facing] ?? 1
}

/** Offsets within the four idle frames on the hero's original base sheet. */
export function heroIdleOffsets(key: string, facing: FacingDirection): readonly number[] {
  return HERO_IDLE_OFFSETS[key]?.[facing] ?? DEFAULT_IDLE_OFFSETS
}
