import type { LocationId } from "../domain/types"

export function sceneKeyForLocation(location: LocationId): string {
  if (location.endsWith("-home")) return "hero-home"
  return location
}

export const WORLD_SCENES = [
  "forest-clearing",
  "forest-village",
  "wild-forest",
  "mountain-hollow",
  "bird-pass",
  "forest-mine",
  "melon-farm",
  "mole-shop",
  "beaver-house",
  "hero-home",
] as const
