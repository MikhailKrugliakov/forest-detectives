import Phaser from "phaser"
import { EventBus } from "../EventBus"
import { ActionTimeline, type ActionOptions } from "./ActionTimeline"
import { ACTORS, actorClip, clipFrameIndex, facingFromMovement, type ActorAction, type ActorDefinition, type FacingDirection } from "./catalog"
import { ResolvedMotion, type AnimationPhysicsFrame, type MotionPoint } from "./ResolvedMotion"
import { heroIdleOffsets, heroRunScale } from "./locomotionProfiles"
import { HeroLocomotionRig } from "./HeroLocomotionRig"

export type { ActorAction, FacingDirection } from "./catalog"
export interface ActorPlayOptions extends ActionOptions { facing?: FacingDirection }
type Carrier = Phaser.GameObjects.Image
const actors = new WeakMap<Carrier, AnimatedActor>()
const systems = new WeakMap<Phaser.Scene, ActorSystem>()
const references = new WeakMap<Phaser.Textures.TextureManager, Map<string, number>>()
const knownTextures = new WeakMap<Phaser.Textures.TextureManager, Set<string>>()
const requestedSheets = new WeakMap<Phaser.Loader.LoaderPlugin, Set<string>>()

function retain(scene: Phaser.Scene, key: string): void {
  if (!knownTextures.has(scene.textures)) {
    const textures = scene.textures
    const known = new Set<string>()
    knownTextures.set(scene.textures, known)
    // A completed image decode can outlive Scene.shutdown. Its old actor's
    // loader listener is gone, but the resulting unused texture still needs
    // releasing. One manager-level listener covers all such late arrivals.
    textures.on(Phaser.Textures.Events.ADD, (loadedKey: string) => {
      if (!known.has(loadedKey)) return
      queueMicrotask(() => {
        if (!references.get(textures)?.get(loadedKey) && textures.exists(loadedKey)) textures.remove(loadedKey)
      })
    })
  }
  knownTextures.get(scene.textures)!.add(key)
  const counts = references.get(scene.textures) ?? new Map<string, number>()
  counts.set(key, (counts.get(key) ?? 0) + 1)
  references.set(scene.textures, counts)
}

function requestSheet(scene: Phaser.Scene, key: string, path: string): void {
  let pending = requestedSheets.get(scene.load)
  if (!pending) {
    pending = new Set<string>()
    requestedSheets.set(scene.load, pending)
    const requests = pending
    const complete = (loadedKey: string) => requests.delete(loadedKey)
    const failed = (file: { key: string }) => requests.delete(file.key)
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, complete)
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, failed)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      requestedSheets.delete(scene.load)
      scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, complete)
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed)
    })
  }
  if (pending.has(key)) return
  pending.add(key)
  scene.load.image(key, path)
  if (!scene.load.isLoading()) scene.load.start()
}

function release(scene: Phaser.Scene, key: string): void {
  const counts = references.get(scene.textures)
  const next = Math.max(0, (counts?.get(key) ?? 0) - 1)
  if (next) counts?.set(key, next)
  else {
    counts?.delete(key)
    // Scene shutdown destroys its display list synchronously. Let that finish
    // before removing a texture another dying sprite may still reference.
    queueMicrotask(() => {
      if (!counts?.get(key) && scene.textures.exists(key)) scene.textures.remove(key)
    })
  }
}

class ActorSystem {
  readonly members = new Set<AnimatedActor>()
  paused = false
  private destroyed = false
  private physicsDeltaMs = 0
  private readonly world?: Phaser.Physics.Arcade.World
  constructor(readonly scene: Phaser.Scene) {
    this.world = scene.physics?.world
    this.world?.on(Phaser.Physics.Arcade.Events.WORLD_STEP, this.physicsStep, this)
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
    EventBus.on("modal-state", this.setPaused, this)
  }
  private setPaused(open: boolean): void { this.paused = open }
  private physicsStep(deltaSeconds: number): void {
    this.physicsDeltaMs += deltaSeconds * 1000
    // WORLD_STEP runs after collision resolution, before bodies are synced to
    // their carriers. Capture every step, including catch-up steps in one frame.
    for (const actor of this.members) actor.capturePhysicsStep()
  }
  private update(_time: number, delta: number): void {
    const world = this.world
    let physics: AnimationPhysicsFrame | undefined
    if (world) {
      // Phaser 4 exposes WORLD_STEP and fps, but not an interpolation fraction.
      // Its fixed-step accumulator is read only here; never change world time.
      const remaining = (world as Phaser.Physics.Arcade.World & { _elapsed?: number })._elapsed ?? 0
      const stepMs = 1000 / world.fps * world.timeScale
      physics = { deltaMs: this.physicsDeltaMs, fixed: world.fixedStep, alpha: world.fixedStep ? remaining / stepMs : 1 }
    }
    this.physicsDeltaMs = 0
    for (const actor of this.members) actor.update(delta, this.paused, physics)
  }
  private destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this)
    this.world?.off(Phaser.Physics.Arcade.Events.WORLD_STEP, this.physicsStep, this)
    EventBus.off("modal-state", this.setPaused, this)
    for (const actor of [...this.members]) actor.dispose()
    systems.delete(this.scene)
  }
}

