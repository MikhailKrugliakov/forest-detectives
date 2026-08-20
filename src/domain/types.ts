export interface Stats {
  strength: number
  agility: number
  endurance: number
  intelligence: number
}

export interface Equipment {
  id: string
  name: string
  description: string
  icon: string
}

export interface CharacterDefinition {
  id: CharacterId
  name: string
  subtitle: string
  description: string
  stats: Stats
  equipment: Equipment
  ability: string
  assetKey: string
  accent: number
}

export type CharacterId = "wolf" | "fox" | "rabbit" | "watermelon" | "sheepwolf"
export type ClueId = "parcel-print" | "ribbon" | "cardboard"
export type ItemType = "equipment" | "clue" | "reward" | "gadget" | "building-material" | "tool"
export type PuzzleAnswer = "stream" | "tree" | "burrow"
export type ChapterId = 1 | 2 | 3
export type DifficultyId = "walk" | "story" | "hard" | "impossible"
export type LocationId =
  | "forest-clearing"
  | "forest-village"
  | "wild-forest"
  | "mountain-hollow"
  | "bird-pass"
  | "forest-mine"
  | "melon-farm"
  | "mole-shop"
  | "beaver-house"
  | "wolf-home"
  | "fox-home"
  | "rabbit-home"
  | "watermelon-home"
  | "sheepwolf-home"
export type QuestId = "lost-letters" | "robot-parts" | "robot-sweep" | "beaver-security"
export type QuestStatus = "available" | "active" | "ready" | "completed"
export type EnemyType =
  | "robot-hare"
  | "robot-wolf"
  | "robot-boar"
  | "robot-beetle"
  | "robot-wasp"
  | "robot-mantis"
  | "guardian-axe"
  | "guardian-flamethrower"
  | "robot-sparrow"
  | "robot-owl"
  | "robot-hawk"
  | "turtle-guardian"
export type EnemyRank = "weak" | "normal" | "strong" | "boss"
export type EnemyBehavior =
  | "melee"
  | "rush"
  | "ranged"
  | "dash"
  | "axe"
  | "flamethrower"
  | "feather-single"
  | "feather-fan"
  | "feather-dive"
  | "turtle"
export type GadgetId = "jetpack" | "magnetic-glove" | "gas-mask" | "pulse-shield"
export type BuildingMaterialId = "collapsing-floor" | "falling-wall"
export type ProduceId = "tomato" | "cucumber"
export type WeaponId = "melee" | ProduceId
export type SurfaceResourceId = "stone" | "stick" | "rope" | "scrap"
export type OreId = "iron" | "diamond"
export type ResourceId = SurfaceResourceId | OreId
export type ErrandId =
  | "garden-beds"
  | "bakery-delivery"
  | "village-lanterns"
  | "mushroom-hunt"
  | "fence-repair"
  | "trail-signs"
export type HomeChallengeId = CharacterId
export type BeaverRoomId = "floor" | "launchers" | "gas" | "battery" | "control"

export interface InventoryItem {
  id: string
  type: ItemType
  name: string
  description: string
  icon: string
}

export interface PuzzleState {
  foundClues: ClueId[]
  hintsUsed: number
  selectedAnswer: PuzzleAnswer | null
  completed: boolean
}

export interface QuestState {
  status: QuestStatus
}

export interface QuestDefinition {
  id: QuestId
  npcName: string
  title: string
  description: string
  target: number
  icon: string
  gearReward: number
  reward: InventoryItem
}

export interface EnemyDefinition {
  id: string
  type: EnemyType
  assetKey: string
  location: "wild-forest" | "mountain-hollow" | "bird-pass"
  behavior: EnemyBehavior
  x: number
  y: number
  hp: number
  damage: number
  speed: number
  rank: EnemyRank
  respawnMs: number | null
}

export interface GadgetDefinition {
  id: GadgetId
  name: string
  description: string
  price: number
  icon: string
  assetKey: string
  durationMs: number
  cooldownMs: number
}

export interface BuildingMaterialDefinition {
  id: BuildingMaterialId
  name: string
  description: string
  price: number
  icon: string
}

export interface ProduceDefinition {
  id: ProduceId
  name: string
  description: string
  price: number
  packSize: number
  damage: number
  icon: string
}

export interface ResourceDefinition {
  id: ResourceId
  name: string
  description: string
  icon: string
}

export interface ErrandDefinition {
  id: ErrandId
  npcName: string
  title: string
  description: string
  target: number
  icon: string
  reward: number
  rewardItem?: InventoryItem
}

export interface ErrandState {
  status: QuestStatus
  completedTargets: string[]
}

export interface BeaverHouseState {
  completedRooms: BeaverRoomId[]
  checkpoint: BeaverRoomId | "entrance"
  chasmCrossed: boolean
  securityDisabled: boolean
}

export interface EnemyGearDrop {
  id: string
  enemyId: string
  x: number
  y: number
  containsPart: boolean
  location: "wild-forest" | "mountain-hollow" | "bird-pass"
  collected: boolean
}

export interface GameSession {
  character: CharacterDefinition | null
  inventory: InventoryItem[]
  chapter: ChapterId
  difficulty: DifficultyId
  location: LocationId
  entryFrom: LocationId | null
  stamina: number
  maxStamina: number
  health: number
  maxHealth: number
  healingPotionReadyAt: number[]
  puzzle: PuzzleState
  quests: Record<QuestId, QuestState>
  foundLetters: string[]
  defeatedEnemies: string[]
  totalEnemyDefeats: number
  wildForestEnemyDefeats: number
  mountainEnemyDefeats: number
  birdPassEnemyDefeats: number
  enemyDefeatCounts: Record<string, number>
  enemyGearDrops: EnemyGearDrop[]
  enemyRespawnAt: Record<string, number>
  collectedParts: string[]
  gears: number
  rewardedGearSources: string[]
  ownedGadgets: GadgetId[]
  equippedGadget: GadgetId | null
  ownedBuildingMaterials: BuildingMaterialId[]
  produceAmmo: Record<ProduceId, number>
  equippedWeapon: WeaponId
  resources: Record<ResourceId, number>
  collectedResourceNodes: string[]
  hasPickaxe: boolean
  mineSeed: number
  mineEntranceIndex: number
  errands: Record<ErrandId, ErrandState>
  completedHomeChallenges: HomeChallengeId[]
  beaverHouse: BeaverHouseState
  villageSaved: boolean
  mountainCleared: boolean
  mountainRewardClaimed: boolean
  birdPassCleared: boolean
  birdPassRewardClaimed: boolean
  chapterTwoCompleted: boolean
}

export type SaveSlotId = "auto" | "slot-1" | "slot-2" | "slot-3"

export type SerializedGameSession = Omit<GameSession, "character"> & {
  characterId: CharacterId | null
}

export interface SaveSummary {
  characterId: CharacterId
  characterName: string
  chapter: ChapterId
  difficulty: DifficultyId
  location: LocationId
  health: number
  gears: number
  mountainCleared: boolean
  birdPassCleared: boolean
}

export interface SaveEnvelope {
  version: 2
  savedAt: string
  slot: SaveSlotId
  summary: SaveSummary
  session: SerializedGameSession
}

export interface Interactable {
  id: string
  x: number
  y: number
  radius: number
  prompt: string
  kind: "clue" | "burrow"
  clueId?: ClueId
}

export interface AnswerResult {
  correct: boolean
  message: string
}
