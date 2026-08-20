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

function route(points: readonly RoadPoint[], halfWidth: number): RoadSegment[] {
  return points.slice(1).map((to, index) => ({ from: points[index]!, to, halfWidth }))
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
    ...route([{ x: 1050, y: 760 }, { x: 1080, y: 430 }, { x: 1110, y: 100 }], 115),
    ...route([{ x: 720, y: 770 }, { x: 820, y: 1110 }, { x: 1320, y: 1270 }, { x: 1450, y: 1510 }], 115),
    ...route([{ x: 1650, y: 700 }, { x: 1880, y: 470 }, { x: 2140, y: 760 }, { x: 2320, y: 1230 }], 115),
    ...route([{ x: 2700, y: 780 }, { x: 2760, y: 1120 }, { x: 3020, y: 1270 }, { x: 3440, y: 1130 }, { x: 3770, y: 980 }], 115),
    ...route([{ x: 3050, y: 720 }, { x: 3250, y: 670 }, { x: 3640, y: 570 }, { x: 3800, y: 720 }], 115),
    ...route([{ x: 3770, y: 980 }, { x: 3910, y: 1320 }], 115),
    ...route([{ x: 720, y: 770 }, { x: 940, y: 1030 }], 105),
    ...route([{ x: 2400, y: 800 }, { x: 2480, y: 980 }, { x: 2760, y: 1120 }], 105),
    ...route([{ x: 3450, y: 770 }, { x: 3790, y: 1180 }], 105),
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
  ],
  zones: [
    { x: 650, y: 810, radius: 210 },
    { x: 1650, y: 760, radius: 210 },
    { x: 2700, y: 770, radius: 230 },
    { x: 3650, y: 780, radius: 240 },
    { x: 4460, y: 800, radius: 400 },
  ],
}

export function projectToRoad(network: RoadNetwork, x: number, y: number): RoadProjection {
  let best: RoadProjection | null = null
  const consider = (centerX: number, centerY: number, halfWidth: number): void => {
    const distance = Math.hypot(x - centerX, y - centerY)
    if (!best || distance < best.distance) best = { x: centerX, y: centerY, distance, halfWidth }
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