/** The original Image remains the fixed physics anchor. Only visual is animated. */
export class AnimatedActor {
  readonly visual: Phaser.GameObjects.Sprite
  readonly shadow: Phaser.GameObjects.Ellipse
  /** Stable visual centre for camera following; never a physics target. */
  readonly renderPosition: Readonly<MotionPoint>
  readonly timeline = new ActionTimeline()
  facing: FacingDirection = "down"
  private desiredFacing: FacingDirection = "down"
  action: ActorAction = "idle"
  ready = false
  utilityReady = false
  actionsReady = false
  specialReady = false
  motionReady = false
  private rig: HeroLocomotionRig | null = null
  paused = false
  previewMoving = false
  private disposed = false
  private previousX: number
  private previousY: number
  private cycle = 0
  private running = false
  private moving = false
  private motionSpeed = 0
  private readonly resolvedMotion: ResolvedMotion
  private atlasDisplayWidth = 0
  private atlasDisplayHeight = 0
  private locomotionScale = 1
  private sustained: ActorAction | null = null
  private swimming = false
  private swimElapsed = 0
  private textureKey: string
  private readonly definition: ActorDefinition | undefined
  private readonly system: ActorSystem
  private readonly displayWidth: number
  private readonly displayHeight: number
  private readonly originalVisible: boolean
  private loadedListener: (() => void) | null = null
  private extraListeners = new Map<string, () => void>()

  constructor(readonly scene: Phaser.Scene, readonly carrier: Carrier, readonly assetKey: string) {
    this.definition = ACTORS.get(assetKey)
    this.textureKey = `animation:${assetKey}`
    this.previousX = carrier.x
    this.previousY = carrier.y
    this.resolvedMotion = new ResolvedMotion(carrier.x, carrier.y)
    this.renderPosition = this.resolvedMotion.position
    this.displayWidth = Math.abs(carrier.displayWidth)
    this.displayHeight = Math.abs(carrier.displayHeight)
    this.originalVisible = carrier.visible
    this.visual = scene.add.sprite(carrier.x, carrier.y, carrier.texture.key, carrier.frame.name)
      .setDisplaySize(this.displayWidth, this.displayHeight)
      .setOrigin(carrier.originX, carrier.originY).setDepth(carrier.depth)
    this.shadow = scene.add.ellipse(carrier.x, carrier.y, this.displayWidth * 0.56, this.displayHeight * 0.075, 0x132725, 0.2)
    carrier.setVisible(false)
    carrier.once(Phaser.GameObjects.Events.DESTROY, this.dispose, this)
    this.system = systems.get(scene) ?? new ActorSystem(scene)
    systems.set(scene, this.system)
    this.system.members.add(this)
    actors.set(carrier, this)
    if (this.definition) {
      retain(scene, this.textureKey)
      this.loadSheet()
      if (this.definition.utilitySheet) this.loadExtra("utility", this.definition.utilitySheet)
      if (this.definition.actionsSheet) this.loadExtra("actions", this.definition.actionsSheet)
      if (this.definition.specialSheet) this.loadExtra("special", this.definition.specialSheet)
      if (this.definition.motionSheet) this.loadExtra("motion", this.definition.motionSheet)
      if (this.definition.rigSheet) this.loadExtra("rig", this.definition.rigSheet)
    }
  }

