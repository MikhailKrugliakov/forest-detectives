import { HERO_RIGS } from "./heroRigs"

export const FACINGS = ["down", "up", "left", "right"] as const
export type FacingDirection = typeof FACINGS[number]
export const ACTOR_ACTIONS = [
  "idle", "walk", "run", "attack", "throw", "gadget", "heal", "interact", "mine",
  "hurt", "defeat", "talk", "work", "windup", "shoot", "charge", "roll", "stunned",
  "core-open", "tail", "tusks", "cast", "channel",
] as const
export type ActorAction = typeof ACTOR_ACTIONS[number]
export type ActorFamily = "hero" | "resident" | "walker" | "flyer" | "roller" | "siege" | "boss"

export interface ActorDefinition {
  key: string
  family: ActorFamily
  source: string
  sheet: string
  utilitySheet?: string
  actionsSheet?: string
  specialSheet?: string
  motionSheet?: string
  rigSheet?: string
  columns: number
  rows: number
}

const definitions: readonly [string, ActorFamily, string][] = [
  ["hero-wolf", "hero", "characters/wolf.png"],
  ["hero-fox", "hero", "characters/fox.png"],
  ["hero-rabbit", "hero", "characters/rabbit.png"],
  ["hero-watermelon", "hero", "characters/watermelon.png"],
  ["hero-sheepwolf", "hero", "characters/sheepwolf.png"],
  ["robot-hare", "walker", "enemies/robot-hare-runtime.png"],
  ["robot-wolf", "walker", "enemies/robot-wolf-runtime.png"],
  ["robot-boar", "walker", "enemies/robot-boar-runtime.png"],
  ["robot-beetle", "walker", "enemies/robot-beetle.png"],
  ["robot-wasp", "flyer", "enemies/robot-wasp.png"],
  ["robot-mantis", "walker", "enemies/robot-mantis.png"],
  ["guardian-axe", "boss", "enemies/guardian-axe.png"],
  ["guardian-flamethrower", "boss", "enemies/guardian-flamethrower.png"],
  ["robot-sparrow", "flyer", "enemies/robot-sparrow.png"],
  ["robot-owl", "flyer", "enemies/robot-owl.png"],
  ["robot-hawk", "flyer", "enemies/robot-hawk.png"],
  ["turtle-guardian", "boss", "enemies/turtle-guardian.png"],
  ["snowball", "roller", "enemies/snowball.png"],
  ["snowman", "walker", "enemies/snowman.png"],
  ["robot-albatross", "flyer", "enemies/robot-albatross.png"],
  ["snow-golem", "walker", "enemies/snow-golem.png"],
  ["ice-golem", "walker", "enemies/ice-golem.png"],
  ["ice-catapult", "siege", "enemies/ice-catapult.png"],
  ["walrus", "boss", "enemies/walrus.png"],
  ["npc-squirrel", "resident", "npcs/squirrel-postie.png"],
  ["npc-beaver", "resident", "npcs/beaver-maker.png"],
  ["npc-owl", "resident", "npcs/owl-guardian.png"],
  ["npc-mole", "resident", "npcs/uncle-mole.png"],
  ["npc-tim", "resident", "npcs/tim-hedgehog.png"],
  ["npc-marta", "resident", "npcs/marta-badger.png"],
  ["npc-filya", "resident", "npcs/filya-raccoon.png"],
  ["npc-aunt-melon", "resident", "npcs/aunt-melon-runtime.png"],
  ["npc-melon-resident", "resident", "npcs/melon-resident-runtime.png"],
  ["npc-watermelon-resident", "resident", "npcs/watermelon-resident-runtime.png"],
  ["npc-zlata", "resident", "npcs/zlata-bear.png"],
  ["npc-luchik", "resident", "npcs/luchik-goat.png"],
  ["npc-kvak", "resident", "npcs/kvak-frog.png"],
  ["krok-resident", "resident", "npc/krok-resident.png"],
  ["krok-merchant", "resident", "npc/krok-merchant.png"],
  ["krok-guard", "resident", "npc/krok-guard.png"],
  ["krok-prince", "resident", "npc/krok-prince.png"],
]

export const ACTOR_CATALOG: readonly ActorDefinition[] = definitions.map(([key, family, source]) => ({
  key, family, source: `assets/${source}`, sheet: `assets/animations/${key}.png`,
  utilitySheet: family === "hero" ? `assets/animations/${key}-utility.png` : undefined,
  actionsSheet: family === "hero" ? `assets/animations/${key}-actions.png` : undefined,
  motionSheet: family === "hero" ? `assets/animations/${key}-motion.png` : undefined,
  rigSheet: HERO_RIGS.has(key) ? `assets/animations/${key}-rig.png` : undefined,
  specialSheet: key === "turtle-guardian" || key === "walrus" ? `assets/animations/${key}-special.png` : undefined,
  columns: 8, rows: 12,
}))
export const ACTORS = new Map(ACTOR_CATALOG.map((definition) => [definition.key, definition]))

export function facingFromMovement(x: number, y: number, previous: FacingDirection = "down"): FacingDirection {
  if (Math.hypot(x, y) < 0.01) return previous
  // A diagonal keeps its current axis until the other one clearly dominates.
  // Tiny collision/floating-point differences must not flicker between rows.
  const horizontal = Math.abs(x)
  const vertical = Math.abs(y)
  if (horizontal > vertical * 1.15 || horizontal >= vertical / 1.15 && (previous === "left" || previous === "right")) return x < 0 ? "left" : "right"
  return y < 0 ? "up" : "down"
}

