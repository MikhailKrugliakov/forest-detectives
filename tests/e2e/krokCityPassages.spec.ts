import { expect, test } from "@playwright/test"
import { prepareNavigation, walkWaypoints } from "./helpers/navigation"

for (const y of [220, 1600, 1820, 3130]) {
  test(`Krok side avenue y=${y} connects all four sectors without blocking houses or NPCs`, async ({ page }) => {
    test.setTimeout(100_000)
    // Walk along the clear edge of the street: residents and shopkeepers keep
    // their legitimate physical bodies on its other side.
    await prepareNavigation(page, "krok-city", [140, y])
    // Keep each timed segment below 600 px. This is still one continuous walk
    // across the city, including every old perimeter lane and the new seams.
    await walkWaypoints(page, [...Array.from({ length: 15 }, (_, index) => [(index + 1) * 600, y] as const), [9460, y]])
    await expect(page.locator("#game-status")).toHaveAttribute("data-player-on-road", "true")
    await page.screenshot({ path: test.info().outputPath(`krok-avenue-${y}.png`) })
  })
}

for (const x of [1300, 8300]) {
  test(`Krok cross-street x=${x} links upper and lower districts across the sector seam`, async ({ page }) => {
    test.setTimeout(55_000)
    await prepareNavigation(page, "krok-city", [x, 140])
    await walkWaypoints(page, [600, 800, 1200, 1460, 1600, 1740, 2200, 2400, 2800, 3060].map((y) => [x, y] as const))
    await expect(page.locator("#game-status")).toHaveAttribute("data-player-on-road", "true")
    await page.screenshot({ path: test.info().outputPath(`krok-cross-street-${x}.png`) })
  })
}
