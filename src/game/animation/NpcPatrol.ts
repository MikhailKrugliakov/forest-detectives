export interface NpcPoint { x: number; y: number }
export interface NpcRect extends NpcPoint { width: number; height: number }
export interface NpcPatrolState { target: number; direction: 1 | -1; wait: number; stops: number }

export const NPC_WALK_SPEED = 40
export const NPC_CONVERSATION_RADIUS = 120

export function npcFootprint(position: NpcPoint, width: number, height: number): NpcRect {
  return { x: position.x - width * 0.21, y: position.y + height * 0.16, width: width * 0.42, height: height * 0.3 }
}

export function npcRectsOverlap(a: NpcRect, b: NpcRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Pure, bounded movement: neither a large frame nor a pause can skip a waypoint. */
export function stepNpcPatrol(
  position: NpcPoint,
  state: NpcPatrolState,
  route: readonly NpcPoint[],
  delta: number,
  canMove: (point: NpcPoint) => boolean,
): NpcPoint {
  if (route.length < 2) return position
  const elapsed = Math.min(Math.max(0, delta), 50)
  if (state.wait > 0) {
    state.wait = Math.max(0, state.wait - elapsed)
    return position
  }
  const target = route[state.target]
  if (!target) return position
  const dx = target.x - position.x
  const dy = target.y - position.y
  const distance = Math.hypot(dx, dy)
  const travel = Math.min(distance, NPC_WALK_SPEED * elapsed / 1000)
  const next = distance ? { x: position.x + dx / distance * travel, y: position.y + dy / distance * travel } : position
  if (!canMove(next)) {
    state.direction = state.direction === 1 ? -1 : 1
    state.target = Math.max(0, Math.min(route.length - 1, state.target + state.direction))
    state.wait = 2000
    return position
  }
  if (distance <= travel + 0.001) {
    if (state.target === route.length - 1) state.direction = -1
    else if (state.target === 0) state.direction = 1
    state.target += state.direction
    state.stops += 1
    state.wait = 2000 + (state.stops * 977) % 3001
  }
  return next
}
