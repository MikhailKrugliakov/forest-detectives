import Phaser from "phaser"

const ART_WIDTH = 1536, ART_HEIGHT = 1024, EDGE = 48
export interface StreetPixels { width: number; height: number; data: Uint8ClampedArray }
const fade = (position: number, length: number) => {
  const t = position / (length - 1)
  return t * t * (3 - 2 * t)
}

/** Mirror neighboring edge pixels, then crossfade. The outermost pixels stay exact. */
export function blendStreetPatch(parts: readonly StreetPixels[], columns: 1 | 2, rows: 1 | 2): StreetPixels {
  const cell = parts[0]!
  const width = cell.width * columns, height = cell.height * rows
  const data = new Uint8ClampedArray(width * height * 4)
  const mirror = (p: number, size: number, side: number) => side ? p < size ? size - 1 - p : p - size : Math.min(p, size * 2 - 1 - p)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const wx = columns === 2 ? fade(x, width) : 0, wy = rows === 2 ? fade(y, height) : 0
    for (let channel = 0; channel < 4; channel++) {
      let color = 0
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const px = columns === 2 ? mirror(x, cell.width, column) : x
        const py = rows === 2 ? mirror(y, cell.height, row) : y
        const weight = (column ? wx : 1 - wx) * (row ? wy : 1 - wy)
        color += parts[row * columns + column]!.data[(py * cell.width + px) * 4 + channel]! * weight
      }
      data[(y * width + x) * 4 + channel] = Math.round(color)
    }
  }
  return { width, height, data }
}

/** Narrow street-only overlays. No full-city canvas, artwork edits, or physics. */
export class KrokStreetSeams {
  private readonly images: Phaser.GameObjects.Image[] = []
  private readonly owned = new Set<string>()
  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const image of this.images) image.destroy()
      for (const key of this.owned) scene.textures.remove(key)
      this.images.length = 0
      this.owned.clear()
    })
  }

  addSectorStreets(keys: readonly string[], columns = 4, width = 2400, height = 1600): void {
    const rows = Math.ceil(keys.length / columns), sx = width / ART_WIDTH, sy = height / ART_HEIGHT
    const samples = new Map<string, StreetPixels>()
    const crop = (key: string, x: number, y: number, w: number, h: number): StreetPixels => {
      const id = `${key}:${x}:${y}:${w}:${h}`
      let pixels = samples.get(id)
      if (!pixels) {
        const canvas = document.createElement("canvas")
        canvas.width = w; canvas.height = h
        const context = canvas.getContext("2d", { willReadFrequently: true })!
        context.drawImage(this.scene.textures.get(key).getSourceImage() as CanvasImageSource, x, y, w, h, 0, 0, w, h)
        pixels = context.getImageData(0, 0, w, h)
        samples.set(id, pixels)
      }
      return pixels
    }
    const paint = (id: string, parts: () => StreetPixels[], cols: 1 | 2, count: 1 | 2, x: number, y: number) => {
      const key = `krok-street-seam:${id}`
      if (!this.scene.textures.exists(key)) {
        const pixels = blendStreetPatch(parts(), cols, count)
        const texture = this.scene.textures.createCanvas(key, pixels.width, pixels.height)!
        const imageData = texture.context.createImageData(pixels.width, pixels.height)
        imageData.data.set(pixels.data)
        texture.context.putImageData(imageData, 0, 0)
        texture.refresh()
        this.owned.add(key)
      }
      this.images.push(this.scene.add.image(x, y, key).setOrigin(0).setScale(sx, sy).setDepth(-1))
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns - 1; column++) {
      const left = keys[row * columns + column], right = keys[row * columns + column + 1]
      if (!left || !right) continue
      paint(`v:${left}:${right}`, () => [crop(left, ART_WIDTH - EDGE, 0, EDGE, ART_HEIGHT), crop(right, 0, 0, EDGE, ART_HEIGHT)], 2, 1,
        (column + 1) * width - EDGE * sx, row * height)
    }
    for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns; column++) {
      const top = keys[row * columns + column], bottom = keys[(row + 1) * columns + column]
      if (!top || !bottom) continue
      paint(`h:${top}:${bottom}`, () => [crop(top, 0, ART_HEIGHT - EDGE, ART_WIDTH, EDGE), crop(bottom, 0, 0, ART_WIDTH, EDGE)], 1, 2,
        column * width, (row + 1) * height - EDGE * sy)
    }
    // Four-way patches replace the strip overlaps; their borders equal the
    // neighboring one-axis blends exactly, including at the three crossings.
    for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns - 1; column++) {
      const a = keys[row * columns + column], b = keys[row * columns + column + 1]
      const c = keys[(row + 1) * columns + column], d = keys[(row + 1) * columns + column + 1]
      if (!a || !b || !c || !d) continue
      paint(`xy:${a}:${b}:${c}:${d}`, () => [crop(a, ART_WIDTH - EDGE, ART_HEIGHT - EDGE, EDGE, EDGE),
        crop(b, 0, ART_HEIGHT - EDGE, EDGE, EDGE), crop(c, ART_WIDTH - EDGE, 0, EDGE, EDGE), crop(d, 0, 0, EDGE, EDGE)], 2, 2,
        (column + 1) * width - EDGE * sx, (row + 1) * height - EDGE * sy)
    }
  }
}
