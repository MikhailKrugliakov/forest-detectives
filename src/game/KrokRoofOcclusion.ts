import Phaser from "phaser"

// The backgrounds use an elevated view: roofs project over streets behind the
// houses. Replay those same pixels above actors, without altering the painting
// or adding physical obstacles to the road. Coordinates are in the 1536×1024 art.
const ROOFS = [
  { front: 400, points: [[135, 375], [145, 220], [165, 145], [190, 120], [225, 105], [225, 70], [295, 70], [295, 105], [500, 105], [500, 90], [545, 90], [545, 110], [610, 115], [655, 160], [675, 375]] },
  { front: 405, points: [[860, 385], [870, 215], [900, 160], [918, 122], [1030, 120], [1100, 90], [1210, 120], [1245, 120], [1245, 95], [1300, 95], [1300, 120], [1334, 120], [1380, 170], [1400, 385]] },
  { front: 860, points: [[125, 830], [140, 650], [160, 580], [190, 555], [248, 555], [248, 525], [298, 525], [298, 555], [402, 550], [418, 555], [603, 555], [650, 585], [680, 835]] },
  { front: 870, points: [[860, 835], [875, 675], [900, 580], [925, 555], [995, 555], [995, 525], [1040, 525], [1040, 555], [1240, 555], [1285, 505], [1300, 540], [1345, 555], [1390, 615], [1405, 850]] },
] as const

export class KrokRoofOcclusion {
  private readonly roofs: { image: Phaser.GameObjects.Image; shape: Phaser.Geom.Polygon }[] = []
  private readonly textureKeys = new Set<string>()

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const roof of this.roofs) roof.image.destroy()
      for (const key of this.textureKeys) scene.textures.remove(key)
      this.textureKeys.clear()
      this.roofs.length = 0
    })
  }

  addSector(key: string, x: number, y: number, width: number): void {
    const scale = width / 1536
    for (const [index, roof] of ROOFS.entries()) {
      const points = roof.points.map(([px, py]) => ({ x: x + px * scale, y: y + py * scale }))
      const shape = new Phaser.Geom.Polygon(points)
      const left = Math.min(...roof.points.map(([px]) => px))
      const top = Math.min(...roof.points.map(([, py]) => py))
      const right = Math.max(...roof.points.map(([px]) => px))
      const bottom = Math.max(...roof.points.map(([, py]) => py))
      const textureKey = `${key}-roof-${index}`
      if (!this.scene.textures.exists(textureKey)) {
        // Phaser 4 GeometryMask is Canvas-only. A small alpha texture works in
        // both renderers and is shared by the repeated neighborhood sectors.
        const texture = this.scene.textures.createCanvas(textureKey, right - left, bottom - top)!
        const context = texture.context
        context.beginPath()
        roof.points.forEach(([px, py], point) => point ? context.lineTo(px - left, py - top) : context.moveTo(px - left, py - top))
        context.closePath()
        context.clip()
        context.drawImage(this.scene.textures.get(key).getSourceImage() as HTMLImageElement, -left, -top)
        texture.refresh()
        this.textureKeys.add(textureKey)
      }
      const image = this.scene.add.image(x + left * scale, y + top * scale, textureKey).setOrigin(0).setScale(scale)
        .setDepth(y + roof.front * scale - 30)
      this.roofs.push({ image, shape })
    }
  }

  update(player: Phaser.Physics.Arcade.Image): void {
    const camera = this.scene.cameras.main.worldView
    const footY = player.y + player.displayHeight * .43
    for (const { image, shape } of this.roofs) {
      // Keep the hero readable when a roof hides their feet. The unchanged
      // base painting remains underneath, so this only dims the hidden actor.
      const behind = player.depth < image.depth && Phaser.Geom.Polygon.Contains(shape, player.x, footY)
      image.setAlpha(behind ? .65 : 1)
      image.setVisible(Phaser.Geom.Intersects.RectangleToRectangle(image.getBounds(), camera))
    }
  }
}
