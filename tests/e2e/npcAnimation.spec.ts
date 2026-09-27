import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"

const cityObjects: { name: string; type: string; x: number; y: number }[] = JSON.parse(readFileSync("public/assets/maps/krok-city.tmj", "utf8")).layers.find((layer: { name: string }) => layer.name === "world-objects").objects

async function actor(page: Page, name: string) {
  return page.evaluate((actorName) => window.__FOREST_GAME__?.getActors().find((item) => item.name === actorName), `npc:${name}`)
}

test("walking farm resident keeps label, interaction and physical footprint together", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/?scene=melon-farm&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "melon-farm")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(850, 1110))
  await expect.poll(async () => (await actor(page, "melon-mitya"))?.ready, { timeout: 20_000 }).toBe(true)
  const before = (await actor(page, "melon-mitya"))!
  await expect.poll(async () => {
    const current = (await actor(page, "melon-mitya"))!
    return Math.hypot(current.x - before.x, current.y - before.y)
  }, { timeout: 10_000 }).toBeGreaterThan(16)
  const walking = (await actor(page, "melon-mitya"))!
  expect(walking.action).toBe("walk")
  expect(walking.bodyWidth).toBe(before.bodyWidth)
  expect(walking.bodyHeight).toBe(before.bodyHeight)
  expect(walking.labelX).toBeCloseTo(walking.x)
  expect(walking.labelY! - walking.y).toBeCloseTo(before.labelY! - before.y)
  expect(walking.targetX).toBeCloseTo(walking.x)
  expect(walking.targetY).toBeCloseTo(walking.y)

  await page.evaluate(({ x, y }) => window.__FOREST_GAME__?.teleport(x - 90, y), walking)
  await page.waitForTimeout(200)
  const stopped = (await actor(page, "melon-mitya"))!
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-last-message-kind", "dialogue")
  await expect.poll(async () => (await actor(page, "melon-mitya"))?.action).toBe("talk")
  await page.waitForTimeout(500)
  expect((await actor(page, "melon-mitya"))!.x).toBeCloseTo(stopped.x)
  expect((await actor(page, "melon-mitya"))!.y).toBeCloseTo(stopped.y)

  await page.keyboard.down("d")
  await page.waitForTimeout(700)
  await page.keyboard.up("d")
  expect(Number(await status.getAttribute("data-player-x"))).toBeLessThan(stopped.x - 10)
  const after = (await actor(page, "melon-mitya"))!
  expect(after.bodyWidth).toBe(before.bodyWidth)
  expect(after.bodyHeight).toBe(before.bodyHeight)
})

test("Krok inhabitants animate without moving merchants, quest givers or royal guards", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/?scene=krok-city")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "krok-city")
  const before = await page.evaluate(() => window.__FOREST_GAME__!.getActors().filter(({ name }) => name.startsWith("npc:")))
  expect(before).toHaveLength(cityObjects.filter(({ type }) => ["resident", "quest", "merchant", "guard", "prince"].includes(type)).length)
  const residentHome = cityObjects.find(({ name }) => name === "north-resident")!
  // Observe from the lower street, outside the conversation stop radius.
  await page.evaluate(({ x, y }) => window.__FOREST_GAME__?.teleport(x + 300, y + 60), residentHome)
  await expect.poll(async () => (await actor(page, "north-resident"))?.ready, { timeout: 20_000 }).toBe(true)
  const start = (await actor(page, "north-resident"))!
  await expect.poll(async () => {
    const current = (await actor(page, "north-resident"))!
    return Math.hypot(current.x - start.x, current.y - start.y)
  }, { timeout: 10_000 }).toBeGreaterThan(12)
  const after = await page.evaluate(() => window.__FOREST_GAME__!.getActors())
  for (const item of before.filter(({ name }) => !name.endsWith("resident"))) {
    const current = after.find(({ name }) => name === item.name)!
    expect(current.x).toBe(item.x)
    expect(current.y).toBe(item.y)
    expect(current.bodyWidth).toBe(item.bodyWidth)
    expect(current.bodyHeight).toBe(item.bodyHeight)
  }
})
