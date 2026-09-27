import { expect, test, type Page } from "@playwright/test"
import { prepareNavigation, walkWaypoints } from "./helpers/navigation"
import { VILLAGE_DOORS } from "../../src/domain/villageLayout"

async function playerPoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const player = window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!
    return { x: player.x, y: player.y }
  })
}

test("the first clearing connects the spawn, all three clues and the burrow approach", async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto("/")
  const status = page.locator("#game-status")
  const clickCanvas = async (x: number, y: number) => {
    const bounds = await page.locator("canvas").boundingBox()
    if (!bounds) throw new Error("Game canvas is missing")
    await page.mouse.click(bounds.x + x * bounds.width / 1280, bounds.y + y * bounds.height / 720)
  }
  await expect(status).toHaveAttribute("data-screen", "main-menu")
  await clickCanvas(640, 298)
  await expect(status).toHaveAttribute("data-screen", "character-select")
  await clickCanvas(1140, 400)
  await expect(status).toHaveAttribute("data-screen", "forest")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__?.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
  // Approach the solid stump from the east and the solid burrow from below.
  // Do not interact: the puzzle and its modal are outside this passage test.
  await walkWaypoints(page, [[650, 600], [610, 540], [780, 470], [905, 395], [1080, 330], [1197, 280], [1305, 260]])
  await page.screenshot({ path: test.info().outputPath("clearing-burrow-approach.png") })
  await expect(status).toHaveAttribute("data-screen", "forest")
})

test("mine central and southern painted passages connect without an invisible rock wall", async ({ page }) => {
  test.setTimeout(100_000)
  await prepareNavigation(page, "forest-mine", [220, 1330])
  await walkWaypoints(page, [[500, 1320], [500, 1100], [740, 1100], [740, 820], [740, 540], [880, 500], [1200, 600], [1260, 960], [1260, 1340], [900, 1360], [1400, 1380], [1840, 1380]])
  await page.screenshot({ path: test.info().outputPath("mine-southern-passage.png") })
})

test("restoring Beaver House after launchers leaves the hero able to reach gas room and exit", async ({ page }) => {
  test.setTimeout(60_000)
  await prepareNavigation(page, "beaver-house", [520, 1110])
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__!
    game.completeBeaverRoom("floor")
    game.completeBeaverRoom("launchers")
    game.saveGame("slot-1")
  })
  // The debug load method restores only the store. Load through the menu so
  // the actual scene is recreated at the saved checkpoint as it is in play.
  await page.goto("/")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "main-menu")
  const bounds = await page.locator("canvas").boundingBox()
  if (!bounds) throw new Error("Game canvas is missing")
  await page.mouse.click(bounds.x + 840 * bounds.width / 1280, bounds.y + 407 * bounds.height / 720)
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "beaver-house")
  await expect.poll(() => page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")?.sheetsReady)).toBe(true)
  await expect(page.locator("#game-status")).toHaveAttribute("data-beaver-rooms", "2")
  await expect.poll(async () => Math.hypot((await playerPoint(page)).x - 1640, (await playerPoint(page)).y - 750)).toBeLessThan(5)
  await walkWaypoints(page, [[1660, 500], [1660, 820], [1510, 840], [1510, 1050], [1080, 1090], [520, 1110]])
  await page.screenshot({ path: test.info().outputPath("beaver-restoration-passage.png") })
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", "forest-village")
})

test("village streets connect the forest entrance, main square and western district", async ({ page }) => {
  test.setTimeout(100_000)
  await prepareNavigation(page, "forest-village", [2180, 455])
  // The panorama places Fox east of Mole and Beaver farther east. Follow
  // the lane between the houses, the main square and the completed lower bridge.
  await walkWaypoints(page, [[2120, 455], [2000, 455], [1970, 660], [1900, 680], [1630, 680], [1440, 800], [1440, 980], [1120, 1000], [950, 1000], [500, 1000], [280, 1220], [0, 1220], [-450, 1220], [-700, 1050], [-950, 980], [-1150, 980], [-1250, 900], [-1730, 900], [-1900, 850], [-2180, 810]])
  await page.screenshot({ path: test.info().outputPath("village-western-passage.png") })
})

test("farm footpaths lead from the village gate around the beds to Watermelon's door", async ({ page }) => {
  test.setTimeout(90_000)
  await prepareNavigation(page, "melon-farm", [430, 1375])
  await walkWaypoints(page, [[710, 1180], [580, 870], [730, 620], [1000, 520], [1400, 440], [1860, 590], [2190, 720], [2290, 990], [2290, 1350], [1980, 1340], [1980, 1280]])
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "watermelon-home")
  await walkWaypoints(page, [[640, 470], [420, 330], [860, 330], [860, 550], [640, 690]])
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", "melon-farm")
})

test("Mole's shop gives access to every display and the exit", async ({ page }) => {
  test.setTimeout(45_000)
  await prepareNavigation(page, "mole-shop", [700, 760])
  await walkWaypoints(page, [[540, 555], [540, 330], [860, 330], [860, 555], [1000, 590], [900, 750], [700, 760]])
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-location", "forest-village")
})

for (const home of [
  { id: "wolf-home", ...VILLAGE_DOORS["wolf-home"] },
  { id: "fox-home", ...VILLAGE_DOORS["fox-home"] },
  { id: "rabbit-home", ...VILLAGE_DOORS["rabbit-home"] },
  { id: "sheepwolf-home", ...VILLAGE_DOORS["sheepwolf-home"] },
]) {
  test(`${home.id}: door, entire challenge row and return route remain reachable`, async ({ page }) => {
    test.setTimeout(35_000)
    await prepareNavigation(page, "forest-village", [home.x, home.y])
    await page.keyboard.press("e")
    // The store changes location before the fade and scene restart complete.
    // Wait for the new world, or the first keydown goes to the departing scene.
    await expect(page.locator("#game-status")).toHaveAttribute("data-screen", home.id)
    await walkWaypoints(page, [[640, 470], [420, 330], [860, 330], [860, 550], [640, 690]])
    await page.keyboard.press("e")
    await expect(page.locator("#game-status")).toHaveAttribute("data-location", "forest-village")
  })
}
