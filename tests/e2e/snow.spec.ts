import { expect, test, type Page } from "@playwright/test"

async function interactAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([targetX, targetY]) => window.__FOREST_GAME__?.teleport(targetX, targetY), [x, y] as [number, number])
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
}

async function clickCanvas(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox()
  if (!box) throw new Error("Canvas is missing")
  await page.mouse.click(box.x + x / 1280 * box.width, box.y + y / 720 * box.height)
}

test("chapter three routes through the Krok siege and city before the palace", async ({ page }) => {
  test.setTimeout(100_000)
  const status = page.locator("#game-status")
  await page.goto("/?scene=snow-valley")
  await expect(status).toHaveAttribute("data-screen", "snow-valley")
  await expect(status).toHaveAttribute("data-snow", "true")

  await interactAt(page, 4650, 800)
  await expect(status).toHaveAttribute("data-screen", "snow-city")
  await expect(status).toHaveAttribute("data-entry-from", "snow-valley")
  expect(Number(await status.getAttribute("data-player-x"))).toBeLessThan(300)

  await interactAt(page, 4650, 800)
  await expect(status).toHaveAttribute("data-screen", "krok-outskirts")
  expect(Number(await status.getAttribute("data-player-x"))).toBeLessThan(300)

  await interactAt(page, 4650, 800)
  await expect(status).toHaveAttribute("data-screen", "krok-outskirts")
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__!
    for (const prefix of ["siege-snowman", "siege-golem", "siege-catapult"]) {
      const count = prefix === "siege-snowman" ? 6 : prefix === "siege-golem" ? 4 : 3
      for (let index = 1; index <= count; index += 1) game.defeatEnemy(`${prefix}-${index}`)
    }
  })
  await expect(status).toHaveAttribute("data-krok-gate-open", "true")
  await interactAt(page, 4650, 800)
  await expect(status).toHaveAttribute("data-screen", "krok-city")
  expect(Number(await status.getAttribute("data-player-x"))).toBeLessThan(400)

  await interactAt(page, 9440, 2400)
  await expect(status).toHaveAttribute("data-screen", "krok-city")
  await interactAt(page, 8850, 2400)
  await expect(status).toHaveAttribute("data-prince-quest", "active")
  await interactAt(page, 9440, 2400)
  await expect(status).toHaveAttribute("data-screen", "ice-palace")
  expect(Number(await status.getAttribute("data-player-x"))).toBeLessThan(300)

  await interactAt(page, 2250, 800)
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  await expect(status).toHaveAttribute("data-snow", "false")

  await interactAt(page, 140, 450)
  await expect(status).toHaveAttribute("data-screen", "ice-palace")
  expect(Number(await status.getAttribute("data-player-x"))).toBeGreaterThan(2100)

  await interactAt(page, 150, 800)
  await expect(status).toHaveAttribute("data-screen", "krok-city")
  expect(Number(await status.getAttribute("data-player-x"))).toBeGreaterThan(9200)

  await interactAt(page, 160, 800)
  await expect(status).toHaveAttribute("data-screen", "krok-outskirts")
  expect(Number(await status.getAttribute("data-player-x"))).toBeGreaterThan(4500)

  await interactAt(page, 150, 800)
  await expect(status).toHaveAttribute("data-screen", "snow-city")
  expect(Number(await status.getAttribute("data-player-x"))).toBeGreaterThan(4500)

  await interactAt(page, 150, 800)
  await expect(status).toHaveAttribute("data-screen", "snow-valley")
  await interactAt(page, 150, 800)
  await expect(status).toHaveAttribute("data-screen", "chapter-three")
  await expect(status).toHaveAttribute("data-entry-from", "snow-valley")
  expect(Number(await status.getAttribute("data-player-x"))).toBeLessThan(-2000)

  await interactAt(page, -2250, 810)
  await expect(status).toHaveAttribute("data-screen", "snow-valley")
})

test("snow roads, palace furniture and snow enemies obey collision and loot rules", async ({ page }) => {
  test.setTimeout(45_000)
  const status = page.locator("#game-status")
  await page.goto("/?scene=snow-valley&hero=sheepwolf")
  await expect(status).toHaveAttribute("data-screen", "snow-valley")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(1200, 100))
  // Teleport updates coordinates immediately; the road constraint runs on the
  // next world update. Do not read a stale "on road" flag from the spawn frame.
  await expect.poll(async () => Number(await status.getAttribute("data-player-y"))).toBeGreaterThan(500)
  await expect(status).toHaveAttribute("data-player-on-road", "true")

  await page.evaluate(() => {
    window.__FOREST_GAME__?.damageEnemy("valley-1", 99)
    window.__FOREST_GAME__?.damageEnemy("valley-13", 99)
  })
  await expect(status).toHaveAttribute("data-snow-valley-enemies", "2")
  await expect(status).toHaveAttribute("data-enemy-gear-drops", "1")

  await page.goto("/?scene=ice-palace")
  await expect(status).toHaveAttribute("data-screen", "ice-palace")
  // The former collider at (500, 490) covered empty floor. Walk toward the
  // actual northern furniture, whose southern edge is y470.
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(620, 540))
  await page.keyboard.down("w")
  try {
    await expect.poll(async () => Number(await status.getAttribute("data-player-y"))).toBeLessThan(475)
    await page.waitForTimeout(200)
    expect(Number(await status.getAttribute("data-player-y"))).toBeGreaterThan(440)
  } finally { await page.keyboard.up("w") }
})

test("Walrus attacks on approach, changes phases, and the stay choice starts chapter four", async ({ page }) => {
  test.setTimeout(45_000)
  const status = page.locator("#game-status")
  await page.goto("/?scene=ice-throne&hero=wolf")
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  await expect(status).toHaveAttribute("data-walrus-aggro", "false")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(700, 450))
  await expect(status).toHaveAttribute("data-walrus-aggro", "true")
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("walrus-throne", 27))
  await expect(status).toHaveAttribute("data-walrus-phase", "2")
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("walrus-throne", 26))
  await expect(status).toHaveAttribute("data-walrus-phase", "3")
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("walrus-throne", 25))
  await expect(status).toHaveAttribute("data-screen", "walrus-complete")
  await expect(status).toHaveAttribute("data-chapter", "4")
  await expect(status).toHaveAttribute("data-snow", "false")
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.inventory.filter(({ id }) => id === "ice-palace-badge").length)).toBe(1)

  await clickCanvas(page, 505, 548)
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  await expect(status).toHaveAttribute("data-walrus-cleared", "true")
})

test("the village choice preserves the Walrus victory across a save and reload", async ({ page }) => {
  test.setTimeout(45_000)
  const status = page.locator("#game-status")
  await page.goto("/?scene=ice-throne")
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("walrus-throne", 100))
  await expect(status).toHaveAttribute("data-screen", "walrus-complete")
  await clickCanvas(page, 800, 548)
  await expect(status).toHaveAttribute("data-screen", "chapter-four")
  await expect(status).toHaveAttribute("data-snow", "false")
  expect(await page.evaluate(() => window.__FOREST_GAME__?.saveGame("slot-1"))).toBe(true)

  await page.goto("/")
  await expect(status).toHaveAttribute("data-screen", "main-menu")
  expect(await page.evaluate(() => window.__FOREST_GAME__?.loadGame("slot-1"))).toBe(true)
  await expect(status).toHaveAttribute("data-chapter", "4")
  await expect(status).toHaveAttribute("data-walrus-cleared", "true")
  await expect(status).toHaveAttribute("data-snow", "false")
})
