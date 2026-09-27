import { CLUES } from "./clues"
import { GADGETS } from "./gadgets"
import { BUILDING_MATERIALS } from "./materials"
import { PRODUCE, PRODUCE_IDS } from "./produce"
import { MINE_ENTRANCES, PICKAXE_ITEM, PICKAXE_RECIPE, SCRAP_GEAR_REWARD } from "./resources"
import { getCharacter } from "./characters"
import { ENEMIES, QUEST_IDS, QUESTS, questProgress } from "./quests"
import { guardiansDefeated, MOUNTAIN_ENEMIES, MOUNTAIN_REWARD } from "./mountain"
import { BIRD_PASS_ENEMIES, BIRD_PASS_REWARD, BIRD_PASS_TURTLE_ID } from "./birdPass"
import { SNOW_ENEMIES, WALRUS_ID, WALRUS_REWARD } from "./snow"
import { KROK_ERRANDS, KROK_PRINCE_REWARD, KROK_SIEGE_ENEMIES, KROK_SIEGE_REWARD, siegeCleared } from "./krok"
import { DIFFICULTY_IDS } from "./difficulty"
import { chapterPrice, POTION_CHARGE_BASE_PRICE } from "./economy"
import {
  BEACH_SCRAP, BEACH_SCRAP_GEARS, emptyOceanState, ICHTHYOSAUR_ID, MEDUSA_SCHOOLS,
  MEDUSA_SCHOOL_RESPAWN_MS, medusaSchool, OCEAN_ENEMIES, OCEAN_REWARD, SCUBA_ITEM, SCUBA_PRICE, TIGER_SHARK_ID,
  type OceanLocationId,
} from "./ocean"
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
  DifficultyId,
  ErrandId,
  GadgetId,
  GameSession,
  HomeChallengeId,
  KrokErrandId,
  LocationId,
  PuzzleAnswer,
  ProduceId,
  QuestId,
  ResourceId,
  SerializedGameSession,
  SurfaceResourceId,
  WeaponId,
} from "./types"

