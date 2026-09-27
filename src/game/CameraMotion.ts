/** Preserve the original 60 Hz camera feel on displays with other refresh rates. */
export function cameraFollowLerp(deltaMs: number, paused = false): number {
  if (paused || !Number.isFinite(deltaMs) || deltaMs <= 0) return 0
  return 1 - Math.pow(1 - 0.09, deltaMs / (1000 / 60))
}
