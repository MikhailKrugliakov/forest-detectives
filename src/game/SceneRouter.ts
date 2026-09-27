import type { LocationId } from "../domain/types"

export function sceneKeyForLocation(location: LocationId): string {
  if (location.endsWith("-home")) return "hero-home"
  return location
}

export const WORLD_SCENES = [
  "beach",
  "sea",
  "trench",
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
  "forest-mine",
  "melon-farm",
  "mole-shop",
  "beaver-house",
  "hero-home",
] as const
