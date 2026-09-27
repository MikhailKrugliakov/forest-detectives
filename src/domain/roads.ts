export interface RoadPoint {
  x: number
  y: number
}

export interface RoadSegment {
  from: RoadPoint
  to: RoadPoint
  halfWidth: number
}

export interface RoadZone extends RoadPoint {
  radius: number
}

export interface RoadNetwork {
  segments: readonly RoadSegment[]
  zones: readonly RoadZone[]
}

export interface RoadProjection {
  x: number
  y: number
  distance: number
  halfWidth: number
}

export interface RoadCollisionRect {
  x: number
  y: number
  width: number
  height: number
}

function route(points: readonly RoadPoint[], halfWidth: number): RoadSegment[] {
  return points.slice(1).map((to, index) => ({ from: points[index]!, to, halfWidth }))
}

// World-space survey points traced from the backgrounds, including side paths.
function paintedPath(points: readonly (readonly [number, number])[], halfWidth: number): RoadSegment[] {
  return route(points.map(([x, y]) => ({ x, y })), halfWidth)
}

export const WILD_FOREST_ROADS: RoadNetwork = {
  segments: [
    ...route([{ x: 210, y: 1390 }, { x: 440, y: 1390 }, { x: 470, y: 1210 }, { x: 700, y: 1110 }, { x: 920, y: 990 }, { x: 1160, y: 850 }, { x: 1450, y: 800 }, { x: 1740, y: 900 }, { x: 2010, y: 1160 }, { x: 2050, y: 1450 }], 125),
    ...route([{ x: 470, y: 1210 }, { x: 430, y: 930 }, { x: 500, y: 650 }, { x: 610, y: 470 }, { x: 850, y: 340 }, { x: 1160, y: 430 }, { x: 1160, y: 850 }], 125),
    ...route([{ x: 1160, y: 430 }, { x: 1500, y: 350 }, { x: 1810, y: 430 }, { x: 1940, y: 650 }, { x: 1740, y: 900 }], 120),
    ...route([{ x: 1810, y: 430 }, { x: 1940, y: 410 }, { x: 2140, y: 440 }, { x: 2180, y: 700 }], 115),
    ...route([{ x: 1160, y: 850 }, { x: 1450, y: 1180 }, { x: 1740, y: 900 }], 120),
    ...route([{ x: 1450, y: 1180 }, { x: 1710, y: 1350 }, { x: 1810, y: 1160 }, { x: 2010, y: 1160 }], 110),
    ...route([{ x: 1160, y: 850 }, { x: 1430, y: 610 }, { x: 1740, y: 700 }], 110),
    ...route([{ x: 1940, y: 650 }, { x: 2180, y: 700 }, { x: 2240, y: 850 }], 125),
    ...route([{ x: 1740, y: 900 }, { x: 2090, y: 930 }, { x: 2240, y: 850 }], 120),
    ...route([{ x: 2140, y: 440 }, { x: 2180, y: 250 }], 105),
    // Painted paths in wild-forest.png (1536×1024, displayed at 2400×1600).
    // These branches must also feed carveRoadThroughCollisions: the old grove
    // rectangles cover parts of the central crossing and the southern loop.
    ...route([
      { x: 500, y: 670 }, { x: 600, y: 672 }, { x: 740, y: 680 },
      { x: 900, y: 660 }, { x: 1050, y: 656 }, { x: 1180, y: 634 },
      { x: 1240, y: 570 }, { x: 1280, y: 495 }, { x: 1360, y: 380 },
    ], 80),
    ...route([
      { x: 740, y: 680 }, { x: 760, y: 725 }, { x: 805, y: 828 },
      { x: 835, y: 925 }, { x: 870, y: 1020 }, { x: 935, y: 1095 },
      { x: 1050, y: 1115 }, { x: 1130, y: 1140 }, { x: 1160, y: 1240 },
      { x: 1150, y: 1345 }, { x: 1010, y: 1435 }, { x: 902, y: 1456 },
    ], 80),
    ...route([
      { x: 440, y: 1030 }, { x: 380, y: 934 }, { x: 300, y: 917 },
      { x: 327, y: 786 }, { x: 378, y: 690 }, { x: 440, y: 639 },
      { x: 500, y: 670 },
    ], 70),
    ...route([
      { x: 610, y: 470 }, { x: 645, y: 350 }, { x: 684, y: 278 },
      { x: 715, y: 210 }, { x: 715, y: 150 },
    ], 70),
    ...route([
      { x: 1500, y: 350 }, { x: 1595, y: 316 },
      { x: 1642, y: 275 }, { x: 1667, y: 206 },
    ], 65),
  ],
  zones: [
    { x: 610, y: 470, radius: 245 },
    { x: 1160, y: 790, radius: 180 },
    { x: 1740, y: 700, radius: 285 },
    { x: 470, y: 1030, radius: 165 },
    { x: 1500, y: 1110, radius: 165 },
  ],
}

