import { expect, test } from "@playwright/test"
import { prepareNavigation, walkWaypoints, type Waypoint } from "./helpers/navigation"

const valleyEnemies = Array.from({ length: 18 }, (_, index) => `valley-${index + 1}`)
const cityEnemies = Array.from({ length: 18 }, (_, index) => `city-${index + 1}`)
const palaceEnemies = Array.from({ length: 12 }, (_, index) => `palace-${index + 1}`)

test("painted northern and southern valley branches remain traversable", async ({ page }) => {
  test.setTimeout(60_000)
  await prepareNavigation(page, "snow-valley", [1000, 820], valleyEnemies)
  await walkWaypoints(page, [[900, 710], [800, 580], [720, 440], [600, 320], [520, 230], [600, 320], [720, 440], [800, 580], [900, 710], [1000, 820]])
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(1520, 950))
  await walkWaypoints(page, [[1640, 1110], [1720, 1250], [1770, 1390], [1780, 1490]])
  await page.screenshot({ path: test.info().outputPath("valley-branch.png") })
})

test("painted snow city side streets and stairs are not invisible walls", async ({ page }) => {
  test.setTimeout(60_000)
  await prepareNavigation(page, "snow-city", [1210, 810], cityEnemies)
  await walkWaypoints(page, [[1225, 1050], [1260, 1280], [1300, 1510]])
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(4210, 780))
  await walkWaypoints(page, [[4180, 590], [4110, 420], [4130, 230], [4110, 80]])
  await page.screenshot({ path: test.info().outputPath("city-side-street.png") })
})

test("eastern valley branches can be explored and exited on foot", async ({ page }) => {
  test.setTimeout(60_000)
  await prepareNavigation(page, "snow-valley", [3420, 840], valleyEnemies)
  const north: readonly Waypoint[] = [[3420, 840], [3380, 650], [3250, 440], [3130, 265], [3040, 110]]
  await walkWaypoints(page, north)
  await walkWaypoints(page, [...north].reverse())
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(4060, 930))
  const south: readonly Waypoint[] = [[4060, 930], [4200, 1080], [4320, 1240], [4390, 1390], [4430, 1480]]
  await walkWaypoints(page, south)
  await walkWaypoints(page, [...south].reverse())
})

test("snow city northern stairway and east-west side street connect back to the main road", async ({ page }) => {
  test.setTimeout(60_000)
  await prepareNavigation(page, "snow-city", [1800, 800], cityEnemies)
  const stairs: readonly Waypoint[] = [[1800, 800], [1800, 590], [1795, 420], [1840, 210]]
  await walkWaypoints(page, stairs)
  await walkWaypoints(page, [...stairs].reverse())
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(2930, 760))
  const street: readonly Waypoint[] = [[2930, 760], [2770, 570], [2650, 360], [2610, 180], [2630, 80]]
  await walkWaypoints(page, street)
  await walkWaypoints(page, [...street].reverse())
})

test("palace cross aisles stay open while real furniture still blocks movement", async ({ page }) => {
  test.setTimeout(60_000)
  await prepareNavigation(page, "ice-palace", [600, 730], palaceEnemies)
  await walkWaypoints(page, [[600, 540], [1180, 540], [1200, 370], [1200, 240], [1200, 540], [1200, 800], [1200, 1050], [1200, 1280]])
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(620, 540))
  await page.keyboard.down("w")
  await page.waitForTimeout(900)
  await page.keyboard.up("w")
  const player = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!)
  expect(player.y).toBeGreaterThan(440)
  expect(player.y).toBeLessThan(475)
  await page.screenshot({ path: test.info().outputPath("palace-furniture.png") })
})

test("throne upper floor is walkable and the entrance bridge does not open the chasm", async ({ page }) => {
  test.setTimeout(35_000)
  await prepareNavigation(page, "ice-throne", [300, 330])
  await walkWaypoints(page, [[330, 250], [490, 250], [650, 250]])
  await page.evaluate(() => window.__FOREST_GAME__!.teleport(145, 450))
  await page.keyboard.down("w")
  await page.waitForTimeout(1000)
  await page.keyboard.up("w")
  const player = await page.evaluate(() => window.__FOREST_GAME__!.getActors().find(({ name }) => name === "player")!)
  expect(player.y).toBeGreaterThan(310)
  expect(player.y).toBeLessThan(350)
  await page.screenshot({ path: test.info().outputPath("throne-entrance.png") })
})

test("all eight Krok city sectors connect across their painted road seams", async ({ page }) => {
  test.setTimeout(70_000)
  await prepareNavigation(page, "krok-city", [2250, 800])
  const seams: readonly [Waypoint, Waypoint][] = [
    ...[800, 2400].flatMap((y) => [2400, 4800, 7200].map((x): [Waypoint, Waypoint] => [[x - 150, y], [x + 150, y]])),
    ...[1200, 3600, 6000, 8400].map((x): [Waypoint, Waypoint] => [[x, 1450], [x, 1750]]),
  ]
  for (const [start, end] of seams) {
    await page.evaluate(([x, y]) => window.__FOREST_GAME__!.teleport(x, y), start)
    await walkWaypoints(page, [end])
  }
  await page.screenshot({ path: test.info().outputPath("krok-road-seam.png") })
})
