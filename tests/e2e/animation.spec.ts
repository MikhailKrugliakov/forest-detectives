import { expect, test } from "@playwright/test"
import { ACTOR_CATALOG, FACINGS } from "../../src/game/animation/catalog"

test("all41 animated actors load in the gallery with four drawn walking directions", async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto("/?scene=animation-gallery")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "animation-gallery")
  for (const definition of ACTOR_CATALOG) {
    await page.getByLabel("Actor", { exact: true }).selectOption(definition.key)
    await expect(status).toHaveAttribute("data-animation-actor", definition.key)
    await expect(status).toHaveAttribute("data-animation-ready", "true", { timeout: 15_000 })
    for (const [row, facing] of FACINGS.entries()) {
      await page.getByLabel("Facing", { exact: true }).selectOption(facing)
      await expect(status).toHaveAttribute("data-animation-facing", facing)
      await expect.poll(async () => {
        const frame = Number(await status.getAttribute("data-animation-frame"))
        return frame >= row * 8 && frame < row * 8 + 8
      }).toBe(true)
    }
    const actors = await page.evaluate(() => window.__FOREST_GAME__!.getActors())
    expect(actors).toHaveLength(1)
    expect(actors[0]!.ready).toBe(true)
    if (definition.family === "hero") {
      for (const [action, sheet] of [["heal", "utility"], ["mine", "actions"], ["throw", "actions"], ["run", "motion"]]) {
        await page.getByLabel("Action", { exact: true }).selectOption(action!)
        await expect(status).toHaveAttribute("data-animation-texture", `animation:${definition.key}:${sheet}`)
      }
      await page.getByLabel("Moving action").check()
      await page.getByLabel("Action", { exact: true }).selectOption("attack")
      await expect(status).toHaveAttribute("data-animation-texture", `animation:${definition.key}:motion`)
      await page.getByLabel("Moving action").uncheck()
      await page.getByLabel("Action", { exact: true }).selectOption("walk")
    }
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getAnimationStats().textures.length)).toBeLessThanOrEqual(5)
  }
})

test("real weapon, gadget and healing inputs select the matching hero clips", async ({ page }) => {
  await page.goto("/?scene=wild-forest&hero=wolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__!
    game.teleport(210, 1390)
    game.damageEnemy("hare-1", 1000)
    game.awardGears("animation-input-test", 30)
    game.purchaseProduce("tomato")
    game.equipWeapon("tomato")
    game.purchaseGadget("pulse-shield")
    game.takeDamage(50)
  })
  await page.keyboard.press("Space")
  await expect(status).toHaveAttribute("data-player-animation", "throw")
  await expect(status).toHaveAttribute("data-tomatoes", "1")
  await expect(status).toHaveAttribute("data-player-animation", "idle")
  await page.keyboard.press("q")
  await expect(status).toHaveAttribute("data-player-animation", "gadget")
  await expect(status).toHaveAttribute("data-player-animation", "idle")
  await page.keyboard.press("t")
  await expect(status).toHaveAttribute("data-player-animation", "heal")
  await expect(status).toHaveAttribute("data-healing-potions", "2")
  await expect(status).toHaveAttribute("data-player-animation", "idle")
  await page.evaluate(() => window.__FOREST_GAME__!.equipWeapon("melee"))
  await page.keyboard.down("d")
  await expect(status).toHaveAttribute("data-player-animation", "walk")
  await page.keyboard.press("Space")
  await expect(status).toHaveAttribute("data-player-animation", "attack")
  expect(await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.texture)).toBe("animation:hero-wolf:motion")
  await page.keyboard.up("d")
})