const mountainWestMain = route([{ x: 140, y: 800 }, { x: 420, y: 830 }, { x: 720, y: 770 }, { x: 1050, y: 760 }, { x: 1350, y: 790 }, { x: 1650, y: 700 }, { x: 1980, y: 760 }, { x: 2400, y: 800 }], 125)
const mountainEastMain = route([{ x: 2400, y: 800 }, { x: 2700, y: 780 }, { x: 3050, y: 720 }, { x: 3450, y: 770 }, { x: 3800, y: 720 }, { x: 4200, y: 800 }, { x: 4660, y: 820 }], 125)

export const MOUNTAIN_ROADS: RoadNetwork = {
  segments: [
    ...mountainWestMain,
    ...mountainEastMain,
    ...paintedPath([[140, 800], [150, 940], [330, 820], [530, 750]], 90),
    ...route([{ x: 1050, y: 760 }, { x: 1080, y: 430 }, { x: 1110, y: 100 }], 115),
    ...route([{ x: 720, y: 770 }, { x: 820, y: 1110 }, { x: 1320, y: 1270 }, { x: 1450, y: 1510 }], 115),
    ...route([{ x: 1650, y: 700 }, { x: 1880, y: 470 }, { x: 2140, y: 760 }, { x: 2320, y: 1230 }], 115),
    ...route([{ x: 2700, y: 780 }, { x: 2760, y: 1120 }, { x: 3020, y: 1270 }, { x: 3440, y: 1130 }, { x: 3770, y: 980 }], 115),
    ...route([{ x: 3050, y: 720 }, { x: 3250, y: 670 }, { x: 3640, y: 570 }, { x: 3800, y: 720 }], 115),
    ...route([{ x: 3770, y: 980 }, { x: 3910, y: 1320 }], 115),
    ...route([{ x: 720, y: 770 }, { x: 940, y: 1030 }], 105),
    ...route([{ x: 2400, y: 800 }, { x: 2480, y: 980 }, { x: 2760, y: 1120 }], 105),
    ...route([{ x: 3450, y: 770 }, { x: 3790, y: 1180 }], 105),
    ...paintedPath([[1285, 839], [1319, 596], [1385, 452], [1307, 382], [1175, 331], [1097, 221], [1141, 110]], 75),
    ...paintedPath([[1285, 839], [1285, 949], [1285, 1126], [1250, 1247], [1124, 1346], [1093, 1468], [1081, 1510]], 85),
    ...paintedPath([[3629, 947], [3596, 772], [3660, 636], [3713, 536], [3611, 508], [3441, 437], [3376, 346]], 80),
    ...paintedPath([[3713, 536], [3850, 486], [3894, 380], [3948, 311]], 75),
    ...paintedPath([[3629, 947], [3615, 1081], [3613, 1207], [3697, 1331], [3697, 1496]], 85),
  ],
  zones: [
    { x: 1200, y: 760, radius: 235 },
    { x: 2050, y: 770, radius: 190 },
    { x: 3200, y: 760, radius: 235 },
    { x: 4300, y: 820, radius: 390 },
  ],
}

const birdPassMain = route([
  { x: 140, y: 800 }, { x: 430, y: 790 }, { x: 760, y: 850 }, { x: 1080, y: 760 },
  { x: 1420, y: 700 }, { x: 1770, y: 790 }, { x: 2130, y: 720 }, { x: 2480, y: 800 },
  { x: 2820, y: 730 }, { x: 3170, y: 810 }, { x: 3500, y: 720 }, { x: 3860, y: 790 },
  { x: 4210, y: 800 }, { x: 4660, y: 800 },
], 130)

