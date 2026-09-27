import Phaser from "phaser"
import { ACTOR_ACTIONS, ACTOR_CATALOG, FACINGS, type ActorAction, type FacingDirection } from "../animation/catalog"
import { attachActor, type AnimatedActor } from "../animation/AnimatedActor"

/** Development-only, uses exactly the world renderer and project-bound atlases. */
export class AnimationGalleryScene extends Phaser.Scene {
  private actor: AnimatedActor | null = null
  private carrier: Phaser.GameObjects.Image | null = null
  private controls: HTMLElement | null = null
  private caption!: Phaser.GameObjects.Text
  private previews: Phaser.GameObjects.Sprite[] = []
  private key = "hero-sheepwolf"
  private action: ActorAction = "walk"
  private facing: FacingDirection = "down"
  private frozen = false
  private previewSignature = ""
  private movingPreview = false

  constructor() { super("animation-gallery") }

  preload(): void {
    for (const entry of ACTOR_CATALOG) {
      if (!this.textures.exists(entry.key)) this.load.image(entry.key, entry.source)
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#203d45")
    const grid = this.add.graphics().lineStyle(1, 0x7aa89d, 0.2)
    for (let x = 0; x <= 1280; x += 40) grid.lineBetween(x, 120, x, 680)
    for (let y = 120; y <= 680; y += 40) grid.lineBetween(0, y, 1280, y)
    this.add.text(32, 90, "Animation workshop · world sprites / fixed physical anchor", { fontSize: "20px", color: "#e6f7de" })
    this.add.rectangle(640, 430, 130, 3, 0xf7cb70)
    this.caption = this.add.text(32, 465, "", { fontSize: "18px", color: "#f6efda" })
    this.controls = document.createElement("section")
    this.controls.setAttribute("aria-label", "Animation gallery")
    this.controls.style.cssText = "position:fixed;top:12px;left:2%;right:2%;z-index:1000;display:flex;gap:12px;flex-wrap:wrap;padding:12px;background:#f8f2d9;color:#183f38;border-radius:8px;font:16px sans-serif"
    this.controls.append(
      this.select("Actor", ACTOR_CATALOG.map(({ key }) => key), this.key, (value) => { this.key = value; this.showActor() }),
      this.select("Action", [...ACTOR_ACTIONS], this.action, (value) => { this.action = value as ActorAction; this.play() }),
      this.select("Facing", [...FACINGS], this.facing, (value) => { this.facing = value as FacingDirection; this.play() }),
    )
    const pause = document.createElement("button")
    pause.textContent = "Pause / resume"
    pause.onclick = () => { this.frozen = !this.frozen; if (this.actor) this.actor.paused = this.frozen }
    const replay = document.createElement("button")
    replay.textContent = "Replay"
    replay.onclick = () => { this.frozen = false; this.play() }
    const moving = document.createElement("label")
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.onchange = () => { this.movingPreview = checkbox.checked; this.play() }
    moving.append(checkbox, " Moving action")
    this.controls.append(pause, replay, moving)
    document.body.append(this.controls)
    this.showActor()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls?.remove()
      this.controls = null
    })
  }

  private select(label: string, values: string[], selected: string, change: (value: string) => void): HTMLLabelElement {
    const element = document.createElement("label")
    element.append(`${label}: `)
    const select = document.createElement("select")
    select.setAttribute("aria-label", label)
    for (const value of values) select.add(new Option(value, value, false, value === selected))
    select.onchange = () => change(select.value)
    element.append(select)
    return element
  }

  private showActor(): void {
    this.actor?.dispose()
    this.carrier?.destroy()
    this.carrier = this.add.image(640, 275, this.key).setDisplaySize(210, 290).setName("gallery")
    this.actor = attachActor(this, this.carrier)
    this.play()
  }

  private play(): void {
    if (!this.actor) return
    this.actor.previewMoving = this.movingPreview
    const clip = this.actor.getClip(this.action, this.facing)
    this.actor.paused = this.frozen
    this.actor.play(this.action, { facing: this.facing, duration: clip.duration, loop: true })
    for (const preview of this.previews) preview.destroy()
    this.previews = []
    this.previewSignature = ""
  }

  update(): void {
    if (!this.actor) return
    const clip = this.actor.clip
    const articulated = this.actor.gaitSnapshot?.active === true
    this.caption.setText(`${this.key} · ${this.action} · ${this.facing}\n${articulated ? "Continuous articulated gait · independently moving left / right feet" : this.actor.ready ? `${clip.frames.length} frames · ${clip.duration} ms` : "Loading atlas…"}`)
    const signature = articulated ? `rig:${this.key}:${this.facing}` : `${this.actor.visual.texture.key}:${clip.frames.join(",")}`
    if (this.actor.ready && signature !== this.previewSignature) {
      for (const preview of this.previews) preview.destroy()
      this.previews = articulated ? [] : clip.frames.map((frame, index) => this.add.sprite(100 + index * 150, 610, this.actor!.visual.texture.key, String(frame))
        .setDisplaySize(112, 112).setDepth(5))
      this.previewSignature = signature
    }
    const status = document.querySelector<HTMLElement>("#game-status")
    if (status) {
      status.textContent = `Animation gallery: ${this.key}, ${this.action}, ${this.facing}`
      status.dataset.screen = "animation-gallery"
      status.dataset.animationActor = this.key
      status.dataset.animationAction = this.action
      status.dataset.animationFacing = this.facing
      status.dataset.animationReady = String(this.actor.ready)
      status.dataset.animationFrame = String(this.actor.visual.frame.name)
      status.dataset.animationTexture = this.actor.visual.texture.key
    }
  }
}
