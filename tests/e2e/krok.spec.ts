import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { KROK_CITY_SECTORS } from "../../src/domain/krokCityLayout"

const cityObjects: { name: string; type: string; x: number; y: number }[] = JSON.parse(readFileSync("public/assets/maps/krok-city.tmj", "utf8")).layers.find((layer: { name: string }) => layer.name === "world-objects").objects

async function interactWithCityObject(page: Page, id: string): Promise<void> {
  const object = cityObjects.find(({ name }) => name === id)!
  const actor = await page.evaluate((name) => window.__FOREST_GAME__?.getActors().find((item) => item.name === `npc:${name}`), id)
  await interactAt(page, actor?.x ?? object.x, actor?.y ?? object.y)
}

async function interactAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([px, py]) => window.__FOREST_GAME__?.teleport(px, py), [x, y] as [number, number])
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
}

async function clickCanvas(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox()
  if (!box) throw new Error("Canvas is missing")
  await page.mouse.click(box.x + x / 1280 * box.width, box.y + y / 720 * box.height)
}

test("catapult fires warning splash and siege defeats stay cleared after defeat", async ({ page }) => {
  test.setTimeout(60_000)
  const status = page.locator("#game-status")
  await page.goto("/?scene=krok-outskirts&x=1160&y=940")
  await expect(status).toHaveAttribute("data-screen", "krok-outskirts")
  const initialHealth = Number(await status.getAttribute("data-health"))
  await expect.poll(async () => Number(await status.getAttribute("data-health")), { timeout: 12_000 }).toBeLessThan(initialHealth)
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("siege-catapult-1", 99))
  await expect(status).toHaveAttribute("data-krok-siege", "1")
  await page.evaluate(() => window.__FOREST_GAME__?.takeDamage(999))
  await expect(status).toHaveAttribute("data-location", "forest-village")
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.defeatedEnemies.includes("siege-catapult-1"))).toBe(true)
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.enemyRespawnAt["siege-catapult-1"])).toBeUndefined()
})

test("city NPCs, four errands, market products and potion refill", async ({ page }) => {
  test.setTimeout(70_000)
  const status = page.locator("#game-status")
  await page.goto("/?scene=krok-city")
  await expect(status).toHaveAttribute("data-screen", "krok-city")
  await expect(status).toHaveAttribute("data-snow", "true")
  await interactWithCityObject(page, "rivets")
  await expect(status).toHaveAttribute("data-krok-errands", /rivets:active/)
  for (const target of cityObjects.filter(({ type }) => type === "rivets")) await interactWithCityObject(page, target.name)
  await expect(status).toHaveAttribute("data-krok-errands", /rivets:ready:4/)
  await interactWithCityObject(page, "rivets")
  await expect(status).toHaveAttribute("data-krok-errands", /rivets:completed:4/)
  await interactWithCityObject(page, "west-resident")
  await expect(status).toHaveAttribute("data-last-message-kind", "dialogue")

  await page.evaluate(() => window.__FOREST_GAME__?.awardGears("winter-market-budget", 10))
  await interactWithCityObject(page, "market-produce")
  await clickCanvas(page, 470, 535)
  await expect(status).toHaveAttribute("data-premium-ammo", "2,0")
  await clickCanvas(page, 810, 535)
  await expect(status).toHaveAttribute("data-premium-ammo", "2,2")
  await page.keyboard.press("Escape")
  await page.evaluate(() => { window.__FOREST_GAME__?.takeDamage(20); window.__FOREST_GAME__?.useHealingPotion() })
  await expect(status).toHaveAttribute("data-healing-potions", "2")
  await interactWithCityObject(page, "market-potions")
  await clickCanvas(page, 640, 462)
  await expect(status).toHaveAttribute("data-healing-potions", "3")
  await page.keyboard.press("Escape")
  await page.keyboard.press("i")
  await clickCanvas(page, 825, 419)
  await expect(page.locator("canvas")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(status).toHaveAttribute("data-modal-open", "false")
})

test("Princely quest unlocks palace without city errands and gives optional reward after Walrus", async ({ page }) => {
  test.setTimeout(75_000)
  const status = page.locator("#game-status")
  await page.goto("/?scene=krok-city")
  await interactAt(page, 9440, 2400)
  await expect(status).toHaveAttribute("data-screen", "krok-city")
  await interactAt(page, 8850, 2400)
  await expect(status).toHaveAttribute("data-prince-quest", "active")
  await interactAt(page, 9440, 2400)
  await expect(status).toHaveAttribute("data-screen", "ice-palace")
  await interactAt(page, 2250, 800)
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("walrus-throne", 100))
  await expect(status).toHaveAttribute("data-screen", "walrus-complete")
  await expect(status).toHaveAttribute("data-chapter", "4")
  await expect(status).toHaveAttribute("data-prince-quest", "ready")
  await clickCanvas(page, 505, 548)
  await interactAt(page, 140, 450)
  await expect(status).toHaveAttribute("data-screen", "ice-palace")
  await interactAt(page, 150, 800)
  await expect(status).toHaveAttribute("data-screen", "krok-city")
  const gears = Number(await status.getAttribute("data-gears"))
  await interactAt(page, 8850, 2400)
  await expect(status).toHaveAttribute("data-prince-quest", "completed")
  expect(Number(await status.getAttribute("data-gears"))).toBe(gears + 8)
})

