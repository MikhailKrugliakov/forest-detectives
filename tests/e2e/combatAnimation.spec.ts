import { expect, test, type Page } from "@playwright/test"

async function waitForActorAction(page: Page, name: string, action: string, texture?: string) {
  const handle = await page.waitForFunction(({ actorName, actorAction, expectedTexture }) => {
    const actor = window.__FOREST_GAME__?.getActors().find((candidate) => candidate.name === actorName)
    return actor?.ready && actor.action === actorAction && (!expectedTexture || actor.texture === expectedTexture) ? actor : null
  }, { actorName: name, actorAction: action, expectedTexture: texture }, { polling: "raf", timeout: 15_000 })
  return handle.jsonValue()
}

async function sampleActionFrames(page: Page, name: string, action: string, milliseconds: number) {
  return page.evaluate(async ({ actorName, actorAction, duration }) => {
    const frames = new Set<string>()
    const end = performance.now() + duration
    while (performance.now() < end) {
      const actor = window.__FOREST_GAME__?.getActors().find((candidate) => candidate.name === actorName)
      if (actor?.action === actorAction) frames.add(`${actor.texture}:${actor.frame}`)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    return [...frames]
  }, { actorName: name, actorAction: action, duration: milliseconds })
}

test("a melee impact waits for its animation and stays frozen inside the journal", async ({ page }) => {
  await page.goto("/?scene=wild-forest&hero=wolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(390, 1220))
  await page.waitForTimeout(50)
  const defeats = await page.evaluate(() => window.__FOREST_GAME__!.store.state.wildForestEnemyDefeats)
  // Keep the two inputs in the browser so automation transport cannot consume
  // the entire 120 ms windup before we open the journal.
  await page.evaluate(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", keyCode: 32 }))
    for (let frame = 0; frame < 10; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (window.__FOREST_GAME__?.getActors().some((actor) => actor.name === "player" && actor.action === "attack")) break
    }
    window.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", keyCode: 32 }))
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "i", code: "KeyI", keyCode: 73 }))
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "i", code: "KeyI", keyCode: 73 }))
  })
  await expect(status).toHaveAttribute("data-modal-open", "true")
  const paused = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find((actor) => actor.name === "player")!)
  const health = await page.evaluate(() => window.__FOREST_GAME__!.store.state.health)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.wildForestEnemyDefeats)).toBe(defeats)
  await page.waitForTimeout(600)
  const stillPaused = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find((actor) => actor.name === "player")!)
  expect(stillPaused.action).toBe("attack")
  expect(stillPaused.frame).toBe(paused.frame)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.health)).toBe(health)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.wildForestEnemyDefeats)).toBe(defeats)
  await page.keyboard.press("Escape")
  await expect(status).toHaveAttribute("data-modal-open", "false")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.store.state.wildForestEnemyDefeats)).toBe(defeats + 1)
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.wildForestEnemyDefeats)).toBe(defeats + 1)
})

test("a boss telegraph and its projectiles stop during a modal and resume without a burst", async ({ page }) => {
  await page.goto("/?scene=ice-throne&hero=wolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(700, 450))
  await page.waitForFunction(() => window.__FOREST_GAME__?.getActors().some((actor) => actor.key === "walrus" && actor.action === "cast"), null, { polling: "raf" })
  await page.keyboard.press("i")
  await expect(status).toHaveAttribute("data-modal-open", "true")
  const paused = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find((actor) => actor.key === "walrus")!)
  const health = await page.evaluate(() => window.__FOREST_GAME__!.store.state.health)
  await expect(status).toHaveAttribute("data-active-snow-projectiles", "0")
  await page.waitForTimeout(1800)
  const stillPaused = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find((actor) => actor.key === "walrus")!)
  expect(stillPaused.action).toBe("cast")
  expect(stillPaused.frame).toBe(paused.frame)
  expect(stillPaused.x).toBe(paused.x)
  expect(stillPaused.y).toBe(paused.y)
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.health)).toBe(health)
  await expect(status).toHaveAttribute("data-active-snow-projectiles", "0")
  await page.keyboard.press("Escape")
  await expect(status).toHaveAttribute("data-modal-open", "false")
  await expect.poll(async () => Number(await status.getAttribute("data-active-snow-projectiles")), { intervals: [20, 30, 50] }).toBeGreaterThan(0)
  expect(Number(await status.getAttribute("data-active-snow-projectiles"))).toBeLessThanOrEqual(3)
})

