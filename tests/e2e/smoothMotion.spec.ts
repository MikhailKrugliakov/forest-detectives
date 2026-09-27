import { expect, test } from "@playwright/test"

for (const hero of ["wolf", "fox", "rabbit", "watermelon", "sheepwolf"]) {
  test(`${hero} keeps a single sharp walking clip between physics steps`, async ({ page }) => {
    await page.goto(`/?scene=melon-farm&hero=${hero}`)
    const status = page.locator("#game-status")
    await expect(status).toHaveAttribute("data-screen", "melon-farm")
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
    // 30 Hz physics on the real browser display reproduces the same skipped
    // simulation frames as 60 Hz physics on a 120/144 Hz display.
    await page.evaluate(() => {
      window.__FOREST_GAME__!.teleport(500, 1300)
      window.__FOREST_GAME__!.setPhysicsStepRate(30)
    })
    await page.keyboard.down("d")
    await expect(status).toHaveAttribute("data-player-animation", "walk")
    const samples = await page.evaluate(async () => {
      const snapshots = []
      for (let i = 0; i < 55; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        const actor = window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!
        snapshots.push({ ...actor })
      }
      return snapshots
    })
    await page.screenshot({ path: test.info().outputPath(`${hero}-walking.png`) })
    await page.keyboard.up("d")
    expect(new Set(samples.map(({ action }) => action))).toEqual(new Set(["walk"]))
    expect(new Set(samples.map(({ texture }) => texture))).toEqual(new Set([`animation:hero-${hero}`]))
    expect(new Set(samples.map(({ facing }) => facing))).toEqual(new Set(["right"]))
    expect(new Set(samples.map(({ frame }) => frame)).size).toBeGreaterThanOrEqual(5)
    // Even when physics has no new position, the displayed actor advances
    // between the last two collision-resolved positions (never beyond them).
    const renderOnly = samples.slice(1).filter((sample, i) => sample.x === samples[i]!.x)
    expect(renderOnly.length).toBeGreaterThan(0)
    expect(samples.slice(1).some((sample, i) => sample.x === samples[i]!.x && sample.visualX > samples[i]!.visualX)).toBe(true)
    for (const sample of samples) expect(sample.visualX).toBeLessThanOrEqual(sample.x + 0.01)
    await expect(status).toHaveAttribute("data-player-animation", "idle")
    await page.screenshot({ path: test.info().outputPath(`${hero}-idle.png`) })
    await page.evaluate(() => window.__FOREST_GAME__!.setPhysicsStepRate(60))
  })
}

test("moving attacks do not flash the stationary atlas on render-only frames", async ({ page }) => {
  await page.goto("/?scene=wild-forest&hero=sheepwolf")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "wild-forest")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__!
    game.setDifficulty("walk")
    game.teleport(210, 1390)
    game.setPhysicsStepRate(30)
  })
  await page.keyboard.down("d")
  await expect(page.locator("#game-status")).toHaveAttribute("data-player-animation", "walk")
  await page.keyboard.press("Space")
  const attacks = await page.evaluate(async () => {
    const textures = []
    for (let i = 0; i < 20; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const actor = window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!
      if (actor.action === "attack") textures.push(actor.texture)
    }
    return textures
  })
  await page.keyboard.up("d")
  expect(attacks.length).toBeGreaterThan(2)
  expect(new Set(attacks)).toEqual(new Set(["animation:hero-sheepwolf:motion"]))
})
