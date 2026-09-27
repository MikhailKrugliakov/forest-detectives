import { expect, type Page } from "@playwright/test"

export type Waypoint = readonly [number, number]

/** Follow a painted passage using real keyboard movement, never teleporting
 * between waypoints or bypassing collisions. Teleport only to the test start. */
export async function walkWaypoints(page: Page, points: readonly Waypoint[]): Promise<void> {
  const held = new Set<string>()
  try {
    for (const [x, y] of points) {
      await expect.poll(async () => {
        const player = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!)
        const desired = new Set<string>()
        // Permit input/trace latency: a waypoint is a road cross-section,
        // not a pixel-perfect stopping point.
        if (Math.abs(player.x - x) > 24) desired.add(player.x < x ? "d" : "a")
        if (Math.abs(player.y - y) > 24) desired.add(player.y < y ? "s" : "w")
        for (const key of held) if (!desired.has(key)) { await page.keyboard.up(key); held.delete(key) }
        for (const key of desired) if (!held.has(key)) { await page.keyboard.down(key); held.add(key) }
        return Math.hypot(player.x - x, player.y - y)
      }, { timeout: 8000, intervals: [40], message: `Passage must reach (${x}, ${y})` }).toBeLessThan(35)
    }
  } finally {
    for (const key of held) await page.keyboard.up(key)
  }
}

export async function prepareNavigation(page: Page, scene: string, start: Waypoint, enemyIds: readonly string[] = []): Promise<void> {
  await page.goto(`/?scene=${scene}&hero=sheepwolf`)
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", scene)
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__?.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
  await page.evaluate(({ start, enemyIds }) => {
    const game = window.__FOREST_GAME__!
    game.setDifficulty("walk")
    // Separate scenery traversal from intentionally solid enemies.
    for (const id of enemyIds) game.damageEnemy(id, 999)
    game.teleport(start[0], start[1])
  }, { start, enemyIds })
  await expect.poll(() => page.evaluate(() => {
    const player = window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!
    return player.action
  })).not.toBe("defeat")
  await page.waitForTimeout(150)
}
