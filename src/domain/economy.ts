import type { ChapterId } from "./types"

/** Always scale the original price; never compound a previously rounded value. */
export function chapterPrice(basePrice: number, chapter: ChapterId): number {
  return Math.ceil(basePrice * 1.5 ** Math.max(0, chapter - 2))
}

export const POTION_CHARGE_BASE_PRICE = 2
