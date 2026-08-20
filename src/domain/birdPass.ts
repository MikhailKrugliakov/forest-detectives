import { ENEMY_RESPAWN_MS } from "./quests"
import type { EnemyDefinition, EnemyType, InventoryItem } from "./types"

export const BIRD_PASS_WIDTH = 4800
export const BIRD_PASS_HEIGHT = 1600
export const BIRD_PASS_ENTRY = { x: 180, y: 800 } as const
export const BIRD_PASS_TURTLE_ID = "turtle-guardian" as const
export const BIRD_PASS_ENEMY_IDS = {
  sparrows: ["sparrow-1", "sparrow-2", "sparrow-3", "sparrow-4", "sparrow-5", "sparrow-6"],
  owls: ["owl-1", "owl-2", "owl-3", "owl-4", "owl-5", "owl-6"],
  hawks: ["hawk-1", "hawk-2", "hawk-3", "hawk-4", "hawk-5", "hawk-6"],
} as const

const bird = (
  id: string,
  type: Extract<EnemyType, "robot-sparrow" | "robot-owl" | "robot-hawk">,
  x: number,
  y: number,
): EnemyDefinition => {
  if (type === "robot-sparrow") {
    return { id, type, assetKey: type, location: "bird-pass", behavior: "feather-single", x, y, hp: 5, damage: 14, speed: 125, rank: "normal", respawnMs: ENEMY_RESPAWN_MS.normal }
  }
  if (type === "robot-owl") {
    return { id, type, assetKey: type, location: "bird-pass", behavior: "feather-fan", x, y, hp: 7, damage: 18, speed: 90, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong }
  }
  return { id, type, assetKey: type, location: "bird-pass", behavior: "feather-dive", x, y, hp: 9, damage: 22, speed: 135, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong }
}

export const BIRD_PASS_ENEMIES: readonly EnemyDefinition[] = [
  bird("sparrow-1", "robot-sparrow", 560, 650),
  bird("sparrow-2", "robot-sparrow", 780, 980),
  bird("sparrow-3", "robot-sparrow", 1040, 630),
  bird("sparrow-4", "robot-sparrow", 1260, 1090),
  bird("sparrow-5", "robot-sparrow", 1490, 710),
  bird("sparrow-6", "robot-sparrow", 1710, 1040),
  bird("owl-1", "robot-owl", 1880, 520),
  bird("owl-2", "robot-owl", 2090, 920),
  bird("owl-3", "robot-owl", 2320, 1210),
  bird("owl-4", "robot-owl", 2550, 650),
  bird("owl-5", "robot-owl", 2760, 1050),
  bird("owl-6", "robot-owl", 2980, 720),
  bird("hawk-1", "robot-hawk", 3170, 1190),
  bird("hawk-2", "robot-hawk", 3380, 620),
  bird("hawk-3", "robot-hawk", 3570, 1060),
  bird("hawk-4", "robot-hawk", 3740, 550),
  bird("hawk-5", "robot-hawk", 3910, 920),
  bird("hawk-6", "robot-hawk", 4070, 1250),
  {
    id: BIRD_PASS_TURTLE_ID,
    type: "turtle-guardian",
    assetKey: "turtle-guardian",
    location: "bird-pass",
    behavior: "turtle",
    x: 4490,
    y: 800,
    hp: 45,
    damage: 24,
    speed: 62,
    rank: "boss",
    respawnMs: null,
  },
] as const

export type TurtlePhase = 1 | 2 | 3 | "defeated"

export function turtlePhase(health: number, maxHealth: number): TurtlePhase {
  if (health <= 0) return "defeated"
  const ratio = maxHealth <= 0 ? 0 : health / maxHealth
  if (ratio > 2 / 3) return 1
  if (ratio > 1 / 3) return 2
  return 3
}

export const BIRD_PASS_REWARD: {
  gears: number
  item: InventoryItem
} = {
  gears: 8,
  item: {
    id: "bird-pass-badge",
    type: "reward",
    name: "Знак Птичьего перевала",
    description: "За победу над робочерепахой Бронепанцирем.",
    icon: "🪶",
  },
}