test("organic city backgrounds keep all eight sectors connected and buildings solid", async ({ page }) => {
  test.setTimeout(45_000)
  const status = page.locator("#game-status")
  const backgroundResponses = new Map<string, boolean>()
  const detachedBuildingRequests: string[] = []
  page.on("response", (response) => {
    const match = response.url().match(/\/assets\/world\/krok-city-(residential|crafts|market|royal)-organic-v3\.jpg(?:\?|$)/)
    if (match) backgroundResponses.set(match[1]!, response.ok())
    if (/\/assets\/world\/krok-(?:house-\d+\.png|snow-ground\.jpg|road(?:-v2)?\.jpg)(?:\?|$)/.test(response.url())) detachedBuildingRequests.push(response.url())
  })
  await page.goto("/?scene=krok-city")
  await expect(status).toHaveAttribute("data-screen", "krok-city")
  expect([...backgroundResponses.keys()].sort()).toEqual(["crafts", "market", "residential", "royal"])
  expect([...backgroundResponses.values()].every(Boolean)).toBe(true)
  expect(detachedBuildingRequests).toEqual([])
  const photographed = new Set<string>()
  for (let index = 0; index < 8; index += 1) {
    const x = index % 4 * 2400 + 1200
    const y = Math.floor(index / 4) * 1600 + 800
    await page.evaluate(([px, py]) => window.__FOREST_GAME__?.teleport(px, py), [x, y] as [number, number])
    await expect.poll(async () => Number(await status.getAttribute("data-player-x"))).toBeGreaterThan(x - 30)
    await expect.poll(async () => Number(await status.getAttribute("data-player-y"))).toBeGreaterThan(y - 30)
    const theme = KROK_CITY_SECTORS[index]!.background
    if (!photographed.has(theme)) {
      // Review actual game frames for all themes; no pixel-match baseline can
      // establish whether a painted fence accidentally crosses a street.
      await page.waitForTimeout(650)
      await page.screenshot({ path: test.info().outputPath(`krok-organic-${theme}.png`) })
      photographed.add(theme)
    }
  }
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(2250, 800))
  await page.keyboard.down("d")
  await page.waitForTimeout(1300)
  await page.keyboard.up("d")
  expect(Number(await status.getAttribute("data-player-x"))).toBeGreaterThan(2450)
  await expect(status).toHaveAttribute("data-player-on-road", "true")

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(1200, 1600))
  await page.keyboard.down("w")
  await page.waitForTimeout(1300)
  await page.keyboard.up("w")
  expect(Number(await status.getAttribute("data-player-y"))).toBeLessThan(1370)

  const safe = await page.evaluate(() => {
    const player = window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!
    return { x: player.x, y: player.y }
  })
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(600, 500))
  await page.waitForTimeout(180)
  // Teleporting deep inside a solid house is rejected in favour of lastSafe,
  // not reinterpreted as a valid new starting point beside another road.
  expect(Number(await status.getAttribute("data-player-x"))).toBeCloseTo(safe.x, -1)
  expect(Number(await status.getAttribute("data-player-y"))).toBeCloseTo(safe.y, -1)
  await expect(status).toHaveAttribute("data-player-on-road", "true")
})
