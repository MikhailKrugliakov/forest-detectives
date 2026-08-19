import { CLUES } from "./clues"
import { GADGETS } from "./gadgets"
import { BUILDING_MATERIALS } from "./materials"
import { PRODUCE, PRODUCE_IDS } from "./produce"
import { MINE_ENTRANCES, PICKAXE_ITEM, PICKAXE_RECIPE, SCRAP_GEAR_REWARD } from "./resources"
import { getCharacter } from "./characters"
import { ENEMIES, QUEST_IDS, QUESTS, questProgress } from "./quests"
import { guardiansDefeated, MOUNTAIN_ENEMIES, MOUNTAIN_REWARD } from "./mountain"
import {
  activePotionCooldowns,
  HEALING_POTION_CAPACITY,
  HEALING_POTION_RECHARGE_MS,
  healingPotionAmount,
} from "./healing"
import {
  calculateMaxHealth,
  buildHint,
  calculateMaxStamina,
  STAMINA_DRAIN_PER_SECOND,
  STAMINA_RECOVERY_PER_SECOND,
} from "./rules"
import { ERRANDS } from "./village"
import type {
  AnswerResult,
  BeaverRoomId,
  BuildingMaterialId,
  CharacterId,
  ClueId,
  ErrandId,
  GadgetId,
  GameSession,
  HomeChallengeId,
  LocationId,
  PuzzleAnswer,
  ProduceId,
  QuestId,
  ResourceId,
  SerializedGameSession,
  SurfaceResourceId,
  WeaponId,
} from "./types"

const ALL_ENEMIES = [...ENEMIES, ...MOUNTAIN_ENEMIES] as const
const LOCATION_IDS = new Set<LocationId>([
  "forest-clearing",
  "forest-village",
  "wild-forest",
  "mountain-hollow",
  "forest-mine",
  "melon-farm",
  "mole-shop",
  "beaver-house",
  "wolf-home",
  "fox-home",
  "rabbit-home",
  "watermelon-home",
  "sheepwolf-home",
])

export const BEAVER_ROOM_ORDER: readonly BeaverRoomId[] = [
  "floor",
  "launchers",
  "gas",
  "battery",
  "control",
]

export class GameStore {
  private session: GameSession = this.emptySession()
  private readonly listeners = new Set<(session: Readonly<GameSession>) => void>()

  get state(): Readonly<GameSession> {
    return this.session
  }

  reset(): void {
    this.session = this.emptySession()
    this.notify()
  }

  exportSerializedSession(): SerializedGameSession {
    const { character, ...session } = this.session
    return structuredClone({ ...session, characterId: character?.id ?? null })
  }

  restoreSerializedSession(value: unknown): boolean {
    if (!value || typeof value !== "object") return false
    const data = value as Partial<SerializedGameSession>
    if (
      !data.characterId ||
      !["wolf", "fox", "rabbit", "watermelon", "sheepwolf"].includes(data.characterId) ||
      !data.location ||
      !LOCATION_IDS.has(data.location) ||
      (data.chapter !== 1 && data.chapter !== 2) ||
      !Array.isArray(data.inventory) ||
      !Array.isArray(data.defeatedEnemies) ||
      !Array.isArray(data.enemyGearDrops) ||
      !data.quests ||
      !data.resources
    ) return false

    try {
      const clone = structuredClone(data) as SerializedGameSession
      const { characterId, ...session } = clone
      const now = Date.now()
      for (const [id, at] of Object.entries(session.enemyRespawnAt ?? {})) {
        if (!Number.isFinite(at) || at <= now) delete session.enemyRespawnAt[id]
      }
      session.enemyGearDrops = session.enemyGearDrops.map((drop) => ({
        ...drop,
        location: drop.location ?? "wild-forest",
      }))
      session.healingPotionReadyAt = activePotionCooldowns(session.healingPotionReadyAt ?? [], now)
      this.session = { ...session, character: getCharacter(characterId as CharacterId) }
      this.notify()
      return true
    } catch {
      return false
    }
  }

  selectCharacter(id: CharacterId): void {
    const character = getCharacter(id)
    const maxStamina = calculateMaxStamina(character.stats.endurance)
    const maxHealth = calculateMaxHealth(character.stats.endurance)
    this.session = {
      ...this.emptySession(),
      character,
      inventory: [{ ...character.equipment, type: "equipment" }],
      stamina: maxStamina,
      maxStamina,
      health: maxHealth,
      maxHealth,
    }
    this.notify()
  }

