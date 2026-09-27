import { expect, test } from "@playwright/test"
import { MOUNTAIN_ENEMIES } from "../../src/domain/mountain"
import { BIRD_PASS_ENEMIES } from "../../src/domain/birdPass"
import { prepareNavigation, walkWaypoints, type Waypoint } from "./helpers/navigation"

const passages: { scene: string; name: string; points: readonly Waypoint[] }[] = [
  { scene: "mountain-hollow", name: "western entrance", points: [[140, 800], [150, 940], [330, 820], [530, 750]] },
  { scene: "mountain-hollow", name: "northwestern trail", points: [[1285, 839], [1319, 596], [1385, 452], [1307, 382], [1175, 331], [1097, 221], [1141, 110]] },
  { scene: "mountain-hollow", name: "southwestern trail", points: [[1285, 949], [1285, 1126], [1250, 1247], [1124, 1346], [1093, 1468]] },
  { scene: "mountain-hollow", name: "northeastern fork", points: [[3629, 947], [3596, 772], [3660, 636], [3713, 536], [3850, 486], [3894, 380], [3948, 311]] },
  { scene: "mountain-hollow", name: "southeastern trail", points: [[3629, 947], [3615, 1081], [3613, 1207], [3697, 1331], [3697, 1496]] },
  { scene: "bird-pass", name: "western main road", points: [[367, 898], [639, 888], [922, 944], [1188, 1019], [1434, 983]] },
  { scene: "bird-pass", name: "northern side trail", points: [[922, 944], [872, 828], [750, 675], [664, 563], [648, 444], [581, 355], [533, 281]] },
  { scene: "bird-pass", name: "southern fork", points: [[1434, 983], [1550, 1066], [1663, 1159], [1781, 1263], [1859, 1353], [1906, 1461]] },
  { scene: "bird-pass", name: "eastern main road", points: [[2463, 741], [2592, 816], [2670, 939], [2792, 998], [2973, 1016], [3127, 964], [3305, 886]] },
  { scene: "bird-pass", name: "arena approach", points: [[3631, 802], [3791, 656], [3844, 569], [4080, 455], [4275, 445]] },
]

for (const { scene, name, points } of passages) {
  test(`${scene}: ${name} is walkable in both directions`, async ({ page }) => {
    test.setTimeout(60_000)
    const enemies = scene === "mountain-hollow" ? MOUNTAIN_ENEMIES : BIRD_PASS_ENEMIES
    // Leave bosses alive: killing them opens an unrelated victory modal.
    await prepareNavigation(page, scene, points[0]!, enemies.filter(({ rank }) => rank !== "boss").map(({ id }) => id))
    await walkWaypoints(page, points)
    await page.screenshot({ path: test.info().outputPath("passage.png") })
    await walkWaypoints(page, [...points].reverse())
    await expect(page.locator("#game-status")).toHaveAttribute("data-player-on-road", "true")
  })
}
