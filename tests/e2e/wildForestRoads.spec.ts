import { expect, test, type Page } from "@playwright/test"
import { ENEMIES } from "../../src/domain/quests"

type Point = readonly [number, number]

// Landmarks traced from the painted paths, independently of the collision mask.
const paths: Record<string, readonly Point[]> = {
  central: [[580, 672], [740, 680], [900, 660], [1050, 656], [1180, 634], [1240, 570], [1280, 495], [1360, 380]],
  southern: [[740, 680], [805, 828], [835, 925], [870, 1020], [935, 1095], [1050, 1115], [1130, 1140], [1160, 1240], [1150, 1345], [1010, 1435]],
  western: [[440, 1030], [380, 934], [300, 917], [327, 786], [378, 690], [440, 639], [500, 670]],
}

async function walkPath(page: Page, points: readonly Point[]): Promise<void> {
  const held = new Set<string>()
  try {
    for (const [x, y] of points) {
      await expect.poll(async () => {
        const player = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!)
        const desired = new Set<string>()
        // A waypoint represents a road cross-section, not a pixel-perfect
        // stopping point. Allow input/trace latency without oscillating around it.
        if (Math.abs(player.x - x) > 24) desired.add(player.x < x ? "d" : "a")
        if (Math.abs(player.y - y) > 24) desired.add(player.y < y ? "s" : "w")
        for (const key of held) if (!desired.has(key)) { await page.keyboard.up(key); held.delete(key) }
        for (const key of desired) if (!held.has(key)) { await page.keyboard.down(key); held.add(key) }
        return Math.hypot(player.x - x, player.y - y)
      }, { timeout: 6000, intervals: [40], message: `Painted path must reach (${x}, ${y})` }).toBeLessThan(35)
    }
  } finally {
    for (const key of held) await page.keyboard.up(key)
  }
}

for (const hero of ["sheepwolf", "watermelon"]) {
  for (const [name, points] of Object.entries(paths)) {
    test(`${hero} walks the painted ${name} forest path in both directions`, async ({ page }) => {
      test.setTimeout(60_000)
      await page.goto(`/?scene=wild-forest&hero=${hero}`)
      await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "wild-forest")
      await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
      await page.evaluate(({ ids, start }) => {
        const game = window.__FOREST_GAME__!
        game.setDifficulty("walk")
        // Test scenery separately from intentionally solid, attacking enemies.
        for (const id of ids) game.damageEnemy(id, 999)
        game.teleport(start[0], start[1])
      }, { ids: ENEMIES.map(({ id }) => id), start: points[0]! })
      await expect(page.locator("#game-status")).toHaveAttribute("data-wild-forest-enemies", String(ENEMIES.length))
      await page.waitForTimeout(150)
      await walkPath(page, points)
      await page.screenshot({ path: test.info().outputPath(`${name}-path.png`) })
      await walkPath(page, [...points].reverse())
      await expect(page.locator("#game-status")).toHaveAttribute("data-player-on-road", "true")
    })
  }
}