  get isPlaying(): boolean { return this.timeline.active }
  get locomotionAvailable(): boolean { return this.definition?.rigSheet != null }
  get locomotionReady(): boolean { return this.rig != null }
  get gaitSnapshot() { return this.rig?.snapshot ?? null }
  get currentAction(): ActorAction { return this.action }
  get activeAction(): ActorAction | null { return this.timeline.active ? this.action : null }
  get clip() {
    // Flight never freezes into a standing pose when the AI hovers to aim.
    if (this.definition?.family === "flyer" && this.action === "idle") {
      return { ...actorClip("walk", this.facing), duration: 640 }
    }
    return this.getClip(this.action, this.facing)
  }

  getClip(action: ActorAction, facing = this.facing) {
    if (this.definition?.family === "hero" && action === "idle") {
      // The base sheet shares the walking proportions. The utility sheet's
      // independently drawn idle poses can be much larger and even turn around.
      const clip = actorClip("idle", facing)
      const start = clip.frames[0]!
      return { ...clip, frames: heroIdleOffsets(this.assetKey, facing).map((offset) => start + offset) }
    }
    const special = this.specialReady && (this.assetKey === "turtle-guardian" || this.assetKey === "walrus") ? this.assetKey : undefined
    return actorClip(action, facing, this.utilityReady, { actions: this.actionsReady, motion: this.motionReady, moving: this.moving || this.previewMoving, special, family: this.definition?.family })
  }

  setRunning(running: boolean): void { this.running = running }
  /** Underwater posing never changes the physics carrier or combat timelines. */
  setSwimming(swimming: boolean): void {
    this.swimming = swimming
    if (swimming) this.rig?.hide()
  }
  face(x: number, y: number): void {
    this.desiredFacing = facingFromMovement(x, y, this.desiredFacing)
    if (!this.timeline.active) this.facing = this.desiredFacing
  }

  play(action: ActorAction, options: ActorPlayOptions = {}): void {
    if (this.disposed || (this.action === "defeat" && this.timeline.active && action !== "defeat")) return
    this.sustained = null
    this.timeline.start(options, this.getClip(action, options.facing ?? this.facing).duration)
    this.action = action
    this.cycle = 0
    this.facing = this.desiredFacing = options.facing ?? this.desiredFacing
  }

  setState(action: ActorAction, duration?: number): void {
    if (this.disposed || (this.action === "defeat" && this.timeline.active)) return
    const sustained = action === "idle" ? null : action
    if (this.sustained === sustained && duration == null) return
    this.sustained = sustained
    if (this.timeline.active) return
    this.action = action
    this.cycle = 0
    if (duration != null) this.play(action, { duration })
  }

  cancel(): void {
    this.timeline.cancel()
    this.sustained = null
    this.action = "idle"
  }

  private loadSheet(): void {
    if (this.scene.textures.exists(this.textureKey)) {
      this.useSheet()
      return
    }
    const event = `filecomplete-image-${this.textureKey}`
    this.loadedListener = () => {
      this.loadedListener = null
      if (!this.disposed) this.useSheet()
    }
    this.scene.load.once(event, this.loadedListener)
    requestSheet(this.scene, this.textureKey, this.definition!.sheet)
  }

  private useSheet(): void {
    const definition = this.definition!
    const texture = this.scene.textures.get(this.textureKey)
    const image = texture.getSourceImage() as HTMLImageElement
    const width = image.width / definition.columns
    const height = image.height / definition.rows
    if (!texture.has("0")) {
      for (let row = 0; row < definition.rows; row++) {
        for (let column = 0; column < definition.columns; column++) {
          texture.add(String(row * definition.columns + column), 0, column * width, row * height, width, height)
        }
      }
    }
    this.visual.setTexture(this.textureKey, "0")
    // All packed sheets share baseline 118 in a 128 px frame. Anchor that exact
    // line so the run-scale correction cannot also move the feet vertically.
    this.atlasDisplayWidth = this.displayHeight * width / height / 0.88
    this.atlasDisplayHeight = this.displayHeight / 0.88
    this.visual.setDisplaySize(this.atlasDisplayWidth, this.atlasDisplayHeight)
    this.visual.setOrigin(0.5, 118 / 128)
    this.ready = true
  }

