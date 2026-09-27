import { expect, test, type Page } from "@playwright/test"
async function click(page: Page, x: number, y: number) {
  const box = await page.locator("canvas").boundingBox(); if (!box) throw new Error("No canvas")
  await page.mouse.click(box.x + x / 1280 * box.width, box.y + y / 720 * box.height)
}
async function interact(page: Page, x: number, y: number) {
  await page.evaluate(([x, y]) => window.__FOREST_GAME__!.teleport(x!, y!), [x, y])
  await page.waitForTimeout(150); await page.keyboard.press("e")
}
async function text(page: Page) { return page.evaluate(() => window.__FOREST_GAME__!.getSceneTexts().join("\n")) }
async function gears(page: Page) { return page.evaluate(() => window.__FOREST_GAME__!.store.state.gears) }
async function chapterFour(page: Page) {
  await page.evaluate(() => { const g = window.__FOREST_GAME__!; g.defeatEnemy("walrus-throne"); g.awardGears("shop-budget", 100) })
}

test("Mole stand and purchase agree on the ocean chapter price", async ({ page }) => {
  await page.goto("/?scene=forest-village")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest-village")
  await chapterFour(page)
  await interact(page, 1710, 730)
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "mole-shop")
  await expect.poll(() => text(page)).toContain("⚙️ 27")
  await interact(page, 540, 330)
  await expect.poll(() => text(page)).toContain("Цена: ⚙️ 27")
  const before = await gears(page); await click(page, 745, 480)
  await expect.poll(() => gears(page)).toBe(before - 27)
})

test("Beaver materials and farm packs display the same rounded price they deduct", async ({ page }) => {
  await page.goto("/?scene=forest-village")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest-village")
  await chapterFour(page)
  await interact(page, 620, 1200)
  await expect.poll(() => text(page)).toContain("Цена: ⚙️ 12")
  let before = await gears(page); await click(page, 470, 545)
  await expect.poll(() => gears(page)).toBe(before - 12)
  await page.keyboard.press("Escape")
  await interact(page, 1440, 1500)
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "melon-farm")
  await interact(page, 650, 590)
  await expect.poll(() => text(page)).toContain("2 овоща за ⚙️ 3")
  before = await gears(page); await click(page, 470, 540)
  await expect.poll(() => gears(page)).toBe(before - 3)
})

test("Krok market and pharmacy apply ocean prices to packs and each missing charge", async ({ page }) => {
  await page.goto("/?scene=krok-city")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "krok-city")
  await chapterFour(page)
  const merchant = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(actor => actor.name === "npc:market-produce")!)
  await interact(page, merchant.x, merchant.y)
  await expect.poll(() => text(page)).toContain("2 шт. за ⚙️ 7")
  const before = await gears(page); await click(page, 470, 535); await click(page, 810, 535)
  await expect.poll(() => gears(page)).toBe(before - 16)
  await page.keyboard.press("Escape")
  await page.evaluate(() => { const g = window.__FOREST_GAME__!; g.takeDamage(60); g.useHealingPotion(); g.useHealingPotion() })
  const pharmacist = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(actor => actor.name === "npc:market-potions")!)
  await interact(page, pharmacist.x, pharmacist.y)
  await expect.poll(() => text(page)).toContain("за ⚙️ 10")
  const beforeRefill = await gears(page); await click(page, 640, 462)
  await expect.poll(() => gears(page)).toBe(beforeRefill - 10)
  await expect(page.locator("#game-status")).toHaveAttribute("data-healing-potions", "3")
})
