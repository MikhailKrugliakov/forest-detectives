export type ScreenName =
  | "loading"
  | "character-select"
  | "main-menu"
  | "forest"
  | "case-complete"
  | "forest-village"
  | "wild-forest"
  | "mountain-hollow"
  | "mountain-complete"
  | "save-menu"
  | "forest-mine"
  | "melon-farm"
  | "chapter-complete"
  | "mole-shop"
  | "beaver-house"
  | "wolf-home"
  | "fox-home"
  | "rabbit-home"
  | "watermelon-home"
  | "sheepwolf-home"

export function updateGameStatus(screen: ScreenName, message: string): void {
  const status = document.querySelector<HTMLElement>("#game-status")
  if (!status) {
    return
  }
  status.dataset.screen = screen
  status.textContent = message
}
