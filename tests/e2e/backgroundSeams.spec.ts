import { expect, test } from "@playwright/test"
import { SNOW_VALLEY_ENEMIES } from "../../src/domain/snow"
import { prepareNavigation, walkWaypoints, type Waypoint } from "./helpers/navigation"

for (const y of [700, 1220]) {
  test(`village panorama street at y=${y} crosses the former seam in both directions`, async ({ page }) => {
    test.setTimeout(40_000)
    await page.setViewportSize({ width: 1280, height: 720 })
    const route: readonly Waypoint[] = [[-450, y], [-220, y], [0, y], [220, y], [450, y]]
    await prepareNavigation(page, "forest-village", route[0]!)
    await walkWaypoints(page, route.slice(0, 3))
    await page.waitForTimeout(350)
    await page.screenshot({ path: test.info().outputPath(`village-continuous-seam-${y}.png`) })
    await walkWaypoints(page, route.slice(3))
    await walkWaypoints(page, [...route].reverse())
    await expect(page.locator("#game-status")).toHaveAttribute("data-location", "forest-village")
  })
}

test("snow valley panorama connects both former halves without a separate bridge overlay", async ({ page }) => {
  test.setTimeout(45_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  const route: readonly Waypoint[] = [[1950, 875], [2100, 830], [2300, 800], [2400, 825], [2450, 840], [2650, 890], [2850, 940]]
  await prepareNavigation(page, "snow-valley", route[0]!, SNOW_VALLEY_ENEMIES.map(({ id }) => id))
  await walkWaypoints(page, route.slice(0, 4))
  await page.waitForTimeout(350)
  await page.screenshot({ path: test.info().outputPath("snow-valley-continuous-seam.png") })
  await walkWaypoints(page, route.slice(4))
  await walkWaypoints(page, [...route].reverse())
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", "snow-valley")
  await expect(page.locator("#game-status")).toHaveAttribute("data-player-on-road", "true")
})