export const BIRD_PASS_ROADS: RoadNetwork = {
  segments: [
    ...birdPassMain,
    ...route([{ x: 760, y: 850 }, { x: 830, y: 1120 }, { x: 1100, y: 1320 }, { x: 1430, y: 1190 }, { x: 1770, y: 790 }], 115),
    ...route([{ x: 1080, y: 760 }, { x: 1160, y: 480 }, { x: 1430, y: 300 }, { x: 1770, y: 790 }], 115),
    ...route([{ x: 2130, y: 720 }, { x: 2280, y: 1050 }, { x: 2650, y: 1180 }, { x: 2820, y: 730 }], 115),
    ...route([{ x: 2480, y: 800 }, { x: 2600, y: 470 }, { x: 2940, y: 320 }, { x: 3170, y: 810 }], 115),
    ...route([{ x: 3170, y: 810 }, { x: 3370, y: 1110 }, { x: 3720, y: 1190 }, { x: 3860, y: 790 }], 115),
    ...route([{ x: 3500, y: 720 }, { x: 3660, y: 430 }, { x: 3970, y: 360 }, { x: 4210, y: 800 }], 115),
    ...paintedPath([[156, 961], [367, 898], [639, 888], [922, 944], [1188, 1019], [1434, 983], [1672, 888], [1859, 788], [2070, 717], [2328, 570]], 100),
    ...paintedPath([[922, 944], [872, 828], [750, 675], [664, 563], [648, 444], [581, 355], [533, 281]], 75),
    ...paintedPath([[1188, 1019], [1044, 1069], [925, 1172], [859, 1266], [844, 1352]], 75),
    ...paintedPath([[1434, 983], [1550, 1066], [1663, 1159], [1781, 1263], [1859, 1353], [1906, 1461]], 80),
    ...paintedPath([[2463, 741], [2592, 816], [2670, 939], [2792, 998], [2973, 1016], [3127, 964], [3305, 886], [3464, 822], [3631, 802], [3797, 813], [3994, 833]], 100),
    ...paintedPath([[2792, 998], [2741, 1106], [2630, 1206], [2509, 1273]], 75),
    ...paintedPath([[3631, 802], [3791, 656], [3844, 569], [4080, 455], [4275, 445]], 80),
  ],
  zones: [
    { x: 650, y: 810, radius: 210 },
    { x: 1650, y: 760, radius: 210 },
    { x: 2700, y: 770, radius: 230 },
    { x: 3650, y: 780, radius: 240 },
    { x: 4460, y: 800, radius: 400 },
  ],
}

export const SNOW_VALLEY_ROADS: RoadNetwork = {
  // Traced from the single 3:1 snow-valley-panorama-v2.jpg, not duplicated
  // west/east backgrounds. Keep the bends and branch mouths on visible snow.
  segments: [...route([
    { x: 130, y: 760 }, { x: 400, y: 680 }, { x: 750, y: 680 },
    { x: 1100, y: 800 }, { x: 1500, y: 950 }, { x: 1750, y: 930 },
    { x: 2100, y: 830 }, { x: 2300, y: 800 }, { x: 2650, y: 890 },
    { x: 2900, y: 950 }, { x: 3300, y: 875 }, { x: 3650, y: 815 },
    { x: 4050, y: 925 }, { x: 4330, y: 835 }, { x: 4670, y: 730 },
  ], 145),
  ...paintedPath([[1000, 820], [900, 710], [800, 580], [720, 440], [600, 320], [520, 230]], 80),
  ...paintedPath([[1520, 950], [1640, 1110], [1720, 1250], [1770, 1390], [1780, 1490]], 80),
  ...paintedPath([[3420, 840], [3380, 650], [3250, 440], [3130, 265], [3040, 110]], 85),
  ...paintedPath([[4060, 930], [4200, 1080], [4320, 1240], [4390, 1390], [4430, 1480]], 85),
  ],
  zones: [
    { x: 1000, y: 820, radius: 170 },
    { x: 1520, y: 950, radius: 175 },
    { x: 3420, y: 840, radius: 170 },
    { x: 4060, y: 930, radius: 170 },
  ],
}

// The siege approach shares the main corridor, not the city's side streets:
// expanding those streets must never carve openings through the fortress wall.
export const KROK_OUTSKIRTS_ROADS: RoadNetwork = {
  segments: route([
    { x: 130, y: 800 }, { x: 700, y: 780 }, { x: 1350, y: 790 },
    { x: 2050, y: 800 }, { x: 2700, y: 780 }, { x: 3350, y: 790 },
    { x: 4000, y: 800 }, { x: 4670, y: 800 },
  ], 230),
  zones: [
    { x: 1100, y: 810, radius: 270 },
    { x: 2500, y: 800, radius: 280 },
    { x: 3750, y: 820, radius: 270 },
  ],
}

export const SNOW_CITY_ROADS: RoadNetwork = {
  segments: [
    ...KROK_OUTSKIRTS_ROADS.segments,
    ...paintedPath([[1800, 800], [1800, 590], [1795, 420], [1840, 210]], 80),
    ...paintedPath([[1210, 810], [1225, 1050], [1260, 1280], [1300, 1510]], 85),
    ...paintedPath([[2930, 760], [2770, 570], [2650, 360], [2610, 180], [2630, 80]], 80),
    ...paintedPath([[4210, 780], [4180, 590], [4110, 420], [4130, 230], [4110, 80]], 80),
    ...paintedPath([[4200, 900], [4180, 1070], [4110, 1250], [4080, 1380]], 75),
  ],
  zones: KROK_OUTSKIRTS_ROADS.zones,
}