test("both mountain guardians animate their real axe and flame attacks", async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto("/?scene=mountain-hollow&hero=wolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "mountain-hollow")
  await page.evaluate(() => {
    window.__FOREST_GAME__!.setDifficulty("story")
    window.__FOREST_GAME__!.teleport(4120, 720)
  })
  const health = await page.evaluate(() => window.__FOREST_GAME__!.store.state.health)
  const axe = await waitForActorAction(page, "guardian-axe", "attack")
  expect(axe!.texture).toBe("animation:guardian-axe")
  expect((await sampleActionFrames(page, "guardian-axe", "attack", 450)).length).toBeGreaterThan(1)
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.store.state.health)).toBeLessThan(health)

  // On Story the axe guardian has 10 HP; crossing half HP activates the
  // second guardian through the actual existing encounter, not a fake clip.
  await page.evaluate(() => {
    window.__FOREST_GAME__!.damageEnemy("guardian-axe", 5)
    window.__FOREST_GAME__!.teleport(4300, 930)
  })
  await expect(status).toHaveAttribute("data-mountain-phase", "both")
  const flame = await waitForActorAction(page, "guardian-flamethrower", "channel")
  expect(flame!.texture).toBe("animation:guardian-flamethrower")
  expect((await sampleActionFrames(page, "guardian-flamethrower", "channel", 1200)).length).toBeGreaterThan(1)
  const after = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find((actor) => actor.name === "guardian-axe")!)
  expect([after.bodyWidth, after.bodyHeight]).toEqual([axe!.bodyWidth, axe!.bodyHeight])
})

test("Walrus uses distinct icicle, tail and tusk clips across all three phases", async ({ page }) => {
  test.setTimeout(55_000)
  await page.goto("/?scene=ice-throne&hero=wolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  await page.evaluate(() => {
    window.__FOREST_GAME__!.setDifficulty("walk")
    window.__FOREST_GAME__!.teleport(700, 450)
  })
  const special = "animation:walrus:special"
  const cast = await waitForActorAction(page, "walrus-throne", "cast", special)
  expect(Number(cast!.frame)).toBeGreaterThanOrEqual(64)
  expect((await sampleActionFrames(page, "walrus-throne", "cast", 450)).length).toBeGreaterThan(1)
  await expect(status).toHaveAttribute("data-walrus-phase", "1")

  // 78 base HP becomes16 on Walk; preserve the real phase thresholds.
  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("walrus-throne", 6))
  await expect(status).toHaveAttribute("data-walrus-phase", "2")
  const tail = await waitForActorAction(page, "walrus-throne", "tail", special)
  expect(Number(tail!.frame)).toBeLessThan(32)
  expect((await sampleActionFrames(page, "walrus-throne", "tail", 450)).length).toBeGreaterThan(1)
  const tusks = await waitForActorAction(page, "walrus-throne", "tusks", special)
  expect(Number(tusks!.frame)).toBeGreaterThanOrEqual(32)
  expect(Number(tusks!.frame)).toBeLessThan(64)

  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("walrus-throne", 5))
  await expect(status).toHaveAttribute("data-walrus-phase", "3")
  for (const action of ["cast", "tail", "tusks"]) {
    const actor = await waitForActorAction(page, "walrus-throne", action, special)
    expect([actor!.bodyWidth, actor!.bodyHeight]).toEqual([cast!.bodyWidth, cast!.bodyHeight])
  }
  await expect(status).toHaveAttribute("data-screen", "ice-throne")
  expect(await page.evaluate(() => window.__FOREST_GAME__!.store.state.health)).toBeGreaterThan(0)
})

test("the turtle animates volleys, open core, roll, pylon stun and final ring phase", async ({ page }) => {
  test.setTimeout(55_000)
  await page.goto("/?scene=bird-pass&hero=wolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "bird-pass")
  await page.evaluate(() => {
    window.__FOREST_GAME__!.setDifficulty("walk")
    window.__FOREST_GAME__!.teleport(4230, 540)
  })
  const special = "animation:turtle-guardian:special"
  const shooting = await waitForActorAction(page, "turtle-guardian", "shoot")
  expect((await sampleActionFrames(page, "turtle-guardian", "shoot", 450)).length).toBeGreaterThan(1)
  await waitForActorAction(page, "turtle-guardian", "core-open", special)
  await expect(status).toHaveAttribute("data-turtle-phase", "1")

  // The hero stands just beyond the north-west pylon. The real telegraphed
  // roll must reach the pylon and trigger the existing four-second stun.
  await page.evaluate(() => {
    window.__FOREST_GAME__!.damageEnemy("turtle-guardian", 3)
    window.__FOREST_GAME__!.teleport(4230, 540)
  })
  await expect(status).toHaveAttribute("data-turtle-phase", "2")
  await waitForActorAction(page, "turtle-guardian", "charge")
  const rolling = await waitForActorAction(page, "turtle-guardian", "roll", special)
  expect(Number(rolling!.frame)).toBeLessThan(32)
  const stunned = await waitForActorAction(page, "turtle-guardian", "stunned", special)
  expect(Number(stunned!.frame)).toBeGreaterThanOrEqual(64)
  expect([stunned!.bodyWidth, stunned!.bodyHeight]).toEqual([shooting!.bodyWidth, shooting!.bodyHeight])

  await page.evaluate(() => window.__FOREST_GAME__!.damageEnemy("turtle-guardian", 3))
  await expect(status).toHaveAttribute("data-turtle-phase", "3")
  await waitForActorAction(page, "turtle-guardian", "cast")
  expect((await sampleActionFrames(page, "turtle-guardian", "cast", 850)).length).toBeGreaterThan(1)
  await waitForActorAction(page, "turtle-guardian", "core-open", special)
  await expect(status).toHaveAttribute("data-screen", "bird-pass")
})