  collectClue(id: ClueId): boolean {
    if (!this.session.character || this.session.puzzle.foundClues.includes(id)) return false
    this.session.puzzle.foundClues.push(id)
    this.session.inventory.push(CLUES[id])
    this.notify()
    return true
  }

  analyze(): string {
    const character = this.requireCharacter()
    const hint = buildHint(character.stats.intelligence, this.session.puzzle.foundClues)
    if (this.session.puzzle.foundClues.length >= 2) this.session.puzzle.hintsUsed += 1
    this.notify()
    return hint
  }

  answer(answer: PuzzleAnswer): AnswerResult {
    this.requireCharacter()
    this.session.puzzle.selectedAnswer = answer
    if (answer === "burrow") {
      this.session.puzzle.completed = true
      this.notify()
      return { correct: true, message: "Точно! Все следы ведут к норе. Посылка найдена!" }
    }
    this.notify()
    return { correct: false, message: `Похоже, это не так. ${this.analyze()}` }
  }

  updateStamina(deltaSeconds: number, sprinting: boolean): void {
    const rate = sprinting ? -STAMINA_DRAIN_PER_SECOND : STAMINA_RECOVERY_PER_SECOND
    this.session.stamina = Math.max(
      0,
      Math.min(this.session.maxStamina, this.session.stamina + rate * deltaSeconds),
    )
  }

  beginVillageChapter(): void {
    const character = this.requireCharacter()
    this.session.entryFrom = this.session.location
    this.session.chapter = 2
    this.session.location = "forest-village"
    this.session.maxHealth = calculateMaxHealth(character.stats.endurance)
    this.session.health = this.session.maxHealth
    this.session.stamina = this.session.maxStamina
    this.notify()
  }

  setLocation(location: LocationId, entryFrom?: LocationId | null): void {
    this.requireCharacter()
    if (entryFrom !== undefined) this.session.entryFrom = entryFrom
    else if (this.session.location !== location) this.session.entryFrom = this.session.location
    this.session.location = location
    this.notify()
  }

  acceptQuest(id: QuestId): boolean {
    const quest = this.session.quests[id]
    if (quest.status !== "available") return false
    quest.status = this.progressFor(id) >= QUESTS[id].target ? "ready" : "active"
    this.notify()
    return true
  }

  turnInQuest(id: QuestId): boolean {
    const quest = this.session.quests[id]
    if (quest.status !== "ready") return false
    quest.status = "completed"
    if (!this.session.inventory.some((item) => item.id === QUESTS[id].reward.id)) {
      this.session.inventory.push({ ...QUESTS[id].reward })
    }
    this.awardGearsInternal(`quest:${id}`, QUESTS[id].gearReward)
    this.session.health = this.session.maxHealth
    this.session.villageSaved = QUEST_IDS.every(
      (questId) => this.session.quests[questId].status === "completed",
    )
    this.notify()
    return true
  }

  collectLetter(id: string): boolean {
    if (this.session.foundLetters.includes(id)) return false
    this.session.foundLetters.push(id)
    this.updateQuestReadiness("lost-letters")
    this.notify()
    return true
  }

  defeatEnemy(id: string, defeatedAt = Date.now(), x?: number, y?: number): boolean {
    const definition = ALL_ENEMIES.find((enemy) => enemy.id === id)
    if (!definition) return false
    const firstDefeat = !this.session.defeatedEnemies.includes(id)
    if (!firstDefeat && definition.rank === "boss") return false
    if (definition?.respawnMs != null) {
      this.session.enemyRespawnAt[id] = defeatedAt + definition.respawnMs
    }
    if (firstDefeat) this.session.defeatedEnemies.push(id)
    const defeatCount = (this.session.enemyDefeatCounts[id] ?? 0) + 1
    this.session.enemyDefeatCounts[id] = defeatCount
    this.session.totalEnemyDefeats += 1
    if (definition.location === "wild-forest") this.session.wildForestEnemyDefeats += 1
    else this.session.mountainEnemyDefeats += 1
    this.session.enemyGearDrops.push({
      id: `${id}:${defeatCount}`,
      enemyId: id,
      x: x ?? definition.x,
      y: y ?? definition.y,
      containsPart: definition.location === "wild-forest",
      location: definition.location,
      collected: false,
    })
    this.updateQuestReadiness("robot-sweep")
    if (definition.location === "mountain-hollow" && guardiansDefeated(this.session.defeatedEnemies)) {
      this.completeMountainInternal()
    }
    this.notify()
    return firstDefeat
  }

