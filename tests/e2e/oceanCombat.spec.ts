import { expect, test } from "@playwright/test"

test("medusas start neutral, only the touched school retaliates and partial kills persist", async ({ page }) => {
  await page.goto("/?scene=sea")
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", "sea")
  await page.evaluate(() => window.__FOREST_GAME__!.setDifficulty("walk"))
  expect(await page.evaluate(() => Object.values(window.__FOREST_GAME__!.store.state.ocean.schools).every((school) => !school.aggressive))).toBe(true)
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(1020, 570))
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.store.state.ocean.schools["medusa-school-1"]!.aggressive)).toBe(true)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.ocean.schools["medusa-school-2"]!.aggressive)).toBe(false)
  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("medusa-1-1", 999))
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.isMedusaDefeated("medusa-1-1"))).toBe(true)
  await page.evaluate(() => window.__FOREST_GAME__!.saveGame("slot-1"))
  await page.goto("/")
  await page.evaluate(() => window.__FOREST_GAME__!.loadGame("slot-1"))
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", "sea")
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.isMedusaDefeated("medusa-1-1"))).toBe(true)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.ocean.schools["medusa-school-1"]!.aggressive)).toBe(true)
})

test("shark has two phases; all hazards disappear after victory and on retreat", async ({ page }) => {
  await page.goto("/?scene=sea")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-location", "sea")
  await page.evaluate(() => { const game = window.__FOREST_GAME__!; game.setDifficulty("walk"); game.teleport(3890, 800) })
  await expect(status).toHaveAttribute("data-ocean-boss-phase", "1")
  await expect.poll(() => status.getAttribute("data-ocean-boss-attack")).not.toBe("idle")
  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("tiger-shark", 10))
  await expect(status).toHaveAttribute("data-ocean-boss-phase", "2")
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(3200, 800))
  await expect(status).toHaveAttribute("data-ocean-hazards", "0")
  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("tiger-shark", 999))
  await expect(status).toHaveAttribute("data-ocean-boss-phase", "defeated")
  await expect(status).toHaveAttribute("data-ocean-hazards", "0")
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.ocean.sharkCleared)).toBe(true)
})

test("Ichthyosaur telegraphs unique attacks and freezes them while paused", async ({ page }) => {
  test.setTimeout(70_000)
  await page.goto("/?scene=trench")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-location", "trench")
  await page.evaluate(() => { const game = window.__FOREST_GAME__!; game.setDifficulty("walk"); game.teleport(3990, 800) })
  await page.waitForTimeout(200)
  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("ichthyosaur", 9))
  await expect(status).toHaveAttribute("data-ocean-boss-phase", "2")
  await expect(status).toHaveAttribute("data-ocean-boss-attack", "ring-warning", { timeout: 7000 })
  await page.keyboard.press("Escape")
  await page.waitForTimeout(150)
  const pausedTime = await status.getAttribute("data-ocean-boss-attack-time")
  const pausedStage = await status.getAttribute("data-ocean-boss-attack")
  await page.waitForTimeout(1200)
  expect(await status.getAttribute("data-ocean-boss-attack-time")).toBe(pausedTime)
  expect(await status.getAttribute("data-ocean-boss-attack")).toBe(pausedStage)
  await page.keyboard.press("Escape")
  await expect(status).toHaveAttribute("data-ocean-boss-attack", "dive-warning", { timeout: 12000 })
  await page.screenshot({ path: test.info().outputPath("ichthyosaur-diving.png") })
  await expect(status).toHaveAttribute("data-ocean-boss-attack", "whirl-warning", { timeout: 12000 })
  await page.screenshot({ path: test.info().outputPath("ichthyosaur-whirlpool.png") })
  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("ichthyosaur", 7))
  await expect(status).toHaveAttribute("data-ocean-boss-phase", "3")
  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("ichthyosaur", 999))
  await expect(status).toHaveAttribute("data-ocean-hazards", "0")
})

test("real hero melee and thrown vegetables damage new beach robots through normal controls", async ({ page }) => {
  test.setTimeout(45_000)
  const waitForHeroRecovery = async () => {
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find((actor) => actor.name === "player")?.action ?? "loading"))
      .not.toMatch(/^(loading|attack|throw|hurt|defeat)$/)
    // Animation and combat clocks advance in scene frames, not Playwright's wall clock.
    // Let both frame phases finish before sending exactly one next attack input.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  }
  await page.goto("/?scene=beach&hero=sheepwolf")
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", "beach")
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__!
    game.setDifficulty("walk")
    // Isolate two targets, leaving their normal AI and hero hit selection intact.
    for (const actor of game.getActors()) if (actor.name.startsWith("beach-") && !["beach-crab-1", "beach-crab-2"].includes(actor.name)) game.damageEnemy(actor.name, 999)
    game.awardGears("ocean-weapon-test", 20)
    game.purchaseProduce("tomato"); game.purchaseProduce("tomato")
  })
  await page.waitForTimeout(200)
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__!, enemy = game.getActors().find((actor) => actor.name === "beach-crab-1")!
    game.teleport(enemy.x - 95, enemy.y)
  })
  await page.keyboard.press("Space")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.store.state.defeatedEnemies.includes("beach-crab-1"))).toBe(true)
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__!, enemy = game.getActors().find((actor) => actor.name === "beach-crab-2")!
    game.equipWeapon("tomato"); game.teleport(enemy.x - 180, enemy.y)
  })
  for (let shot = 0; shot < 4; shot++) {
    await waitForHeroRecovery()
    await page.keyboard.press("Space")
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.store.state.produceAmmo.tomato)).toBe(3 - shot)
  }
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.store.state.defeatedEnemies.includes("beach-crab-2"))).toBe(true)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.produceAmmo.tomato)).toBe(0)
})


for (const [location, attack] of [["sea", "tail-warning"], ["trench", "dive-warning"]] as const) {
  test(`${location}: lethal ${attack} returns hero to village without recreating hazards`, async ({ page }) => {
    test.setTimeout(40_000)
    const pageErrors: string[] = []
    page.on("pageerror", (error) => pageErrors.push(error.message))
    await page.goto(`/?scene=${location}&hero=sheepwolf`)
    const status = page.locator("#game-status")
    await expect(status).toHaveAttribute("data-screen", location)
    await page.evaluate((scene) => {
      const game = window.__FOREST_GAME__!
      game.setDifficulty("walk")
      game.teleport(scene === "sea" ? 3890 : 3990, 800)
    }, location)
    await expect(status).toHaveAttribute("data-ocean-boss-attack", attack, { timeout: 20000 })
    await page.evaluate(() => {
      const game = window.__FOREST_GAME__!
      game.setDifficulty("hard")
      game.takeDamage(game.store.state.health - 1)
    })
    await expect(status).toHaveAttribute("data-location", "forest-village", { timeout: 5000 })
    await expect(status).toHaveAttribute("data-screen", "chapter-four", { timeout: 5000 })
    await expect(status).toHaveAttribute("data-ocean-hazards", "0")
    expect(await page.evaluate(() => {
      const state = window.__FOREST_GAME__!.store.state
      return state.health === state.maxHealth && state.ocean.hasScuba
    })).toBe(true)
    expect(pageErrors).toEqual([])
  })
}
