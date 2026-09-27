import { expect, test } from "@playwright/test"
import { prepareNavigation, walkWaypoints, type Waypoint } from "./helpers/navigation"
import { SEA_ENEMIES } from "../../src/domain/ocean"
import { OCEAN_BRANCH_POINTS, OCEAN_ROUTE_POINTS } from "../../src/game/data/oceanLayout"

for (const scene of ["beach", "sea", "trench"]) {
  test(`${scene}: road regions join without traps in either direction, including all branches`, async ({ page }) => {
    test.setTimeout(180_000)
    await prepareNavigation(page, scene, [180, 800])
    const points: Waypoint[] = []
    for (const point of OCEAN_ROUTE_POINTS.slice(1)) {
      points.push([point.x, point.y])
      for (const [start, end] of OCEAN_BRANCH_POINTS.filter(([start]) => start!.x === point.x)) {
        points.push([end!.x, end!.y], [start!.x, start!.y])
      }
    }
    await walkWaypoints(page, points)
    await expect(page.locator("#game-status")).toHaveAttribute("data-player-on-road", "true")
    await page.screenshot({ path: test.info().outputPath(`${scene}-arena.png`) })
    await walkWaypoints(page, OCEAN_ROUTE_POINTS.slice().reverse().map(({ x, y }) => [x, y] as const))
    await expect(page.locator("#game-status")).toHaveAttribute("data-player-on-road", "true")
    await expect(page.locator("#game-status")).toHaveAttribute("data-location", scene)
  })
}

test("underwater equipment follows all five heroes without changing road physics", async ({ page }) => {
  test.setTimeout(90_000)
  for (const hero of ["wolf", "fox", "rabbit", "watermelon", "sheepwolf"]) {
    await page.goto(`/?scene=sea&hero=${hero}`)
    const status = page.locator("#game-status")
    await expect(status).toHaveAttribute("data-location", "sea")
    await expect(status).toHaveAttribute("data-scuba-visible", "true")
    await page.evaluate((ids) => { const game = window.__FOREST_GAME__!; game.setDifficulty("walk"); for (const id of ids) game.damageEnemy(id, 999) }, SEA_ENEMIES.map(({ id }) => id))
    await walkWaypoints(page, [[500, 800]])
    await page.screenshot({ path: test.info().outputPath(`swimming-${hero}.png`) })
  }
})
