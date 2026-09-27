import Phaser from "phaser"
import { EventBus } from "../EventBus"
import { attachActor, type AnimatedActor } from "./AnimatedActor"
import { NPC_CONVERSATION_RADIUS, npcFootprint, npcRectsOverlap, stepNpcPatrol, type NpcPatrolState, type NpcPoint, type NpcRect } from "./NpcPatrol"

interface MapObject extends NpcPoint { name?: string; width?: number; height?: number; polyline?: NpcPoint[] }
interface MapData { layers?: { name: string; objects?: MapObject[] }[] }
interface Resident {
  id: string
  carrier: Phaser.Physics.Arcade.Image
  actor: AnimatedActor
  label?: Phaser.GameObjects.Text
  labelOffset: NpcPoint
  target?: NpcPoint
  width: number
  height: number
  route: NpcPoint[]
  patrol: NpcPatrolState
  talkRemaining: number
  workRemaining: number
}

/** Fixed physical footprints and map-authored, local resident walks. */
export class NpcController {
  private readonly residents: Resident[] = []
  private readonly routes = new Map<string, NpcPoint[]>()
  private readonly obstacles: NpcRect[] = []
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = []
  private paused = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Arcade.Image,
    mapKey?: string,
    private readonly allowed: (position: NpcPoint) => boolean = () => true,
  ) {
    const map = mapKey ? scene.cache.tilemap.get(mapKey)?.data as MapData | undefined : undefined
    for (const item of map?.layers?.find(({ name }) => name === "npc-routes")?.objects ?? []) {
      if (item.name && item.polyline) this.routes.set(item.name, item.polyline.map(({ x, y }) => ({ x: item.x + x, y: item.y + y })))
    }
    for (const item of map?.layers?.find(({ name }) => name === "collisions")?.objects ?? []) {
      this.obstacles.push({ x: item.x, y: item.y, width: item.width ?? 0, height: item.height ?? 0 })
    }
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
    EventBus.on("modal-state", this.setPaused, this)
  }

  add(id: string, carrier: Phaser.GameObjects.Image, label?: Phaser.GameObjects.Text, target?: NpcPoint): Phaser.Physics.Arcade.Image {
    if (!carrier.body) this.scene.physics.add.existing(carrier)
    const image = carrier as Phaser.Physics.Arcade.Image
    const body = image.body as Phaser.Physics.Arcade.Body
    body.setSize(image.width * 0.42, image.height * 0.3)
    body.setOffset(image.width * 0.29, image.height * 0.66)
    body.setImmovable(true)
    body.setAllowGravity(false)
    body.pushable = false
    body.moves = false
    image.setName(`npc:${id}`).setData("npcId", id)
    if (label) image.setData("npcLabel", label)
    if (target) image.setData("npcTarget", target)
    this.colliders.push(this.scene.physics.add.collider(this.player, image))
    const actor = attachActor(this.scene, image)
    const route = this.routes.get(id) ?? []
    const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    this.residents.push({
      id, carrier: image, actor, label, target,
      labelOffset: { x: (label?.x ?? image.x) - image.x, y: (label?.y ?? image.y) - image.y },
      width: image.displayWidth, height: image.displayHeight, route,
      patrol: { target: 1, direction: 1, wait: 2000 + seed % 3001, stops: seed },
      talkRemaining: 0, workRemaining: 4000 + seed % 3001,
    })
    return image
  }

  talk(id: string, duration = 4200): void {
    const resident = this.residents.find((item) => item.id === id)
    if (!resident) return
    resident.talkRemaining = duration
    resident.actor.face(this.player.x - resident.carrier.x, this.player.y - resident.carrier.y)
    resident.actor.play("talk", { duration })
  }

  private setPaused(open: boolean): void { this.paused = open }

  private update(_time: number, delta: number): void {
    if (this.paused || !this.player.active) return
    const elapsed = Math.min(delta, 50)
    const view = this.scene.cameras.main.worldView
    for (const resident of this.residents) {
      const { carrier, actor } = resident
      if (!carrier.active) continue
      if (carrier.x < view.left - 300 || carrier.x > view.right + 300 || carrier.y < view.top - 300 || carrier.y > view.bottom + 300) continue
      resident.talkRemaining = Math.max(0, resident.talkRemaining - elapsed)
      const near = Math.hypot(this.player.x - carrier.x, this.player.y - carrier.y) <= NPC_CONVERSATION_RADIUS
      if (near || resident.talkRemaining > 0) {
        actor.face(this.player.x - carrier.x, this.player.y - carrier.y)
      } else if (resident.route.length > 1) {
        const next = stepNpcPatrol(carrier, resident.patrol, resident.route, elapsed, (point) => this.canMove(resident, point))
        if (next.x !== carrier.x || next.y !== carrier.y) {
          const body = carrier.body as Phaser.Physics.Arcade.Body
          body.reset(next.x, next.y)
        }
      } else {
        resident.workRemaining -= elapsed
        if (resident.workRemaining <= 0) {
          actor.play("work", { duration: 1100 })
          resident.workRemaining = 7000
        }
      }
      carrier.setDepth(carrier.y + 20)
      resident.label?.setPosition(carrier.x + resident.labelOffset.x, carrier.y + resident.labelOffset.y).setDepth(carrier.y + 40)
      if (resident.target) { resident.target.x = carrier.x; resident.target.y = carrier.y }
    }
  }

  private canMove(resident: Resident, point: NpcPoint): boolean {
    if (!this.allowed(point)) return false
    const footprint = npcFootprint(point, resident.width, resident.height)
    if (this.obstacles.some((obstacle) => npcRectsOverlap(footprint, obstacle))) return false
    const bounds = this.scene.physics.world.bounds
    if (footprint.x < bounds.x || footprint.y < bounds.y || footprint.x + footprint.width > bounds.right || footprint.y + footprint.height > bounds.bottom) return false
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    if (npcRectsOverlap(footprint, { x: playerBody.x - 8, y: playerBody.y - 8, width: playerBody.width + 16, height: playerBody.height + 16 })) return false
    return !this.residents.some((other) => other !== resident && npcRectsOverlap(footprint, npcFootprint(other.carrier, other.width + 16, other.height)))
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this)
    EventBus.off("modal-state", this.setPaused, this)
    // Arcade may already have disposed its colliders during Scene.shutdown.
    for (const collider of this.colliders) if (collider.world) collider.destroy()
    this.colliders.length = 0
    for (const resident of this.residents) resident.actor.dispose()
    this.residents.length = 0
  }
}
