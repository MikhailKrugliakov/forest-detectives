import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

interface Rectangle { x: number; y: number; width: number; height: number; name?: string }
interface MapData { layers: { name: string; objects?: Rectangle[] }[] }

function collisions(name: string): Rectangle[] {
  const map = JSON.parse(readFileSync(new URL(`../../public/assets/maps/${name}.tmj`, import.meta.url), "utf8")) as MapData
  return map.layers.find(({ name }) => name === "collisions")!.objects!
}

function isClear(rectangles: readonly Rectangle[], x: number, y: number, width = 102, height = 140): boolean {
  // The scene's fixed foot body, not the full portrait/sprite rectangle.
  const body = { x: x - width * 0.21, y: y + height * 0.16, width: width * 0.42, height: height * 0.3 }
  return !rectangles.some((wall) => body.x < wall.x + wall.width && body.x + body.width > wall.x && body.y < wall.y + wall.height && body.y + body.height > wall.y)
}

function connected(rectangles: readonly Rectangle[], start: readonly [number, number], goal: readonly [number, number], width: number, height: number): boolean {
  const grid = 20
  const queue: [number, number][] = [[...start]]
  const visited = new Set<string>()
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index]!
    if (Math.hypot(x - goal[0], y - goal[1]) <= grid) return true
    for (const [dx, dy] of [[grid, 0], [-grid, 0], [0, grid], [0, -grid]]) {
      const nextX = x + dx!
      const nextY = y + dy!
      const key = `${nextX}:${nextY}`
      if (visited.has(key) || nextX < 30 || nextY < 30 || nextX > width - 30 || nextY > height - 70 || !isClear(rectangles, nextX, nextY)) continue
      visited.add(key)
      queue.push([nextX, nextY])
    }
  }
  return false
}

describe("snow interiors match their painted floors", () => {
  it("keeps the palace's painted central cross and former phantom table clear", () => {
    const walls = collisions("ice-palace")
    // ice-palace.jpg is 1536×1024, rendered at 2400×1600. These points
    // are open blue floor, not furniture or a projected road-mask centreline.
    for (const [x, y] of [[600, 540], [1180, 540], [1200, 370], [1200, 240], [1200, 1180], [1200, 1320]]) {
      expect(isClear(walls, x!, y!), `visible palace floor ${x},${y}`).toBe(true)
      expect(isClear(walls, x!, y!, 96, 112), `watermelon palace floor ${x},${y}`).toBe(true)
    }
    expect(connected(walls, [180, 800], [2240, 800], 2400, 1600)).toBe(true)
    expect(connected(walls, [1200, 800], [1200, 240], 2400, 1600)).toBe(true)
    expect(connected(walls, [1200, 800], [1200, 1320], 2400, 1600)).toBe(true)
  })

  it("retains the real palace furniture, outer ice walls and southern cliffs", () => {
    const walls = collisions("ice-palace")
    for (const [x, y] of [[620, 300], [880, 250], [1770, 1180], [550, 1240], [1200, 1450], [30, 1050]]) {
      expect(isClear(walls, x!, y!), `solid palace furnishing ${x},${y}`).toBe(false)
    }
  })

  it("opens the throne's upper aisle but keeps benches, throne and bridge-side void solid", () => {
    const walls = collisions("ice-throne")
    // ice-throne.jpg is scaled independently to 1280×900. The upper
    // benches end before y200; their old y200–305 boxes blocked bare floor.
    for (const [x, y] of [[330, 250], [450, 250], [650, 250], [790, 260], [145, 450], [440, 620]]) {
      expect(isClear(walls, x!, y!), `visible throne floor ${x},${y}`).toBe(true)
    }
    for (const [x, y] of [[440, 685], [700, 685], [950, 685], [1160, 380], [100, 240], [100, 610]]) {
      expect(isClear(walls, x!, y!), `solid throne furnishing ${x},${y}`).toBe(false)
    }
    expect(connected(walls, [145, 450], [1045, 450], 1280, 900)).toBe(true)
    expect(connected(walls, [145, 450], [645, 250], 1280, 900)).toBe(true)
  })
})
