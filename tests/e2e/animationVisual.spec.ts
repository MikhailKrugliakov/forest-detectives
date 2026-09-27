import { expect, test } from "@playwright/test"

test("animation gallery exposes readable role-specific poses at 1280×720", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/?scene=animation-gallery")
  const status = page.locator("#game-status")
  const examples = [
    ["hero-sheepwolf", "walk", "left", ""],
    ["hero-wolf", "attack", "right", ""],
    ["hero-fox", "mine", "left", ":actions"],
    ["hero-rabbit", "heal", "down", ":utility"],
    ["hero-watermelon", "run", "right", ":motion"],
    ["robot-hare", "walk", "left", ""],
    ["robot-sparrow", "walk", "down", ""],
    ["krok-resident", "talk", "left", ""],
    ["ice-catapult", "shoot", "right", ""],
    ["turtle-guardian", "core-open", "down", ":special"],
    ["walrus", "tail", "left", ":special"],
  ] as const
  for (const [actor, action, facing, suffix] of examples) {
    await page.getByLabel("Actor", { exact: true }).selectOption(actor)
    await page.getByLabel("Action", { exact: true }).selectOption(action)
    await page.getByLabel("Facing", { exact: true }).selectOption(facing)
    await expect(status).toHaveAttribute("data-animation-ready", "true")
    await expect(status).toHaveAttribute("data-animation-texture", `animation:${actor}${suffix}`)
    if (actor.startsWith("hero-") && (action === "walk" || action === "run")) {
      // The diagnostic frame above belongs to the legacy backing sprite.
      // Review the visible articulated body only after all parts have loaded.
      await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors()[0]?.gait?.active)).toBe(true)
    }
    await page.waitForTimeout(180)
    await page.screenshot({ path: test.info().outputPath(`${actor}-${action}.png`) })
  }
})

test("world animation visual review scenes", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  const views = [
    ["melon-farm", 1150, 1020],
    ["krok-city", 1770, 720],
    ["wild-forest", 390, 1220],
    ["bird-pass", 4330, 820],
    ["ice-throne", 700, 450],
  ] as const
  for (const [scene, x, y] of views) {
    await page.goto(`/?scene=${scene}&hero=sheepwolf`)
    await expect(page.locator("#game-status")).toHaveAttribute("data-screen", scene)
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().every(({ sheetsReady }) => sheetsReady))).toBe(true)
    await page.evaluate(([targetX, targetY]) => window.__FOREST_GAME__!.teleport(targetX!, targetY!), [x, y])
    await page.waitForTimeout(550)
    await page.screenshot({ path: test.info().outputPath(`${scene}.png`) })
  }
})