export interface ActorClip {
  frames: readonly number[]
  duration: number
  loop: boolean
  sheet?: "utility" | "actions" | "special" | "motion"
}

/** Contact pose starts at the gameplay marker, independent of warning length. */
export function clipFrameIndex(length: number, elapsed: number, duration: number, loop: boolean, impactAt?: number): number {
  if (length <= 1) return 0
  if (impactAt != null && impactAt >= 0 && impactAt < duration && length >= 6) {
    const contact = 3
    return elapsed < impactAt
      ? Math.min(contact - 1, Math.floor(elapsed / impactAt * contact))
      : Math.min(length - 1, contact + Math.floor((elapsed - impactAt) / (duration - impactAt) * (length - contact)))
  }
  const progress = loop ? elapsed % duration / duration : Math.min(0.9999, elapsed / duration)
  return Math.min(length - 1, Math.floor(progress * length))
}

/** Atlas contract: four walking rows, four action rows, four expression rows. */
export function actorClip(action: ActorAction, facing: FacingDirection, utilitySheet = false,
  extras: { actions?: boolean; motion?: boolean; moving?: boolean; special?: "turtle-guardian" | "walrus"; family?: ActorFamily } = {}): ActorClip {
  const direction = FACINGS.indexOf(facing)
  const walk = direction * 8
  const attack = (direction + 4) * 8
  const utility = (direction + 8) * 8
  const sequence = (start: number, count: number) => Array.from({ length: count }, (_, index) => start + index)
  if (extras.motion && (action === "run" || extras.moving && (action === "attack" || action === "throw"))) {
    const block = action === "run" ? 0 : action === "attack" ? 4 : 8
    return { frames: sequence((block + direction) * 8, 8), duration: 450, loop: action === "run", sheet: "motion" }
  }
  if (extras.actions && ["throw", "gadget", "mine"].includes(action)) {
    const block = action === "throw" ? 0 : action === "gadget" ? 4 : 8
    return { frames: sequence((block + direction) * 8, 8), duration: action === "mine" ? 600 : 450, loop: false, sheet: "actions" }
  }
  if (extras.special === "walrus" && ["tail", "tusks", "cast"].includes(action)) {
    const block = action === "tail" ? 0 : action === "tusks" ? 4 : 8
    return { frames: sequence((block + direction) * 8, 8), duration: 800, loop: false, sheet: "special" }
  }
  if (extras.special === "turtle-guardian") {
    if (action === "roll") return { frames: sequence(walk, 8), duration: 400, loop: true, sheet: "special" }
    // Only the open middle poses loop: a vulnerable core must never look shut.
    if (action === "core-open") return { frames: sequence(attack + 2, 4), duration: 1000, loop: true, sheet: "special" }
    if (action === "stunned") return { frames: sequence(utility, 4), duration: 800, loop: true, sheet: "special" }
    if (action === "defeat") return { frames: sequence(utility + 4, 4), duration: 550, loop: false, sheet: "special" }
  }
  if (extras.family === "resident" && action === "talk") {
    return { frames: sequence(attack, 6), duration: 1200, loop: true }
  }
  if (utilitySheet) {
    const frame = direction * 8
    const expression = (direction + 4) * 8
    const ending = (direction + 8) * 8
    switch (action) {
      case "idle": return { frames: sequence(frame, 4), duration: 1600, loop: true, sheet: "utility" }
      case "heal": return { frames: sequence(frame + 4, 4), duration: 600, loop: false, sheet: "utility" }
      case "talk": return { frames: sequence(expression, 6), duration: 1200, loop: true, sheet: "utility" }
      case "hurt": return { frames: [expression + 6, expression + 7, expression], duration: 210, loop: false, sheet: "utility" }
      case "defeat": return { frames: sequence(ending, 6), duration: 550, loop: false, sheet: "utility" }
      case "interact": case "gadget": return { frames: [ending + 6, ending + 7, ending + 6], duration: 450, loop: false, sheet: "utility" }
    }
  }
  switch (action) {
    case "idle": return { frames: sequence(utility, 4), duration: 1600, loop: true }
    case "walk": return { frames: sequence(walk, 8), duration: 720, loop: true }
    case "run": return { frames: sequence(walk, 8), duration: 450, loop: true }
    case "talk": return { frames: [utility + 4, utility + 5, utility + 4, utility + 1, utility + 5, utility], duration: 1200, loop: true }
    case "hurt": return { frames: [utility + 6, utility + 6, utility], duration: 210, loop: false }
    case "defeat": return { frames: [utility + 6, utility + 7], duration: 550, loop: false }
    case "stunned": return { frames: [utility + 6, utility + 1, utility + 6, utility], duration: 800, loop: true }
    case "windup": return { frames: [attack, attack + 1, attack + 2], duration: 600, loop: false }
    case "core-open": return { frames: [attack + 6, attack + 7], duration: 600, loop: true }
    case "charge": case "roll": return { frames: sequence(walk, 8), duration: 350, loop: true }
    case "heal": case "interact": case "gadget": return { frames: [utility + 4, utility + 5, utility + 4, utility], duration: 600, loop: false }
    case "work": return { frames: sequence(attack, 8), duration: 1800, loop: true }
    default: return { frames: sequence(attack, 8), duration: 450, loop: false }
  }
}
