import { ENEMY_RESPAWN_MS } from "./quests"
import type { EnemyDefinition, EnemyType } from "./types"

export const MOUNTAIN_WIDTH = 4800
export const MOUNTAIN_HEIGHT = 1600
export const MOUNTAIN_ENTRY = { x: 180, y: 800 } as const
export const WILD_MOUNTAIN_PORTAL = { x: 2240, y: 850 } as const
export const MOUNTAIN_GUARDIAN_IDS = ["guardian-axe", "guardian-flamethrower"] as const

const insect = (
  id: string,
  type: Extract<EnemyType, "robot-beetle" | "robot-wasp" | "robot-mantis">,
  x: number,
  y: number,
): EnemyDefinition => {
  if (type === "robot-beetle") {
    return { id, type, assetKey: type, location: "mountain-hollow", behavior: "rush", x, y, hp: 4, damage: 15, speed: 105, rank: "normal", respawnMs: ENEMY_RESPAWN_MS.normal }
  }
  if (type === "robot-wasp") {
    return { id, type, assetKey: type, location: "mountain-hollow", behavior: "ranged", x, y, hp: 4, damage: 12, speed: 130, rank: "normal", respawnMs: ENEMY_RESPAWN_MS.normal }
  }
  return { id, type, assetKey: type, location: "mountain-hollow", behavior: "dash", x, y, hp: 7, damage: 22, speed: 90, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong }
}

export const MOUNTAIN_ENEMIES: readonly EnemyDefinition[] = [
  insect("beetle-1", "robot-beetle", 620, 760),
  insect("beetle-2", "robot-beetle", 820, 1120),
  insect("beetle-3", "robot-beetle", 1080, 690),
  insect("beetle-4", "robot-beetle", 1320, 1270),
  insect("beetle-5", "robot-beetle", 1580, 760),
  insect("beetle-6", "robot-beetle", 1780, 1110),
  insect("wasp-1", "robot-wasp", 1880, 470),
  insect("wasp-2", "robot-wasp", 2140, 760),
  insect("wasp-3", "robot-wasp", 2320, 1230),
  insect("wasp-4", "robot-wasp", 2550, 650),
  insect("wasp-5", "robot-wasp", 2760, 1120),
  insect("wasp-6", "robot-wasp", 3020, 720),
  insect("mantis-1", "robot-mantis", 3020, 1270),
  insect("mantis-2", "robot-mantis", 3250, 670),
  insect("mantis-3", "robot-mantis", 3440, 1130),
  insect("mantis-4", "robot-mantis", 3640, 570),
  insect("mantis-5", "robot-mantis", 3770, 980),
  insect("mantis-6", "robot-mantis", 3910, 1320),
  {
    id: "guardian-axe",
    type: "guardian-axe",
    assetKey: "guardian-axe",
    location: "mountain-hollow",
    behavior: "axe",
    x: 4300,
    y: 720,
    hp: 24,
    damage: 30,
    speed: 82,
    rank: "boss",
    respawnMs: null,
  },
  {
    id: "guardian-flamethrower",
    type: "guardian-flamethrower",
    assetKey: "guardian-flamethrower",
    location: "mountain-hollow",
    behavior: "flamethrower",
    x: 4490,
    y: 930,
    hp: 22,
    damage: 8,
    speed: 65,
    rank: "boss",
    respawnMs: null,
  },
] as const

export function guardiansDefeated(defeated: readonly string[]): boolean {
  return MOUNTAIN_GUARDIAN_IDS.every((id) => defeated.includes(id))
}

export const MOUNTAIN_REWARD = {
  iron: 4,
  diamond: 2,
  item: {
    id: "mountain-hollow-badge",
    type: "reward" as const,
    name: "Знак Горной Лощины",
    description: "За победу над двумя медведями-стражниками.",
    icon: "⛰️",
  },
} as const