export const KROK_CITY_ROADS: RoadNetwork = {
  segments: [
    ...[800, 2400].flatMap((y) => route([{ x: 0, y }, { x: 9600, y }], 170)),
    // Outer side streets remain narrow. Adjacent sectors share one boulevard,
    // including both former perimeter lanes without an unusable snowy gap.
    ...[140, 3060].flatMap((y) => route([{ x: 0, y }, { x: 9600, y }], 85)),
    ...route([{ x: 0, y: 1600 }, { x: 9600, y: 1600 }], 225),
    ...[1200, 3600, 6000, 8400].flatMap((x) => route([{ x, y: 0 }, { x, y: 3200 }], 150)),
    ...[140, 9460].flatMap((x) => route([{ x, y: 0 }, { x, y: 3200 }], 85)),
    ...[2400, 4800, 7200].flatMap((x) => route([{ x, y: 0 }, { x, y: 3200 }], 225)),
  ],
  zones: [],
}

export function projectToRoad(network: RoadNetwork, x: number, y: number): RoadProjection {
  let best: RoadProjection | null = null
  const consider = (centerX: number, centerY: number, halfWidth: number): void => {
    const distance = Math.hypot(x - centerX, y - centerY)
    const excess = distance - halfWidth
    const bestExcess = best ? best.distance - best.halfWidth : Infinity
    if (!best || excess < bestExcess || (excess === bestExcess && distance < best.distance)) {
      best = { x: centerX, y: centerY, distance, halfWidth }
    }
  }

  for (const segment of network.segments) {
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const lengthSq = dx * dx + dy * dy
    const ratio = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.from.x) * dx + (y - segment.from.y) * dy) / lengthSq))
    consider(segment.from.x + dx * ratio, segment.from.y + dy * ratio, segment.halfWidth)
  }
  for (const zone of network.zones) consider(zone.x, zone.y, zone.radius)
  return best ?? { x, y, distance: 0, halfWidth: 0 }
}

export function isOnRoad(network: RoadNetwork, x: number, y: number): boolean {
  const projection = projectToRoad(network, x, y)
  return projection.distance <= projection.halfWidth
}

/** Keep solid scenery outside roads, leaving enough space for the player's body. */
export function carveRoadThroughCollisions(
  rectangles: readonly RoadCollisionRect[],
  network: RoadNetwork,
  clearance = 64,
  cellSize = 24,
): RoadCollisionRect[] {
  const result: RoadCollisionRect[] = []
  for (const rectangle of rectangles) {
    if (rectangle.width <= 0 || rectangle.height <= 0) continue
    const columns = Math.ceil(rectangle.width / cellSize)
    const rows = Math.ceil(rectangle.height / cellSize)
    let previousRuns = new Map<string, RoadCollisionRect>()
    for (let row = 0; row < rows; row += 1) {
      const cellY = rectangle.y + row * cellSize
      const cellHeight = Math.min(cellSize, rectangle.y + rectangle.height - cellY)
      const currentRuns = new Map<string, RoadCollisionRect>()
      let runStart = -1
      const keepCell = (column: number): boolean => {
        const cellX = rectangle.x + column * cellSize
        const cellWidth = Math.min(cellSize, rectangle.x + rectangle.width - cellX)
        const centerX = cellX + cellWidth / 2
        const centerY = cellY + cellHeight / 2
        const projection = projectToRoad(network, centerX, centerY)
        const halfDiagonal = Math.hypot(cellWidth, cellHeight) / 2
        return projection.distance > projection.halfWidth + clearance + halfDiagonal
      }
      const finishRun = (endColumn: number): void => {
        if (runStart < 0) return
        const x = rectangle.x + runStart * cellSize
        const end = Math.min(rectangle.x + rectangle.width, rectangle.x + endColumn * cellSize)
        const width = end - x
        const key = `${x}:${width}`
        const previous = previousRuns.get(key)
        if (previous && previous.y + previous.height === cellY) {
          previous.height += cellHeight
          currentRuns.set(key, previous)
        } else {
          const part = { x, y: cellY, width, height: cellHeight }
          result.push(part)
          currentRuns.set(key, part)
        }
        runStart = -1
      }
      for (let column = 0; column < columns; column += 1) {
        if (keepCell(column)) {
          if (runStart < 0) runStart = column
        } else finishRun(column)
      }
      finishRun(columns)
      previousRuns = currentRuns
    }
  }
  return result
}
