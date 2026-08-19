import type { EnemyDefinition, EnemyRank, EnemyType, QuestDefinition, QuestId } from "./types"

export const QUEST_IDS: readonly QuestId[] = ["lost-letters", "robot-parts", "robot-sweep", "beaver-security"]

export const QUESTS: Record<QuestId, QuestDefinition> = {
  "lost-letters": {
    id: "lost-letters",
    npcName: "Белочка-почтальон",
    title: "Потерянная почта",
    description: "Найди в Диком лесу три письма и принеси их Белочке.",
    target: 3,
    icon: "✉️",
    gearReward: 4,
    reward: {
      id: "postal-badge",
      type: "reward",
      name: "Почтовый значок",
      description: "За возвращение всей потерянной почты.",
      icon: "📯",
    },
  },
  "robot-parts": {
    id: "robot-parts",
    npcName: "Бобр-мастер",
    title: "Полезные детали",
    description: "Собери пять деталей, оставшихся после робозверей.",
    target: 5,
    icon: "⚙️",
    gearReward: 4,
    reward: {
      id: "maker-badge",
      type: "reward",
      name: "Значок мастера",
      description: "За помощь деревенской мастерской.",
      icon: "🛠️",
    },
  },
  "robot-sweep": {
    id: "robot-sweep",
    npcName: "Сова-хранительница",
    title: "Лес снова свободен",
    description: "Обезвредь десять робозверей. Возрождённые враги тоже входят в общий счётчик.",
    target: 10,
    icon: "🛡️",
    gearReward: 4,
    reward: {
      id: "guardian-badge",
      type: "reward",
      name: "Значок хранителя",
      description: "За защиту лесной деревни.",
      icon: "🏅",
    },
  },
  "beaver-security": {
    id: "beaver-security",
    npcName: "Бобр-мастер",
    title: "Взбесившаяся защита",
    description: "Пройди комнаты мастерской, перелети пропасть и отключи главный пульт.",
    target: 5,
    icon: "🚨",
    gearReward: 0,
    reward: {
      id: "inventor-badge",
      type: "reward",
      name: "Значок изобретателя",
      description: "За спасение мастерской от её собственной системы защиты.",
      icon: "🎖️",
    },
  },
}

export const ENEMY_RANK_LABELS: Record<EnemyRank, string> = {
  weak: "Слабый",
  normal: "Обычный",
  strong: "Сильный",
  boss: "БОСС",
}

export const ENEMY_RESPAWN_MS: Record<Exclude<EnemyRank, "boss">, number> = {
  weak: 30_000,
  normal: 60_000,
  strong: 90_000,
}

type ForestEnemyType = Extract<EnemyType, "robot-hare" | "robot-wolf" | "robot-boar">

const ENEMY_STATS: Record<ForestEnemyType, Pick<EnemyDefinition, "hp" | "damage" | "speed" | "rank" | "respawnMs">> = {
  "robot-hare": { hp: 2, damage: 10, speed: 150, rank: "weak", respawnMs: ENEMY_RESPAWN_MS.weak },
  "robot-wolf": { hp: 4, damage: 15, speed: 112, rank: "normal", respawnMs: ENEMY_RESPAWN_MS.normal },
  "robot-boar": { hp: 6, damage: 20, speed: 76, rank: "strong", respawnMs: ENEMY_RESPAWN_MS.strong },
}

const enemy = (
  id: string,
  type: ForestEnemyType,
  x: number,
  y: number,
  overrides: Partial<Pick<EnemyDefinition, "hp" | "damage" | "speed" | "rank" | "respawnMs">> = {},
): EnemyDefinition => ({
  id,
  type,
  assetKey: type,
  location: "wild-forest",
  behavior: type === "robot-hare" ? "rush" : type === "robot-boar" ? "dash" : "melee",
  x,
  y,
  ...ENEMY_STATS[type],
  ...overrides,
})

export const ENEMIES: readonly EnemyDefinition[] = [
  enemy("hare-1", "robot-hare", 470, 1220),
  enemy("hare-2", "robot-hare", 775, 985),
  enemy("hare-3", "robot-hare", 1450, 1215),
  enemy("hare-4", "robot-hare", 2050, 1260),
  enemy("wolf-1", "robot-wolf", 510, 540),
  enemy("wolf-2", "robot-wolf", 1190, 650),
  enemy("wolf-3", "robot-wolf", 1880, 750),
  enemy("boar-1", "robot-boar", 850, 330),
  enemy("boar-2", "robot-boar", 1540, 350),
  enemy("boar-3", "robot-boar", 2140, 440, {
    hp: 12,
    damage: 28,
    speed: 70,
    rank: "boss",
    respawnMs: null,
  }),
] as const

export function questProgress(id: QuestId, state: {
  foundLetters: readonly string[]
  collectedParts: readonly string[]
  defeatedEnemies: readonly string[]
  wildForestEnemyDefeats: number
  beaverHouse?: { completedRooms: readonly string[] }
}): number {
  if (id === "lost-letters") return state.foundLetters.length
  if (id === "robot-parts") return state.collectedParts.length
  if (id === "robot-sweep") return state.wildForestEnemyDefeats
  return state.beaverHouse?.completedRooms.length ?? 0
}
