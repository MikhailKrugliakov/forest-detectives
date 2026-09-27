import Phaser from "phaser"
import { isOnRoad, projectToRoad, type RoadNetwork } from "../domain/roads"

export class RoadCollisionController {
  private readonly lastSafe = new WeakMap<Phaser.Physics.Arcade.Image, Phaser.Math.Vector2>()

  constructor(private readonly network: RoadNetwork) {}

  track(sprite: Phaser.Physics.Arcade.Image, snapToRoad = false): void {
    if (snapToRoad && !isOnRoad(this.network, sprite.x, sprite.y)) {
      const projection = projectToRoad(this.network, sprite.x, sprite.y)
      sprite.setPosition(projection.x, projection.y)
    }
    this.lastSafe.set(sprite, new Phaser.Math.Vector2(sprite.x, sprite.y))
  }

  constrain(sprite: Phaser.Physics.Arcade.Image): boolean {
    if (isOnRoad(this.network, sprite.x, sprite.y)) {
      this.lastSafe.get(sprite)?.set(sprite.x, sprite.y)
      return true
    }
    const safe = this.lastSafe.get(sprite)
    const projection = projectToRoad(this.network, sprite.x, sprite.y)
    if (safe && projection.distance - projection.halfWidth > 40) {
      sprite.setPosition(safe.x, safe.y)
      sprite.setVelocity(0, 0)
      return false
    }
    const allowed = Math.max(0, projection.halfWidth - 8)
    const ratio = projection.distance > 0 ? allowed / projection.distance : 0
    const x = projection.x + (sprite.x - projection.x) * ratio
    const y = projection.y + (sprite.y - projection.y) * ratio
    const body = sprite.body as Phaser.Physics.Arcade.Body
    let velocityX = body.velocity.x
    let velocityY = body.velocity.y
    if (projection.distance > 0) {
      const normalX = (sprite.x - projection.x) / projection.distance
      const normalY = (sprite.y - projection.y) / projection.distance
      const outwardSpeed = velocityX * normalX + velocityY * normalY
      if (outwardSpeed > 0) {
        velocityX -= normalX * outwardSpeed
        velocityY -= normalY * outwardSpeed
      }
    }
    if (isOnRoad(this.network, x, y)) {
      sprite.setPosition(x, y)
      if (safe) safe.set(x, y)
      else this.lastSafe.set(sprite, new Phaser.Math.Vector2(x, y))
    } else if (safe) sprite.setPosition(safe.x, safe.y)
    else sprite.setPosition(projection.x, projection.y)
    sprite.setVelocity(velocityX, velocityY)
    return false
  }

  isOnRoad(sprite: Phaser.Physics.Arcade.Image): boolean {
    return isOnRoad(this.network, sprite.x, sprite.y)
  }
}
