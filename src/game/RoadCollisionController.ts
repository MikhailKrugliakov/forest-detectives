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
    if (safe) sprite.setPosition(safe.x, safe.y)
    else {
      const projection = projectToRoad(this.network, sprite.x, sprite.y)
      sprite.setPosition(projection.x, projection.y)
      this.lastSafe.set(sprite, new Phaser.Math.Vector2(projection.x, projection.y))
    }
    sprite.setVelocity(0, 0)
    return false
  }

  isOnRoad(sprite: Phaser.Physics.Arcade.Image): boolean {
    return isOnRoad(this.network, sprite.x, sprite.y)
  }
}