const ALL_ENEMIES = [...ENEMIES, ...MOUNTAIN_ENEMIES, ...BIRD_PASS_ENEMIES, ...SNOW_ENEMIES, ...KROK_SIEGE_ENEMIES, ...OCEAN_ENEMIES] as const
const LOCATION_IDS = new Set<LocationId>([
  "forest-clearing",
  "forest-village",
  "wild-forest",
  "mountain-hollow",
  "bird-pass",
  "snow-valley",
  "snow-city",
  "krok-outskirts",
  "krok-city",
  "ice-palace",
  "ice-throne",
  "beach",
  "sea",
  "trench",
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
      (data.chapter !== 1 && data.chapter !== 2 && data.chapter !== 3 && data.chapter !== 4) ||
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
      if (!session.difficulty || !DIFFICULTY_IDS.includes(session.difficulty)) session.difficulty = "hard"
      session.birdPassEnemyDefeats ??= 0
      session.birdPassCleared ??= session.defeatedEnemies.includes(BIRD_PASS_TURTLE_ID)
      session.birdPassRewardClaimed ??= session.birdPassCleared
      session.chapterTwoCompleted ??= session.birdPassCleared
      session.snowValleyEnemyDefeats ??= 0
      session.snowCityEnemyDefeats ??= 0
      session.icePalaceEnemyDefeats ??= 0
      session.walrusCleared ??= session.defeatedEnemies.includes(WALRUS_ID)
      session.walrusRewardClaimed ??= session.walrusCleared
      session.krokSiegeCleared ??= siegeCleared(session.defeatedEnemies)
      session.krokSiegeRewardClaimed ??= session.krokSiegeCleared
      session.krokErrands ??= this.emptyKrokErrands()
      for (const id of Object.keys(this.emptyKrokErrands()) as KrokErrandId[]) session.krokErrands[id] ??= { status: "available", completedTargets: [] }
      session.princeQuest ??= { status: session.walrusCleared ? "ready" : "available" }
      session.produceAmmo = Object.assign({ tomato: 0, cucumber: 0, "dense-tomato": 0, "large-cucumber": 0 }, session.produceAmmo)
      for (const [id, at] of Object.entries(session.enemyRespawnAt ?? {})) {
        if (!Number.isFinite(at) || at <= now) delete session.enemyRespawnAt[id]
      }
      session.enemyGearDrops = session.enemyGearDrops.map((drop) => ({
        ...drop,
        location: drop.location ?? "wild-forest",
      }))
      session.healingPotionReadyAt = activePotionCooldowns(session.healingPotionReadyAt ?? [], now)
      const ocean = { ...emptyOceanState(), ...session.ocean }
      ocean.schools = Object.fromEntries(MEDUSA_SCHOOLS.map(({ id, enemyIds }) => {
        const old = session.ocean?.schools?.[id]
        return [id, { aggressive: old?.aggressive === true,
          defeatedEnemies: Array.isArray(old?.defeatedEnemies) ? old.defeatedEnemies.filter((enemyId) => enemyIds.includes(enemyId)) : [],
          respawnAt: Number.isFinite(old?.respawnAt) ? old!.respawnAt : null }]
      }))
      session.ocean = ocean
      this.session = { ...session, character: getCharacter(characterId as CharacterId) }
      this.refreshMedusaSchoolsInternal(now)
      if (["beach", "sea", "trench"].includes(this.session.location) && !this.canEnterOceanLocation(this.session.location as OceanLocationId)) {
        this.session.entryFrom = this.session.location
        this.session.location = "forest-village"
      }
      this.normalizeVillageChapter()
      this.updateOceanReadiness()
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
    if (this.session.chapter < 2) this.session.chapter = 2
    this.session.location = "forest-village"
    this.normalizeVillageChapter()
    this.session.maxHealth = calculateMaxHealth(character.stats.endurance)
    this.session.health = this.session.maxHealth
    this.session.stamina = this.session.maxStamina
    this.notify()
  }

  setDifficulty(difficulty: DifficultyId): boolean {
    if (!DIFFICULTY_IDS.includes(difficulty) || this.session.difficulty === difficulty) return false
    this.session.difficulty = difficulty
    this.notify()
    return true
  }

  setLocation(location: LocationId, entryFrom?: LocationId | null): void {
    this.requireCharacter()
    if (location === "ice-palace" && !this.canEnterIcePalace()) return
    if (["beach", "sea", "trench"].includes(location) && !this.canEnterOceanLocation(location as OceanLocationId)) return
    if (entryFrom !== undefined) this.session.entryFrom = entryFrom
    else if (this.session.location !== location) this.session.entryFrom = this.session.location
    this.session.location = location
    this.normalizeVillageChapter()
    if (location === "beach") {
      this.session.ocean.beachVisited = true
      this.updateOceanReadiness()
    }
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
    const school = medusaSchool(id)
    if (school) {
      this.refreshMedusaSchoolsInternal(defeatedAt)
      const schoolState = this.session.ocean.schools[school.id]!
      if (schoolState.defeatedEnemies.includes(id)) return false
      schoolState.aggressive = true
      schoolState.defeatedEnemies.push(id)
      if (schoolState.defeatedEnemies.length === school.enemyIds.length) {
        schoolState.respawnAt = defeatedAt + MEDUSA_SCHOOL_RESPAWN_MS
        for (const memberId of school.enemyIds) this.session.enemyRespawnAt[memberId] = schoolState.respawnAt
      }
    }
    const firstDefeat = !this.session.defeatedEnemies.includes(id)
    if (!firstDefeat && definition.respawnMs === null) return false
    if (!school && definition.respawnMs != null) {
      this.session.enemyRespawnAt[id] = defeatedAt + definition.respawnMs
    }
    if (firstDefeat) this.session.defeatedEnemies.push(id)
    const defeatCount = (this.session.enemyDefeatCounts[id] ?? 0) + 1
    this.session.enemyDefeatCounts[id] = defeatCount
    this.session.totalEnemyDefeats += 1
    if (definition.location === "wild-forest") this.session.wildForestEnemyDefeats += 1
    else if (definition.location === "mountain-hollow") this.session.mountainEnemyDefeats += 1
    else if (definition.location === "bird-pass") this.session.birdPassEnemyDefeats += 1
    else if (definition.location === "snow-valley") this.session.snowValleyEnemyDefeats += 1
    else if (definition.location === "snow-city") this.session.snowCityEnemyDefeats += 1
    else if (definition.location === "ice-palace") this.session.icePalaceEnemyDefeats += 1
    if (definition.id !== BIRD_PASS_TURTLE_ID && definition.dropsGear !== false) {
      this.session.enemyGearDrops.push({
        id: `${id}:${defeatCount}`,
        enemyId: id,
        x: x ?? definition.x,
        y: y ?? definition.y,
        containsPart: definition.location === "wild-forest",
        location: definition.location,
        collected: false,
      })
    }
    this.updateQuestReadiness("robot-sweep")
    if (definition.location === "mountain-hollow" && guardiansDefeated(this.session.defeatedEnemies)) {
      this.completeMountainInternal()
    }
    if (definition.id === BIRD_PASS_TURTLE_ID) this.completeBirdPassInternal()
    if (definition.id === WALRUS_ID) this.completeWalrusInternal()
    if (definition.id === TIGER_SHARK_ID) this.session.ocean.sharkCleared = true
    if (definition.id === ICHTHYOSAUR_ID) this.session.ocean.ichthyosaurCleared = true
    if (definition.location === "krok-outskirts" && siegeCleared(this.session.defeatedEnemies)) {
      this.session.krokSiegeCleared = true
      if (!this.session.krokSiegeRewardClaimed) {
        this.session.krokSiegeRewardClaimed = true
        this.awardGearsInternal("siege:krok", 8)
        this.session.inventory.push({ ...KROK_SIEGE_REWARD })
      }
    }
    this.notify()
    return firstDefeat
  }

  collectEnemyGearDrop(dropId: string): boolean {
    const drop = this.session.enemyGearDrops.find(({ id }) => id === dropId)
    if (!drop || drop.collected) return false
    drop.collected = true
    this.session.gears += 1
    this.updateOceanReadiness()
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

  acceptKrokErrand(id: KrokErrandId): boolean {
    const errand = this.session.krokErrands[id]
    if (errand.status !== "available") return false
    errand.status = errand.completedTargets.length >= KROK_ERRANDS[id].target ? "ready" : "active"
    this.notify()
    return true
  }

  completeKrokTarget(id: KrokErrandId, target: string): boolean {
    const errand = this.session.krokErrands[id]
    if (errand.status !== "active" || errand.completedTargets.includes(target)) return false
    errand.completedTargets.push(target)
    if (errand.completedTargets.length >= KROK_ERRANDS[id].target) errand.status = "ready"
    this.notify()
    return true
  }

  turnInKrokErrand(id: KrokErrandId): boolean {
    const errand = this.session.krokErrands[id]
    if (errand.status !== "ready") return false
    errand.status = "completed"
    this.awardGearsInternal(`krok-errand:${id}`, KROK_ERRANDS[id].reward)
    this.notify()
    return true
  }

  acceptPrinceQuest(): boolean {
    if (!this.session.krokSiegeCleared || this.session.princeQuest.status !== "available") return false
    this.session.princeQuest.status = this.session.walrusCleared ? "ready" : "active"
    this.notify()
    return true
  }

  canEnterIcePalace(): boolean {
    return this.session.chapter >= 3 && this.session.krokSiegeCleared && this.session.princeQuest.status !== "available"
  }

  turnInPrinceQuest(): boolean {
    if (this.session.princeQuest.status !== "ready") return false
    this.session.princeQuest.status = "completed"
    this.awardGearsInternal("prince:walrus", 8)
    if (!this.session.inventory.some(({ id }) => id === KROK_PRINCE_REWARD.id)) this.session.inventory.push({ ...KROK_PRINCE_REWARD })
    this.notify()
    return true
  }

  completeHomeChallenge(id: HomeChallengeId): boolean {
    if (this.session.completedHomeChallenges.includes(id)) return false
    this.session.completedHomeChallenges.push(id)
    this.awardGearsInternal(`home:${id}`, 2)
    this.notify()
    return true
  }

  shopPrice(basePrice: number): number {
    return chapterPrice(basePrice, this.session.chapter)
  }

  potionRefillPrice(now = Date.now()): number {
    return activePotionCooldowns(this.session.healingPotionReadyAt, now).length * this.shopPrice(POTION_CHARGE_BASE_PRICE)
  }

  purchaseGadget(id: GadgetId): boolean {
    const gadget = GADGETS[id]
    const price = this.shopPrice(gadget.price)
    if (this.session.ownedGadgets.includes(id) || this.session.gears < price) return false
    this.session.gears -= price
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
    const price = this.shopPrice(material.price)
    if (
      this.session.ownedBuildingMaterials.includes(id) ||
      this.session.gears < price
    ) return false
    this.session.gears -= price
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
    const price = this.shopPrice(produce.price)
    if (this.session.gears < price) return false
    this.session.gears -= price
    this.session.produceAmmo[id] += produce.packSize
    this.notify()
    return true
  }

  refillHealingPotions(now = Date.now()): boolean {
    const missing = activePotionCooldowns(this.session.healingPotionReadyAt, now).length
    const price = this.potionRefillPrice(now)
    if (!missing || this.session.gears < price) return false
    this.session.gears -= price
    this.session.healingPotionReadyAt = []
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
        this.normalizeVillageChapter()
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

  completeBirdPass(): boolean {
    if (!this.session.defeatedEnemies.includes(BIRD_PASS_TURTLE_ID) || this.session.birdPassCleared) return false
    this.completeBirdPassInternal()
    this.notify()
    return true
  }

  beginChapterThree(): boolean {
    if (!this.session.birdPassCleared || this.session.chapter >= 3) return false
    this.session.entryFrom = "bird-pass"
    this.session.chapter = 3
    this.session.location = "forest-village"
    this.session.health = this.session.maxHealth
    this.session.stamina = this.session.maxStamina
    this.notify()
    return true
  }

  completeWalrus(): boolean {
    if (!this.session.defeatedEnemies.includes(WALRUS_ID) || this.session.walrusCleared) return false
    this.completeWalrusInternal()
    this.notify()
    return true
  }

  beginOceanIntro(): boolean {
    if (!this.session.walrusCleared || this.session.location !== "forest-village" || this.session.ocean.introSeen) return false
    this.session.ocean.introSeen = true
    this.notify()
    return true
  }

  visitBeach(): boolean {
    if (this.session.location !== "beach" || !this.canEnterOceanLocation("beach")) return false
    const firstVisit = !this.session.ocean.beachVisited
    this.session.ocean.beachVisited = true
    this.updateOceanReadiness()
    this.notify()
    return firstVisit
  }

  canEnterOceanLocation(location: OceanLocationId): boolean {
    const ocean = this.session.ocean
    if (!this.session.walrusCleared || !ocean.introSeen) return false
    if (location === "beach") return true
    if (!ocean.hasScuba) return false
    return location === "sea" || ocean.sharkCleared
  }

  purchaseScuba(): boolean {
    const ocean = this.session.ocean
    if (this.session.location !== "mole-shop" || !ocean.beachVisited || ocean.hasScuba || this.session.gears < SCUBA_PRICE) return false
    this.session.gears -= SCUBA_PRICE
    ocean.hasScuba = true
    if (!this.session.inventory.some(({ id }) => id === SCUBA_ITEM.id)) this.session.inventory.push({ ...SCUBA_ITEM })
    this.notify()
    return true
  }

  collectBeachScrap(id: string): boolean {
    if (this.session.location !== "beach" || !BEACH_SCRAP.some((pile) => pile.id === id)) return false
    return this.awardGears(`beach-scrap:${id}`, BEACH_SCRAP_GEARS)
  }

  provokeMedusaSchool(enemyId: string): boolean {
    const school = medusaSchool(enemyId)
    if (!school) return false
    const state = this.session.ocean.schools[school.id]!
    if (state.aggressive || state.defeatedEnemies.includes(enemyId)) return false
    state.aggressive = true
    this.notify()
    return true
  }

  isMedusaAggressive(enemyId: string): boolean {
    const school = medusaSchool(enemyId)
    return school ? this.session.ocean.schools[school.id]!.aggressive : false
  }

  isMedusaDefeated(enemyId: string): boolean {
    const school = medusaSchool(enemyId)
    return school ? this.session.ocean.schools[school.id]!.defeatedEnemies.includes(enemyId) : false
  }

  deferMedusaRespawns(pausedMs: number): void {
    if (!Number.isFinite(pausedMs) || pausedMs <= 0) return
    let changed = false
    for (const school of MEDUSA_SCHOOLS) {
      const state = this.session.ocean.schools[school.id]!
      if (state.respawnAt === null) continue
      state.respawnAt += pausedMs
      for (const enemyId of school.enemyIds) this.session.enemyRespawnAt[enemyId] = state.respawnAt
      changed = true
    }
    if (changed) this.notify()
  }

  refreshMedusaSchools(now = Date.now()): boolean {
    const changed = this.refreshMedusaSchoolsInternal(now)
    if (changed) this.notify()
    return changed
  }

  finishOceanChapter(): boolean {
    const ocean = this.session.ocean
    if (this.session.location !== "trench" || !ocean.ichthyosaurCleared || ocean.mechanismDisabled) return false
    ocean.mechanismDisabled = true
    if (!this.session.inventory.some(({ id }) => id === OCEAN_REWARD.id)) this.session.inventory.push({ ...OCEAN_REWARD })
    this.session.health = this.session.maxHealth
    this.notify()
    return true
  }

  subscribe(listener: (session: Readonly<GameSession>) => void): () => void {
    this.listeners.add(listener)
    listener(this.session)
    return () => this.listeners.delete(listener)
  }

  private normalizeVillageChapter(): void {
    if (this.session.walrusCleared) this.session.chapter = 4
    else if (this.session.location === "forest-village" && this.session.birdPassCleared && this.session.chapter < 3) this.session.chapter = 3
  }

  private updateOceanReadiness(): void {
    if (this.session.ocean.beachVisited && !this.session.ocean.hasScuba && this.session.gears >= SCUBA_PRICE) this.session.ocean.returnToMole = true
  }

  private refreshMedusaSchoolsInternal(now: number): boolean {
    let changed = false
    for (const school of MEDUSA_SCHOOLS) {
      const state = this.session.ocean.schools[school.id]!
      if (state.respawnAt === null || state.respawnAt > now) continue
      state.aggressive = false
      state.defeatedEnemies = []
      state.respawnAt = null
      for (const enemyId of school.enemyIds) delete this.session.enemyRespawnAt[enemyId]
      changed = true
    }
    return changed
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
    this.updateOceanReadiness()
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

  private completeBirdPassInternal(): void {
    this.session.birdPassCleared = true
    this.session.chapterTwoCompleted = true
    this.session.health = this.session.maxHealth
    if (this.session.birdPassRewardClaimed) return
    this.session.birdPassRewardClaimed = true
    this.awardGearsInternal("boss:turtle-guardian", BIRD_PASS_REWARD.gears)
    if (!this.session.inventory.some(({ id }) => id === BIRD_PASS_REWARD.item.id)) {
      this.session.inventory.push({ ...BIRD_PASS_REWARD.item })
    }
  }

  private completeWalrusInternal(): void {
    this.session.walrusCleared = true
    this.session.chapter = 4
    this.session.health = this.session.maxHealth
    if (this.session.princeQuest.status === "active") this.session.princeQuest.status = "ready"
    if (this.session.walrusRewardClaimed) return
    this.session.walrusRewardClaimed = true
    if (!this.session.inventory.some(({ id }) => id === WALRUS_REWARD.id)) {
      this.session.inventory.push({ ...WALRUS_REWARD })
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

  private emptyKrokErrands(): GameSession["krokErrands"] {
    return { rivets: { status: "available", completedTargets: [] }, tablets: { status: "available", completedTargets: [] }, medicine: { status: "available", completedTargets: [] }, "street-lamps": { status: "available", completedTargets: [] } }
  }

  private emptySession(): GameSession {
    const mineSeed = Math.floor(Math.random() * 4_294_967_296) >>> 0
    return {
      character: null,
      inventory: [],
      chapter: 1,
      difficulty: "hard",
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
      birdPassEnemyDefeats: 0,
      snowValleyEnemyDefeats: 0,
      snowCityEnemyDefeats: 0,
      krokSiegeCleared: false,
      krokSiegeRewardClaimed: false,
      krokErrands: this.emptyKrokErrands(),
      princeQuest: { status: "available" },
      icePalaceEnemyDefeats: 0,
      enemyDefeatCounts: {},
      enemyGearDrops: [],
      enemyRespawnAt: {},
      collectedParts: [],
      gears: 0,
      rewardedGearSources: [],
      ownedGadgets: [],
      equippedGadget: null,
      ownedBuildingMaterials: [],
      produceAmmo: { tomato: 0, cucumber: 0, "dense-tomato": 0, "large-cucumber": 0 },
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
      birdPassCleared: false,
      birdPassRewardClaimed: false,
      chapterTwoCompleted: false,
      walrusCleared: false,
      walrusRewardClaimed: false,
      ocean: emptyOceanState(),
    }
  }
}

export const gameStore = new GameStore()
