import type { BeaverRoomId } from "./types"

/** Stable restoration points beside the room exits, clear of walls and traps. */
export const BEAVER_CHECKPOINTS: Readonly<Record<BeaverRoomId | "entrance", Readonly<{ x: number; y: number }>>> = {
  entrance: { x: 520, y: 1110 },
  floor: { x: 820, y: 500 },
  // The previous point (1510, 470) was inside launcher-gas-wall.
  launchers: { x: 1640, y: 750 },
  gas: { x: 1570, y: 750 },
  battery: { x: 1510, y: 1050 },
  control: { x: 2110, y: 1260 },
}