  private loadExtra(kind: "utility" | "actions" | "special" | "motion" | "rig", path: string): void {
    const key = `${this.textureKey}:${kind}`
    retain(this.scene, key)
    const loaded = () => {
      if (this.disposed) return
      const texture = this.scene.textures.get(key)
      const image = texture.getSourceImage() as HTMLImageElement
      const rows = kind === "rig" ? 4 : 12
      const columns = kind === "rig" ? 3 : 8
      if (!texture.has("0")) {
        for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
          texture.add(String(row * columns + column), 0, column * image.width / columns, row * image.height / rows, image.width / columns, image.height / rows)
        }
      }
      if (kind === "utility") this.utilityReady = true
      if (kind === "actions") this.actionsReady = true
      if (kind === "special") this.specialReady = true
      if (kind === "motion") this.motionReady = true
      if (kind === "rig") this.rig = new HeroLocomotionRig(this.scene, this.assetKey, key)
      this.extraListeners.delete(key)
    }
    if (this.scene.textures.exists(key)) loaded()
    else {
      this.extraListeners.set(key, loaded)
      this.scene.load.once(`filecomplete-image-${key}`, loaded)
      requestSheet(this.scene, key, path)
    }
  }

  capturePhysicsStep(): void {
    const body = this.carrier.body as Phaser.Physics.Arcade.Body | null
    if (this.disposed || !body?.enable || !body.moves || !body.position || !body.prevFrame) return
    // Body.postUpdate applies this same collision-resolved delta to the carrier.
    this.resolvedMotion.capture(
      this.carrier.x + body.position.x - body.prevFrame.x,
      this.carrier.y + body.position.y - body.prevFrame.y,
    )
  }

  update(delta: number, paused: boolean, physics?: AnimationPhysicsFrame): void {
    if (this.disposed) return
    paused ||= this.paused
    const dx = this.carrier.x - this.previousX
    const dy = this.carrier.y - this.previousY
    this.previousX = this.carrier.x
    this.previousY = this.carrier.y
    if (!paused) this.timeline.tick(delta)
    if (this.disposed) return
    const distance = Math.hypot(dx, dy)
    const body = this.carrier.body as Phaser.Physics.Arcade.Body | null
    const physical = physics != null && body?.moves === true
    const sampled = !physical || physics.deltaMs > 0
    const movementDelta = physical ? physics.deltaMs : delta
    const resetMotion = distance >= 100 || !this.carrier.active || body?.enable === false || this.action === "defeat"
    if (resetMotion) this.resolvedMotion.reset(this.carrier.x, this.carrier.y)
    else if (!paused) {
      if (!physical || !physics.fixed) this.resolvedMotion.reset(this.carrier.x, this.carrier.y)
      else this.resolvedMotion.render(this.carrier.x, this.carrier.y, physics.alpha)
    }
    if (!paused && (sampled || resetMotion)) {
      this.moving = distance > 0.15 && !resetMotion
      this.motionSpeed = this.moving && movementDelta > 0 ? distance * 1000 / movementDelta : 0
    }
    const moving = this.moving
    const speed = this.motionSpeed
    if (!paused && !this.timeline.active && this.action !== "defeat") {
      this.facing = this.desiredFacing
      if (moving && sampled) this.face(dx, dy)
      const running = this.running || this.definition?.family !== "hero" && speed > 240
      const next = this.sustained ?? (moving ? running ? "run" : "walk" : "idle")
      if (next !== this.action) {
        const locomotion = (this.action === "walk" || this.action === "run") && (next === "walk" || next === "run")
        const phase = this.cycle % this.clip.duration / this.clip.duration
        this.action = next
        this.cycle = locomotion ? phase * this.clip.duration : 0
      }
    }
    const camera = this.scene.cameras.main.worldView
    const visible = this.originalVisible && this.carrier.x > camera.x - 240 && this.carrier.x < camera.right + 240 &&
      this.carrier.y > camera.y - 240 && this.carrier.y < camera.bottom + 240
    this.visual.setVisible(visible)
    this.shadow.setVisible(visible && this.action !== "defeat" && !this.swimming)
    if (!visible) { this.rig?.hide(); return }
    const { x: renderX, y: renderY } = this.renderPosition
    const footY = renderY + this.displayHeight * (1 - this.carrier.originY - 0.04)
    this.shadow.setPosition(renderX, footY).setDepth(this.carrier.depth - 0.1)
    this.visual.setPosition(renderX, this.ready ? footY : renderY).setDepth(this.carrier.depth)
    if (this.swimming) {
      if (!paused) this.swimElapsed += delta
      const lateral = this.facing === "right" ? 1 : this.facing === "left" ? -1 : 0
      this.visual.y += Math.sin(this.swimElapsed / 420) * 4
      this.visual.setAngle(lateral * (moving ? 22 : 8) + Math.sin(this.swimElapsed / 550) * 2)
      this.rig?.hide()
    }
    this.visual.setAlpha(this.carrier.alpha)
    this.visual.setTint(this.carrier.tintTopLeft, this.carrier.tintTopRight, this.carrier.tintBottomLeft, this.carrier.tintBottomRight)
    if (!this.ready || paused) {
      if (this.rig?.active) this.visual.setVisible(false)
      return
    }
    const clip = this.clip
    if (!this.timeline.active) this.cycle += delta * (moving ? Math.max(0.35, Math.min(2.5, speed / (this.running ? 240 : 150))) : 1)
    const elapsed = this.timeline.active ? this.timeline.elapsed : this.cycle
    const duration = this.timeline.active ? this.timeline.duration : clip.duration
    const index = clipFrameIndex(clip.frames.length, elapsed, duration, this.timeline.looping || clip.loop && !this.timeline.active, this.timeline.impactAt)
    const frame = clip.frames[index]!
    const texture = `${this.textureKey}${clip.sheet ? `:${clip.sheet}` : ""}`
    if (this.visual.texture.key !== texture || this.visual.frame.name !== String(frame)) this.visual.setTexture(texture, String(frame))
    const scale = this.action === "run" && clip.sheet === "motion" ? heroRunScale(this.assetKey, this.facing) : 1
    if (scale !== this.locomotionScale) {
      this.visual.setDisplaySize(this.atlasDisplayWidth * scale, this.atlasDisplayHeight * scale)
      this.locomotionScale = scale
    }
    // These offsets are visual only; a stunned boss cannot shift a collider.
    const rolling = this.action === "roll" && !this.specialReady || this.definition?.family === "roller" && ["walk", "run", "charge"].includes(this.action)
    const rollDirection = this.facing === "left" || this.facing === "up" ? -1 : 1
    if (!this.swimming) this.visual.setAngle(rolling ? rollDirection * elapsed * 0.7 : 0)
    if (!this.swimming && this.rig?.update(this.carrier, renderX, renderY, footY, this.atlasDisplayHeight, delta, this.facing, this.action, moving, resetMotion)) {
      this.visual.setVisible(false)
    }
    if (this.assetKey.startsWith("hero-") && this.carrier.name === "player") {
      const status = document.querySelector<HTMLElement>("#game-status")
      if (status) {
        status.dataset.playerAnimation = this.action
        status.dataset.playerFacing = this.facing
        status.dataset.playerFrame = String(frame)
        status.dataset.animationReady = String(this.ready)
      }
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.timeline.cancel()
    if (this.loadedListener) this.scene.load.off(`filecomplete-image-${this.textureKey}`, this.loadedListener)
    for (const [key, listener] of this.extraListeners) this.scene.load.off(`filecomplete-image-${key}`, listener)
    this.extraListeners.clear()
    this.carrier.off(Phaser.GameObjects.Events.DESTROY, this.dispose, this)
    if (this.carrier.active) this.carrier.setVisible(this.originalVisible)
    this.visual.destroy()
    this.shadow.destroy()
    this.rig?.dispose()
    this.system.members.delete(this)
    actors.delete(this.carrier)
    if (this.definition) release(this.scene, this.textureKey)
    if (this.definition?.utilitySheet) release(this.scene, `${this.textureKey}:utility`)
    if (this.definition?.actionsSheet) release(this.scene, `${this.textureKey}:actions`)
    if (this.definition?.specialSheet) release(this.scene, `${this.textureKey}:special`)
    if (this.definition?.motionSheet) release(this.scene, `${this.textureKey}:motion`)
    if (this.definition?.rigSheet) release(this.scene, `${this.textureKey}:rig`)
  }
}

export function attachActor(scene: Phaser.Scene, carrier: Carrier, assetKey = carrier.texture.key): AnimatedActor {
  return actors.get(carrier) ?? new AnimatedActor(scene, carrier, assetKey)
}

export function actorFor(carrier: Carrier): AnimatedActor | undefined { return actors.get(carrier) }

export function sceneActors(scene: Phaser.Scene): readonly AnimatedActor[] { return [...(systems.get(scene)?.members ?? [])] }
