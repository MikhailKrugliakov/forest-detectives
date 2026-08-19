import Phaser from "phaser"
import { gameStore } from "../domain/GameStore"
import { RESOURCES } from "../domain/resources"
import type { ResourceId, SurfaceResourceId } from "../domain/types"
import { FONT } from "./ui"

export interface RuntimeResourceNode {
  id: string
  resourceId: ResourceId
  x: number
  y: number
  marker: Phaser.GameObjects.Container
}

export function resourceIdFromObjectType(type: string): SurfaceResourceId | null {
  if (!type.startsWith("resource-")) return null
  const id = type.slice("resource-".length)
  return id === "stone" || id === "stick" || id === "rope" || id === "scrap" ? id : null
}

export function addResourceNode(
  scene: Phaser.Scene,
  id: string,
  resourceId: ResourceId,
  x: number,
  y: number,
): RuntimeResourceNode | null {
  if (gameStore.state.collectedResourceNodes.includes(id)) return null
  const resource = RESOURCES[resourceId]
  const glowColor = resourceId === "diamond" ? 0x78e7ff : resourceId === "iron" ? 0xb9c4c9 : 0xf3c969
  const glow = scene.add.circle(0, 4, resourceId === "diamond" ? 34 : 30, glowColor, 0.28)
  const icon = scene.add.text(0, 0, resource.icon, {
    fontFamily: FONT,
    fontSize: resourceId === "scrap" ? "39px" : resourceId === "diamond" ? "43px" : "38px",
  }).setOrigin(0.5)
  const marker = scene.add.container(x, y, [glow, icon]).setDepth(y + 18)
  scene.tweens.add({ targets: marker, y: y - 6, duration: 900, yoyo: true, repeat: -1 })
  return { id, resourceId, x, y, marker }
}

export function collectResourceNode(node: RuntimeResourceNode): boolean {
  const collected = gameStore.collectResource(node.id, node.resourceId)
  if (collected) node.marker.destroy(true)
  return collected
}

export function resourcePrompt(id: ResourceId): string {
  if (id === "iron" || id === "diamond") {
    return gameStore.state.hasPickaxe
      ? `E — добыть ${RESOURCES[id].name.toLowerCase()}`
      : "Нужна кирка • I — ресурсы"
  }
  return `E — подобрать ${RESOURCES[id].name.toLowerCase()}`
}