  collectEnemyGearDrop(dropId: string): boolean {
    const drop = this.session.enemyGearDrops.find(({ id }) => id === dropId)
    if (!drop || drop.collected) return false
    drop.collected = true
    this.session.gears += 1
    if (drop.containsPart && !this.session.collectedParts.includes(drop.id)) {
      this.session.collectedParts.push(drop.id)
      this.updateQuestReadiness("robot-parts")
    }
    this.notify()
    return true
  }

  collectPart(enemyId: string): boolean {
    if (!this.session.defeatedEnemies.includes(enemyId) || this.session.collectedParts.includes(enemyId)) {
      return false
    }
    this.session.collectedParts.push(enemyId)
    this.updateQuestReadiness("robot-parts")
    this.notify()
    return true
  }

  acceptErrand(id: ErrandId): boolean {
    const errand = this.session.errands[id]
    if (errand.status !== "available") return false
    errand.status = errand.completedTargets.length >= ERRANDS[id].target ? "ready" : "active"
    this.notify()
    return true
  }

  completeErrandTarget(id: ErrandId, targetId: string): boolean {
    const errand = this.session.errands[id]
    if (errand.status !== "active" || errand.completedTargets.includes(targetId)) return false
    errand.completedTargets.push(targetId)
    if (errand.completedTargets.length >= ERRANDS[id].target) errand.status = "ready"
    this.notify()
    return true
  }

  turnInErrand(id: ErrandId): boolean {
    const errand = this.session.errands[id]
    if (errand.status !== "ready") return false
    errand.status = "completed"
    this.awardGearsInternal(`errand:${id}`, ERRANDS[id].reward)
    const rewardItem = ERRANDS[id].rewardItem
    if (rewardItem && !this.session.inventory.some(({ id: itemId }) => itemId === rewardItem.id)) {
      this.session.inventory.push({ ...rewardItem })
    }
    this.notify()
    return true
  }

  errandProgress(id: ErrandId): number {
    return this.session.errands[id].completedTargets.length
  }

  completeHomeChallenge(id: HomeChallengeId): boolean {
    if (this.session.completedHomeChallenges.includes(id)) return false
    this.session.completedHomeChallenges.push(id)
    this.awardGearsInternal(`home:${id}`, 2)
    this.notify()
    return true
  }

  purchaseGadget(id: GadgetId): boolean {
    const gadget = GADGETS[id]
    if (this.session.ownedGadgets.includes(id) || this.session.gears < gadget.price) return false
    this.session.gears -= gadget.price
    this.session.ownedGadgets.push(id)
    this.session.inventory.push({
      id,
      type: "gadget",
      name: gadget.name,
      description: gadget.description,
      icon: gadget.icon,
    })
    if (!this.session.equippedGadget) this.session.equippedGadget = id
    this.notify()
    return true
  }

  equipGadget(id: GadgetId): boolean {
    if (!this.session.ownedGadgets.includes(id)) return false
    this.session.equippedGadget = id
    this.notify()
    return true
  }

  purchaseBuildingMaterial(id: BuildingMaterialId): boolean {
    const material = BUILDING_MATERIALS[id]
    if (
      this.session.ownedBuildingMaterials.includes(id) ||
      this.session.gears < material.price
    ) return false
    this.session.gears -= material.price
    this.session.ownedBuildingMaterials.push(id)
    this.session.inventory.push({
      id,
      type: "building-material",
      name: material.name,
      description: material.description,
      icon: material.icon,
    })
    this.notify()
    return true
  }

  purchaseProduce(id: ProduceId): boolean {
    const produce = PRODUCE[id]
    if (this.session.gears < produce.price) return false
    this.session.gears -= produce.price
    this.session.produceAmmo[id] += produce.packSize
    this.notify()
    return true
  }

  equipWeapon(id: WeaponId): boolean {
    if (id !== "melee" && this.session.produceAmmo[id] <= 0) return false
    this.session.equippedWeapon = id
    this.notify()
    return true
  }

  cycleWeapon(): WeaponId {
    const weapons: readonly WeaponId[] = ["melee", ...PRODUCE_IDS]
    const currentIndex = weapons.indexOf(this.session.equippedWeapon)
    for (let offset = 1; offset <= weapons.length; offset += 1) {
      const candidate = weapons[(currentIndex + offset) % weapons.length]!
      if (candidate === "melee" || this.session.produceAmmo[candidate] > 0) {
        this.session.equippedWeapon = candidate
        this.notify()
        return candidate
      }
    }
    return this.session.equippedWeapon
  }

