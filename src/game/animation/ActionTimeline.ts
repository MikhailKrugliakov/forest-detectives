/** Scene-time action clock. Deliberately independent of Phaser and wall time. */
export interface ActionMarker {
  at: number
  callback: () => void
}

export interface ActionOptions {
  duration?: number
  impactAt?: number
  onImpact?: () => void
  markers?: readonly ActionMarker[]
  onComplete?: () => void
  onCancel?: () => void
  loop?: boolean
}

export class ActionTimeline {
  elapsed = 0
  duration = 0
  active = false
  private generation = 0
  private markers: ActionMarker[] = []
  private options: ActionOptions = {}

  get looping(): boolean { return this.active && this.options.loop === true }
  get impactAt(): number | undefined {
    return this.options.onImpact ? this.options.impactAt ?? 120 : undefined
  }

  start(options: ActionOptions, defaultDuration = 450): void {
    this.cancel()
    this.elapsed = 0
    this.duration = Math.max(1, options.duration ?? defaultDuration)
    this.options = options
    this.active = true
    this.markers = [...(options.markers ?? [])]
    if (options.onImpact) this.markers.push({ at: options.impactAt ?? 120, callback: options.onImpact })
    this.markers.sort((a, b) => a.at - b.at)
  }

  tick(delta: number, paused = false): void {
    if (!this.active || paused) return
    const generation = this.generation
    this.elapsed += Math.max(0, delta)
    while (this.markers.length && this.markers[0]!.at <= this.elapsed) {
      const marker = this.markers.shift()!
      marker.callback()
      // A callback can kill the actor, start another action or change scenes.
      if (!this.active || this.generation !== generation) return
    }
    if (this.elapsed < this.duration || this.options.loop) return
    const complete = this.options.onComplete
    this.active = false
    this.markers = []
    this.options = {}
    complete?.()
  }

  cancel(): void {
    const cancel = this.active ? this.options.onCancel : undefined
    this.generation++
    this.active = false
    this.markers = []
    this.options = {}
    cancel?.()
  }
}
