import Phaser from "phaser"

export const COLORS = {
  ink: 0x173f38,
  cream: 0xfff4cf,
  paper: 0xfffbeb,
  leaf: 0x4f8b62,
  leafDark: 0x285746,
  yellow: 0xf3c969,
  coral: 0xe97a65,
  blue: 0x5b9bd5,
  shadow: 0x0c2b25,
} as const

export const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", sans-serif'

export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number = COLORS.paper,
  alpha = 1,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics()
  graphics.fillStyle(COLORS.shadow, 0.25)
  graphics.fillRoundedRect(x + 8, y + 10, width, height, 22)
  graphics.fillStyle(color, alpha)
  graphics.fillRoundedRect(x, y, width, height, 22)
  graphics.lineStyle(4, COLORS.ink, 0.9)
  graphics.strokeRoundedRect(x, y, width, height, 22)
  return graphics
}

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  color: number = COLORS.leaf,
  fontSize = "22px",
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, width, height, color, 1)
  background.setStrokeStyle(3, COLORS.ink, 0.95)
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize,
      fontStyle: "bold",
      color: "#fff8dc",
      align: "center",
    })
    .setOrigin(0.5)

  const container = scene.add.container(x, y, [background, text])
  container.setSize(width, height)
  container.setInteractive({ useHandCursor: true })
  container.on("pointerover", () => background.setFillStyle(Phaser.Display.Color.IntegerToColor(color).brighten(12).color))
  container.on("pointerout", () => background.setFillStyle(color))
  container.on("pointerdown", () => container.setScale(0.97))
  container.on("pointerup", () => {
    container.setScale(1)
    onClick()
  })
  return container
}
