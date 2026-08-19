import { GameStore, gameStore } from "./GameStore"
import type { SaveEnvelope, SaveSlotId } from "./types"

export const SAVE_VERSION = 1 as const
export const SAVE_SLOTS: readonly SaveSlotId[] = ["auto", "slot-1", "slot-2", "slot-3"]
export const MANUAL_SAVE_SLOTS: readonly SaveSlotId[] = ["slot-1", "slot-2", "slot-3"]

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface SaveActionResult {
  ok: boolean
  message: string
  envelope?: SaveEnvelope
}

const memoryData = new Map<string, string>()
const memoryStorage: StorageLike = {
  getItem: (key) => memoryData.get(key) ?? null,
  setItem: (key, value) => memoryData.set(key, value),
  removeItem: (key) => memoryData.delete(key),
}

function defaultStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage
  } catch {
    // Private browsing or an embedded browser may deny storage access.
  }
  return memoryStorage
}

export class SaveManager {
  private readonly prefix = "forest-detectives:save:v1:"
  private unsubscribe: (() => void) | null = null
  private previousTransitionKey = ""
  private suspended = false

  constructor(
    private readonly store: GameStore,
    private readonly storage: StorageLike = defaultStorage(),
  ) {}

  bindAutosave(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.store.subscribe((state) => {
      const transitionKey = [state.character?.id ?? "", state.chapter, state.location, state.entryFrom ?? ""].join("|")
      if (!this.previousTransitionKey) {
        this.previousTransitionKey = transitionKey
        return
      }
      const changed = transitionKey !== this.previousTransitionKey
      this.previousTransitionKey = transitionKey
      if (changed && state.character && !this.suspended) this.save("auto")
    })
  }

  save(slot: SaveSlotId): SaveActionResult {
    const state = this.store.state
    if (!state.character) return { ok: false, message: "Сначала выбери героя." }
    const envelope: SaveEnvelope = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      slot,
      summary: {
        characterId: state.character.id,
        characterName: state.character.name,
        chapter: state.chapter,
        location: state.location,
        health: state.health,
        gears: state.gears,
        mountainCleared: state.mountainCleared,
      },
      session: this.store.exportSerializedSession(),
    }
    try {
      this.storage.setItem(this.key(slot), JSON.stringify(envelope))
      return { ok: true, message: slot === "auto" ? "Автосохранение обновлено." : "Игра сохранена.", envelope }
    } catch {
      return { ok: false, message: "Не удалось сохранить игру: хранилище браузера недоступно или заполнено." }
    }
  }

  load(slot: SaveSlotId): SaveActionResult {
    const envelope = this.read(slot)
    if (!envelope) return { ok: false, message: "Сохранение отсутствует или повреждено." }
    this.suspended = true
    const restored = this.store.restoreSerializedSession(envelope.session)
    this.suspended = false
    const state = this.store.state
    this.previousTransitionKey = [state.character?.id ?? "", state.chapter, state.location, state.entryFrom ?? ""].join("|")
    return restored
      ? { ok: true, message: "Сохранение загружено.", envelope }
      : { ok: false, message: "Сохранение несовместимо с текущей версией игры." }
  }

  read(slot: SaveSlotId): SaveEnvelope | null {
    try {
      const raw = this.storage.getItem(this.key(slot))
      if (!raw) return null
      const envelope = JSON.parse(raw) as Partial<SaveEnvelope>
      if (
        envelope.version !== SAVE_VERSION ||
        envelope.slot !== slot ||
        typeof envelope.savedAt !== "string" ||
        !envelope.summary ||
        !envelope.session
      ) return null
      return envelope as SaveEnvelope
    } catch {
      return null
    }
  }

  remove(slot: SaveSlotId): void {
    try {
      this.storage.removeItem(this.key(slot))
    } catch {
      // UI will simply continue showing the slot if removal is unavailable.
    }
  }

  clearAutosave(): void {
    this.remove("auto")
  }

  startNewGame(): void {
    this.suspended = true
    this.clearAutosave()
    this.store.reset()
    this.suspended = false
    const state = this.store.state
    this.previousTransitionKey = ["", state.chapter, state.location, ""].join("|")
  }

  private key(slot: SaveSlotId): string {
    return `${this.prefix}${slot}`
  }
}

export const saveManager = new SaveManager(gameStore)
