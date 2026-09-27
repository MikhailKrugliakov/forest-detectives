import { expect, test } from "@playwright/test"
import { ACTORS, FACINGS } from "../../src/game/animation/catalog"

for (const hero of ["wolf", "fox", "rabbit", "watermelon", "sheepwolf"]) {
  test(`${hero} moves each articulated foot forward and backward in all four directions`, async ({ page }) => {
    test.skip(!ACTORS.get(`hero-${hero}`)?.rigSheet, "A cutout rig must pass visual review before it is enabled")
    test.setTimeout(45_000)
    await page.goto("/?scene=animation-gallery")
    const status = page.locator("#game-status")
    await expect(status).toHaveAttribute("data-screen", "animation-gallery")
    await page.getByLabel("Actor", { exact: true }).selectOption(`hero-${hero}`)
    await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors()[0]?.gait?.active)).toBe(true)
    for (const action of ["walk", "run"] as const) {
      await page.getByLabel("Action", { exact: true }).selectOption(action)
      for (const facing of FACINGS) {
        await page.getByLabel("Facing", { exact: true }).selectOption(facing)
        const samples = await page.evaluate(async () => {
          const samples = []
          const until = performance.now() + 1300
          while (performance.now() < until) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            const actor = window.__FOREST_GAME__!.getActors()[0]!
            samples.push(actor.gait!)
          }
          return samples
        })
        const axis = facing === "left" || facing === "right" ? "x" : "y"
        const differences = samples.map(({ feet }) => feet[0]![axis] - feet[1]![axis])
        expect(Math.max(...differences)).toBeGreaterThan(3)
        expect(Math.min(...differences)).toBeLessThan(-3)
        for (const leg of [0, 1]) {
          const positions = samples.map(({ feet }) => feet[leg]![axis])
          expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(8)
        }
        // Capture the actual articulated character, not just atlas frame IDs.
        if (hero === "sheepwolf" || facing === "right") {
          await page.screenshot({ path: test.info().outputPath(`${hero}-${action}-${facing}.png`) })
        }
      }
    }
    await page.getByRole("button", { name: "Pause / resume" }).click()
    const before = await page.evaluate(() => window.__FOREST_GAME__!.getActors()[0]!.gait)
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => window.__FOREST_GAME__!.getActors()[0]!.gait)).toEqual(before)
  })
}

test("sheepwolf visual contact poses and real-world walking stay joined at the hips", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/?scene=animation-gallery")
  await page.getByLabel("Actor", { exact: true }).selectOption("hero-sheepwolf")
  await page.getByLabel("Action", { exact: true }).selectOption("walk")
  await page.getByLabel("Facing", { exact: true }).selectOption("right")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors()[0]?.gait?.active)).toBe(true)
  for (const [label, phase] of [["left-contact", .02], ["right-contact", .52], ["passing", .77]] as const) {
    const frozen = await page.evaluate(async (target) => {
      const until = performance.now() + 4000
      while (performance.now() < until) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        const gait = window.__FOREST_GAME__!.getActors()[0]?.gait
        if (gait && gait.amount > .99 && Math.abs(gait.phase - target) < .025) {
          const button = [...document.querySelectorAll("button")].find(({ textContent }) => textContent === "Pause / resume")!
          button.click()
          return gait
        }
      }
      return null
    }, phase)
    expect(frozen).not.toBeNull()
    await page.screenshot({ path: test.info().outputPath(`sheepwolf-${label}.png`) })
    await page.getByRole("button", { name: "Pause / resume" }).click()
  }
  await page.goto("/?scene=melon-farm&hero=sheepwolf")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "melon-farm")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(500, 1300))
  await page.keyboard.down("d")
  await expect(page.locator("#game-status")).toHaveAttribute("data-player-animation", "walk")
  await page.waitForTimeout(450)
  await page.screenshot({ path: test.info().outputPath("sheepwolf-world-walk.png") })
  await page.keyboard.up("d")
  // The farm intentionally has no combat inputs; check action hand-off in a combat scene.
  await page.goto("/?scene=wild-forest&hero=sheepwolf")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "wild-forest")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(210, 1390))
  await page.keyboard.down("d")
  await expect(page.locator("#game-status")).toHaveAttribute("data-player-animation", "walk")
  await page.keyboard.press("Space")
  await expect(page.locator("#game-status")).toHaveAttribute("data-player-animation", "attack")
  expect(await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.gait?.active)).toBe(false)
  await page.keyboard.up("d")
})