  consumeProduceShot(): ProduceId | null {
    const id = this.session.equippedWeapon
    if (id === "melee" || this.session.produceAmmo[id] <= 0) {
      if (id !== "melee") {
        this.session.equippedWeapon = "melee"
        this.notify()
      }
      return null
    }
    this.session.produceAmmo[id] -= 1
    if (this.session.produceAmmo[id] === 0) this.session.equippedWeapon = "melee"
    this.notify()
    return id
  }

  collectResource(nodeId: string, id: ResourceId): boolean {
    if (this.session.collectedResourceNodes.includes(nodeId)) return false
    if ((id === "iron" || id === "diamond") && !this.session.hasPickaxe) return false
    this.session.collectedResourceNodes.push(nodeId)
    this.session.resources[id] += 1
    if (id === "scrap") this.awardGearsInternal(`scrap:${nodeId}`, SCRAP_GEAR_REWARD)
    this.notify()
    return true
  }

  canCraftPickaxe(): boolean {
    return !this.session.hasPickaxe && (Object.entries(PICKAXE_RECIPE) as Array<[SurfaceResourceId, number]>).every(
      ([id, amount]) => this.session.resources[id] >= amount,
    )
  }

  craftPickaxe(): boolean {
    if (!this.canCraftPickaxe()) return false
    for (const [id, amount] of Object.entries(PICKAXE_RECIPE) as Array<[SurfaceResourceId, number]>) {
      this.session.resources[id] -= amount
    }
    this.session.hasPickaxe = true
    this.session.inventory.push({ ...PICKAXE_ITEM })
    this.notify()
    return true
  }

  awardGears(sourceId: string, amount: number): boolean {
    if (!Number.isInteger(amount) || amount <= 0) return false
    const awarded = this.awardGearsInternal(sourceId, amount)
    if (awarded) this.notify()
    return awarded
  }

  completeBeaverRoom(id: BeaverRoomId): boolean {
    if (this.session.beaverHouse.completedRooms.includes(id)) return false
    const expected = BEAVER_ROOM_ORDER[this.session.beaverHouse.completedRooms.length]
    if (id !== expected) return false
    if (id === "control" && !this.session.beaverHouse.chasmCrossed) return false
    this.session.beaverHouse.completedRooms.push(id)
    this.session.beaverHouse.checkpoint = id
    if (id === "control") this.session.beaverHouse.securityDisabled = true
    this.updateQuestReadiness("beaver-security")
    this.notify()
    return true
  }

  crossBeaverChasm(): boolean {
    if (
      this.session.beaverHouse.chasmCrossed ||
      this.session.equippedGadget !== "jetpack" ||
      !this.session.ownedGadgets.includes("jetpack") ||
      !this.session.beaverHouse.completedRooms.includes("battery")
    ) {
      return false
    }
    this.session.beaverHouse.chasmCrossed = true
    this.notify()
    return true
  }

  takeDamage(amount: number): { knockedOut: boolean; health: number } {
    this.requireCharacter()
    this.session.health = Math.max(0, this.session.health - Math.max(0, amount))
    const knockedOut = this.session.health === 0
    if (knockedOut) {
      if (this.session.location !== "beaver-house") {
        this.session.entryFrom = this.session.location
        this.session.location = "forest-village"
      }
      this.session.health = this.session.maxHealth
      this.session.stamina = this.session.maxStamina
    }
    this.notify()
    return { knockedOut, health: this.session.health }
  }

  restoreHealth(): void {
    this.session.health = this.session.maxHealth
    this.notify()
  }

  useHealingPotion(now = Date.now()): {
    used: boolean
    healed: number
    ready: number
    nextReadyAt: number | null
    reason: "used" | "full-health" | "recharging"
  } {
    this.requireCharacter()
    const active = activePotionCooldowns(this.session.healingPotionReadyAt, now)
    if (this.session.health >= this.session.maxHealth) {
      return {
        used: false,
        healed: 0,
        ready: HEALING_POTION_CAPACITY - active.length,
        nextReadyAt: active[0] ?? null,
        reason: "full-health",
      }
    }
    if (active.length >= HEALING_POTION_CAPACITY) {
      return { used: false, healed: 0, ready: 0, nextReadyAt: active[0] ?? null, reason: "recharging" }
    }
    const previousHealth = this.session.health
    this.session.health = Math.min(this.session.maxHealth, this.session.health + healingPotionAmount(this.session.maxHealth))
    active.push(now + HEALING_POTION_RECHARGE_MS)
    active.sort((left, right) => left - right)
    this.session.healingPotionReadyAt = active
    this.notify()
    return {
      used: true,
      healed: this.session.health - previousHealth,
      ready: HEALING_POTION_CAPACITY - active.length,
      nextReadyAt: active[0] ?? null,
      reason: "used",
    }
  }

