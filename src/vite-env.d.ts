/// <reference types="vite/client" />

import type { GameStore } from "./domain/GameStore"
import type { BeaverRoomId, BuildingMaterialId, CharacterId, ClueId, DifficultyId, ErrandId, GadgetId, LocationId, ProduceId, PuzzleAnswer, QuestId, ResourceId, SaveSlotId, WeaponId } from "./domain/types"

declare global {
  interface Window {
    __FOREST_GAME__?: {
      store: GameStore
      selectCharacter: (id: CharacterId) => void
      collectClue: (id: ClueId) => boolean
      answer: (answer: PuzzleAnswer) => unknown
      beginVillage: () => void
      beginChapterThree: () => boolean
      setDifficulty: (id: DifficultyId) => boolean
      setLocation: (location: LocationId) => void
      acceptQuest: (id: QuestId) => boolean
      turnInQuest: (id: QuestId) => boolean
      collectLetter: (id: string) => boolean
      defeatEnemy: (id: string) => boolean
      collectPart: (id: string) => boolean
      collectEnemyGearDrop: (id: string) => boolean
      takeDamage: (amount: number) => unknown
      useHealingPotion: (now?: number) => unknown
      awardGears: (source: string, amount: number) => boolean
      purchaseGadget: (id: GadgetId) => boolean
      purchaseBuildingMaterial: (id: BuildingMaterialId) => boolean
      purchaseProduce: (id: ProduceId) => boolean
      collectResource: (nodeId: string, id: ResourceId) => boolean
      craftPickaxe: () => boolean
      equipWeapon: (id: WeaponId) => boolean
      cycleWeapon: () => WeaponId
      equipGadget: (id: GadgetId) => boolean
      acceptErrand: (id: ErrandId) => boolean
      completeErrandTarget: (id: ErrandId, target: string) => boolean
      turnInErrand: (id: ErrandId) => boolean
      completeHomeChallenge: (id: CharacterId) => boolean
      completeBeaverRoom: (id: BeaverRoomId) => boolean
      crossBeaverChasm: () => boolean
      saveGame: (slot: SaveSlotId) => boolean
      loadGame: (slot: SaveSlotId) => boolean
      deleteSave: (slot: SaveSlotId) => void
      damageEnemy: (id: string, amount: number) => void
      teleport: (x: number, y: number) => void
    }
  }
}

export {}
