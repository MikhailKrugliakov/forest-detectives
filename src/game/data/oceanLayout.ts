import type { RoadNetwork, RoadPoint } from "../../domain/roads"

/** Art and collision share this continuous corridor; branch ends overlap its spine. */
export const OCEAN_ROUTE_POINTS: readonly RoadPoint[] = [
  { x: 180, y: 800 }, { x: 800, y: 800 }, { x: 1400, y: 800 },
  { x: 2000, y: 800 }, { x: 2400, y: 800 }, { x: 2900, y: 800 },
  { x: 3500, y: 800 }, { x: 3900, y: 800 }, { x: 4620, y: 800 },
]
export const OCEAN_BRANCH_POINTS: readonly (readonly RoadPoint[])[] = [
  [{ x: 1400, y: 800 }, { x: 1400, y: 380 }],
  [{ x: 1400, y: 800 }, { x: 1400, y: 1240 }],
  [{ x: 2900, y: 800 }, { x: 2900, y: 380 }],
  [{ x: 2900, y: 800 }, { x: 2900, y: 1240 }],
]
export const OCEAN_ROAD_NETWORK: RoadNetwork = {
  segments: [
    ...OCEAN_ROUTE_POINTS.slice(1).map((to, i) => ({ from: OCEAN_ROUTE_POINTS[i]!, to, halfWidth: 300 })),
    ...OCEAN_BRANCH_POINTS.map(([from, to]) => ({ from: from!, to: to!, halfWidth: 145 })),
  ],
  zones: [{ x: 4200, y: 800, radius: 600 }],
}
function corridorNetwork(centerY: number, halfWidth: number): RoadNetwork {
  return {
    segments: [
      ...OCEAN_ROUTE_POINTS.slice(1).map((point, index) => ({ from: { x: OCEAN_ROUTE_POINTS[index]!.x, y: centerY }, to: { x: point.x, y: centerY }, halfWidth })),
      ...OCEAN_BRANCH_POINTS.map(([from, to]) => ({ from: { x: from!.x, y: centerY }, to: to!, halfWidth: 145 })),
    ],
    zones: OCEAN_ROAD_NETWORK.zones,
  }
}
export const OCEAN_ROADS = { beach: corridorNetwork(800, 250), sea: corridorNetwork(760, 200), trench: corridorNetwork(760, 200) }
export const OCEAN_ENTRY = { x: 180, y: 800 }
export const OCEAN_EXIT = { x: 4620, y: 800 }
export const OCEAN_MECHANISM = { x: 4590, y: 800 }

/** Main road has no solid map obstacles; enemies use overlaps so a swarm cannot seal it. */
export const OCEAN_ARENA = { left: 3800, right: 4600, top: 380, bottom: 1220 }