  questProgress(id: QuestId): number {
    return this.progressFor(id)
  }

  hasAcceptedQuest(): boolean {
    return QUEST_IDS.some((id) => this.session.quests[id].status !== "available")
  }

  isMountainUnlocked(): boolean {
    return this.session.defeatedEnemies.includes("boar-3")
  }

  subscribe(listener: (session: Readonly<GameSession>) => void): () => void {
    this.listeners.add(listener)
    listener(this.session)
    return () => this.listeners.delete(listener)
  }

  private requireCharacter() {
    if (!this.session.character) throw new Error("Герой ещё не выбран")
    return this.session.character
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.session))
  }

  private progressFor(id: QuestId): number {
    return questProgress(id, this.session)
  }

  private updateQuestReadiness(id: QuestId): void {
    if (this.session.quests[id].status === "active" && this.progressFor(id) >= QUESTS[id].target) {
      this.session.quests[id].status = "ready"
    }
  }

  private awardGearsInternal(sourceId: string, amount: number): boolean {
    if (amount <= 0 || this.session.rewardedGearSources.includes(sourceId)) return false
    this.session.rewardedGearSources.push(sourceId)
    this.session.gears += amount
    return true
  }

  private completeMountainInternal(): void {
    this.session.mountainCleared = true
    if (this.session.mountainRewardClaimed) return
    this.session.mountainRewardClaimed = true
    this.session.resources.iron += MOUNTAIN_REWARD.iron
    this.session.resources.diamond += MOUNTAIN_REWARD.diamond
    if (!this.session.inventory.some(({ id }) => id === MOUNTAIN_REWARD.item.id)) {
      this.session.inventory.push({ ...MOUNTAIN_REWARD.item })
    }
  }

  private emptyQuests(): GameSession["quests"] {
    return {
      "lost-letters": { status: "available" },
      "robot-parts": { status: "available" },
      "robot-sweep": { status: "available" },
      "beaver-security": { status: "available" },
    }
  }

  private emptyErrands(): GameSession["errands"] {
    return {
      "garden-beds": { status: "available", completedTargets: [] },
      "bakery-delivery": { status: "available", completedTargets: [] },
      "village-lanterns": { status: "available", completedTargets: [] },
      "mushroom-hunt": { status: "available", completedTargets: [] },
      "fence-repair": { status: "available", completedTargets: [] },
      "trail-signs": { status: "available", completedTargets: [] },
    }
  }

  private emptySession(): GameSession {
    const mineSeed = Math.floor(Math.random() * 4_294_967_296) >>> 0
    return {
      character: null,
      inventory: [],
      chapter: 1,
      location: "forest-clearing",
      entryFrom: null,
      stamina: 0,
      maxStamina: 0,
      health: 0,
      maxHealth: 0,
      healingPotionReadyAt: [],
      puzzle: { foundClues: [], hintsUsed: 0, selectedAnswer: null, completed: false },
      quests: this.emptyQuests(),
      foundLetters: [],
      defeatedEnemies: [],
      totalEnemyDefeats: 0,
      wildForestEnemyDefeats: 0,
      mountainEnemyDefeats: 0,
      enemyDefeatCounts: {},
      enemyGearDrops: [],
      enemyRespawnAt: {},
      collectedParts: [],
      gears: 0,
      rewardedGearSources: [],
      ownedGadgets: [],
      equippedGadget: null,
      ownedBuildingMaterials: [],
      produceAmmo: { tomato: 0, cucumber: 0 },
      equippedWeapon: "melee",
      resources: { stone: 0, stick: 0, rope: 0, scrap: 0, iron: 0, diamond: 0 },
      collectedResourceNodes: [],
      hasPickaxe: false,
      mineSeed,
      mineEntranceIndex: mineSeed % MINE_ENTRANCES.length,
      errands: this.emptyErrands(),
      completedHomeChallenges: [],
      beaverHouse: { completedRooms: [], checkpoint: "entrance", chasmCrossed: false, securityDisabled: false },
      villageSaved: false,
      mountainCleared: false,
      mountainRewardClaimed: false,
    }
  }
}

export const gameStore = new GameStore()