for (const hero of ["wolf", "fox", "rabbit", "watermelon", "sheepwolf"]) {
  test(`${hero} walks and runs with an unchanged physical footprint and remembers facing`, async ({ page }) => {
    await page.goto(`/?scene=melon-farm&hero=${hero}`)
    const status = page.locator("#game-status")
    await expect(status).toHaveAttribute("data-screen", "melon-farm")
    await page.evaluate(() => window.__FOREST_GAME__!.teleport(500, 1300))
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.ready)).toBe(true)
    const before = (await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")))!
    await page.keyboard.down("d")
    await expect(status).toHaveAttribute("data-player-animation", "walk")
    await expect(status).toHaveAttribute("data-player-facing", "right")
    const frame = await status.getAttribute("data-player-frame")
    await expect.poll(() => status.getAttribute("data-player-frame")).not.toBe(frame)
    await page.keyboard.down("Shift")
    await expect(status).toHaveAttribute("data-player-animation", "run")
    await page.keyboard.up("Shift")
    await page.keyboard.up("d")
    await expect(status).toHaveAttribute("data-player-animation", "idle")
    await expect(status).toHaveAttribute("data-player-facing", "right")
    const after = (await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")))!
    expect(after.x).toBeGreaterThan(before.x)
    expect(after.bodyWidth).toBe(before.bodyWidth)
    expect(after.bodyHeight).toBe(before.bodyHeight)

    // At the world boundary, held movement cannot produce treadmill walking.
    await page.evaluate(() => window.__FOREST_GAME__!.teleport(28, 1300))
    await page.keyboard.down("a")
    await page.waitForTimeout(400)
    await expect(status).toHaveAttribute("data-player-animation", "idle")
    await page.keyboard.up("a")
  })
}

test("reentering locations does not accumulate actors, textures or modal listeners", async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto("/?scene=melon-farm&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "melon-farm")
  const initial = await page.evaluate(() => window.__FOREST_GAME__!.getAnimationStats())
  for (let visit = 0; visit < 10; visit++) {
    await page.evaluate(() => window.__FOREST_GAME__!.teleport(430, 1375))
    await page.keyboard.press("e")
    await expect(status).toHaveAttribute("data-screen", "forest-village")
    // Entry is just outside the interaction radius; step up to the farm gate.
    await page.evaluate(() => window.__FOREST_GAME__!.teleport(1440, 1440))
    await page.keyboard.press("e")
    await expect(status).toHaveAttribute("data-screen", "melon-farm")
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getAnimationStats().actors)).toBe(initial.actors)
    const current = await page.evaluate(() => window.__FOREST_GAME__!.getAnimationStats())
    expect(current.modalListeners).toBe(initial.modalListeners)
    expect(current.loaderListeners).toBeLessThanOrEqual(initial.loaderListeners)
    expect(current.displayObjects).toBeLessThanOrEqual(initial.displayObjects + 8)
    expect(current.textures.length).toBeLessThanOrEqual(initial.actors + 6)
  }
})

test("a populated combat scene stays responsive after its atlases have loaded", async ({ page }) => {
  await page.goto("/?scene=snow-city&hero=sheepwolf")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "snow-city")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().every(({ ready }) => ready))).toBe(true)
  await page.evaluate(() => {
    window.__FOREST_GAME__!.setDifficulty("walk")
    window.__FOREST_GAME__!.teleport(1200, 800)
  })
  await page.waitForTimeout(2500)
  const samples: number[] = []
  for (let index = 0; index < 5; index++) {
    await page.keyboard.down(index % 2 ? "a" : "d")
    await page.waitForTimeout(450)
    samples.push(await page.evaluate(() => window.__FOREST_GAME__!.getAnimationStats().fps))
    await page.keyboard.up(index % 2 ? "a" : "d")
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
  test.info().annotations.push({ type: "animation-fps", description: average.toFixed(1) })
  expect(average).toBeGreaterThan(15)
  await page.keyboard.press("Escape")
  await expect(page.locator("#game-status")).toHaveAttribute("data-modal-open", "true")
  await page.keyboard.press("Escape")
  await expect(page.locator("#game-status")).toHaveAttribute("data-modal-open", "false")
})
