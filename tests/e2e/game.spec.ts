import { expect, test, type Page } from "@playwright/test"

async function canvasPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const canvas = page.locator("canvas")
  const box = await canvas.boundingBox()
  if (!box) throw new Error("Canvas не найден")
  return {
    x: box.x + (x / 1280) * box.width,
    y: box.y + (y / 720) * box.height,
  }
}

async function hold(page: Page, keys: string[], milliseconds: number): Promise<void> {
  for (const key of keys) await page.keyboard.down(key)
  await page.waitForTimeout(milliseconds)
  for (const key of [...keys].reverse()) await page.keyboard.up(key)
}

async function waitForCharacterSelect(page: Page): Promise<void> {
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "main-menu")
  const newGame = await canvasPoint(page, 640, 298)
  await page.mouse.click(newGame.x, newGame.y)
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "character-select")
  await page.waitForTimeout(300)
}

test("выбор героя, движение и бег", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("canvas")).toBeVisible()
  await waitForCharacterSelect(page)

  const rabbitCard = await canvasPoint(page, 634, 400)
  await page.mouse.click(rabbitCard.x, rabbitCard.y)
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest")
  await expect(page.locator("#game-status")).toHaveAttribute("data-character", "rabbit")

  const before = await page.evaluate(() => window.__FOREST_GAME__?.store.state.stamina ?? 0)
  await hold(page, ["Shift", "d"], 550)
  const after = await page.evaluate(() => window.__FOREST_GAME__?.store.state.stamina ?? 0)
  expect(after).toBeLessThan(before)
})

test("Овцеволк проходит из деревни в Дикий лес и спасает жителей", async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto("/")
  await waitForCharacterSelect(page)
  const sheepwolfCard = await canvasPoint(page, 1140, 400)
  await page.mouse.click(sheepwolfCard.x, sheepwolfCard.y)
  await expect(page.locator("#game-status")).toHaveAttribute("data-character", "sheepwolf")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest")
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.character?.stats)).toEqual({
    strength: 5,
    agility: 7,
    endurance: 5,
    intelligence: 1,
  })

  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    game?.collectClue("parcel-print")
    game?.collectClue("ribbon")
    game?.collectClue("cardboard")
    game?.teleport(1305, 285)
  })
  const correctAnswer = await canvasPoint(page, 640, 465)
  // Asset decoding under the fully-parallel run can delay the first input
  // frame. Retry the real interaction until the answer has reached the store.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.waitForTimeout(180)
    await page.keyboard.press("e")
    await page.waitForTimeout(160)
    await page.mouse.click(correctAnswer.x, correctAnswer.y)
    await page.waitForTimeout(100)
    const completed = await page.evaluate(() => window.__FOREST_GAME__?.store.state.puzzle.completed)
    if (completed) break
  }
  await expect(page.locator("#game-status")).toHaveAttribute("data-completed", "true")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "case-complete")

  const villageButton = await canvasPoint(page, 520, 538)
  await page.mouse.click(villageButton.x, villageButton.y)
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "forest-village")
  await expect(status).toHaveAttribute("data-player-x", /20\d\d|21\d\d/)
  await expect(status).toHaveAttribute("data-player-y", /13\d\d|14\d\d/)

  for (const npc of [
    { x: 760, y: 470 },
    { x: 650, y: 1080 },
    { x: 1650, y: 470 },
    { x: 650, y: 1080 },
  ]) {
    await page.evaluate((point) => window.__FOREST_GAME__?.teleport(point.x, point.y), npc)
    await page.waitForTimeout(60)
    await page.keyboard.press("e")
    await page.waitForTimeout(60)
    const accept = await canvasPoint(page, 640, 480)
    await page.mouse.click(accept.x, accept.y)
    const close = await canvasPoint(page, 875, 548)
    await page.mouse.click(close.x, close.y)
  }

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(2280, 360))
  await page.waitForTimeout(60)
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "wild-forest")

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(390, 1220))
  await page.waitForTimeout(100)
  await page.keyboard.press("Space")
  await expect(page.locator("#game-status")).toHaveAttribute("data-enemies", "1")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(470, 1220))
  await page.waitForTimeout(80)
  await page.keyboard.press("e")

  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    game?.collectLetter("letter-1")
    game?.collectLetter("letter-2")
    game?.collectLetter("letter-3")
    for (const id of ["hare-2", "hare-3", "hare-4", "wolf-1", "wolf-2", "wolf-3", "boar-1", "boar-2", "boar-3"]) {
      game?.defeatEnemy(id)
    }
    for (const drop of game?.store.state.enemyGearDrops ?? []) game?.collectEnemyGearDrop(drop.id)
    for (const room of ["floor", "launchers", "gas", "battery"] as const) game?.completeBeaverRoom(room)
    game?.awardGears("e2e-jetpack", 2)
    game?.purchaseGadget("jetpack")
    game?.crossBeaverChasm()
    game?.completeBeaverRoom("control")
    game?.teleport(165, 1420)
  })
  await page.waitForTimeout(80)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "forest-village")
  await expect(status).toHaveAttribute("data-entry-from", "wild-forest")
  await expect(status).toHaveAttribute("data-player-x", /21\d\d|22\d\d/)
  await expect(status).toHaveAttribute("data-player-y", /4\d\d/)

  for (const npc of [
    { x: 760, y: 470, final: false },
    { x: 650, y: 1080, final: false },
    { x: 1650, y: 470, final: false },
    { x: 650, y: 1080, final: true },
  ]) {
    await page.evaluate((point) => window.__FOREST_GAME__?.teleport(point.x, point.y), npc)
    await page.waitForTimeout(60)
    await page.keyboard.press("e")
    await page.waitForTimeout(60)
    const submit = await canvasPoint(page, 640, 480)
    await page.mouse.click(submit.x, submit.y)
    if (!npc.final) {
      const close = await canvasPoint(page, 875, 548)
      await page.mouse.click(close.x, close.y)
    }
  }

  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "chapter-complete")
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.villageSaved)).toBe(true)
})

test("три поручения оплачивают реактивный ранец в магазине Крота", async ({ page }) => {
  await page.goto("/?scene=forest-village")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest-village")
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    game?.acceptErrand("garden-beds")
    for (const target of ["bed-1", "bed-2", "bed-3"]) game?.completeErrandTarget("garden-beds", target)
    game?.turnInErrand("garden-beds")
    game?.acceptErrand("bakery-delivery")
    for (const target of ["squirrel", "owl"]) game?.completeErrandTarget("bakery-delivery", target)
    game?.turnInErrand("bakery-delivery")
    game?.acceptErrand("village-lanterns")
    for (const target of ["lamp-1", "lamp-2", "lamp-3", "lamp-4"]) game?.completeErrandTarget("village-lanterns", target)
    game?.turnInErrand("village-lanterns")
    game?.teleport(1360, 700)
  })
  await expect(page.locator("#game-status")).toHaveAttribute("data-gears", "12")
  await page.waitForTimeout(80)
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "mole-shop")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(540, 330))
  await page.waitForTimeout(80)
  await page.keyboard.press("e")
  const buy = await canvasPoint(page, 745, 480)
  await page.mouse.click(buy.x, buy.y)
  await expect(page.locator("#game-status")).toHaveAttribute("data-gears", "0")
  await expect(page.locator("#game-status")).toHaveAttribute("data-gadget", "jetpack")
})

test("западный район деревни содержит трёх жителей с поручениями и наградами", async ({ page }) => {
  await page.goto("/?scene=forest-village&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "forest-village")
  const errands = [
    {
      npc: { x: -1760, y: 620 },
      targets: [{ x: -2150, y: 500 }, { x: -2050, y: 1320 }, { x: -750, y: 1180 }],
      reward: "mushroom-token",
    },
    {
      npc: { x: -650, y: 650 },
      targets: [{ x: -1350, y: 450 }, { x: -650, y: 950 }, { x: -1650, y: 1450 }],
      reward: "carpenter-ribbon",
    },
    {
      npc: { x: -1150, y: 1450 },
      targets: [{ x: -1100, y: 320 }, { x: -250, y: 750 }, { x: -450, y: 1300 }],
      reward: "trail-compass",
    },
  ] as const

  for (const errand of errands) {
    await page.evaluate((point) => window.__FOREST_GAME__?.teleport(point.x, point.y), errand.npc)
    await page.waitForTimeout(100)
    await page.keyboard.press("e")
    const accept = await canvasPoint(page, 640, 472)
    await page.mouse.click(accept.x, accept.y)
    await page.keyboard.press("Escape")
    for (const target of errand.targets) {
      await page.evaluate((point) => window.__FOREST_GAME__?.teleport(point.x, point.y), target)
      await page.waitForTimeout(70)
      await page.keyboard.press("e")
    }
    await page.evaluate((point) => window.__FOREST_GAME__?.teleport(point.x, point.y), errand.npc)
    await page.waitForTimeout(100)
    await page.keyboard.press("e")
    const submit = await canvasPoint(page, 640, 472)
    await page.mouse.click(submit.x, submit.y)
    await page.keyboard.press("Escape")
    expect(await page.evaluate((id) => window.__FOREST_GAME__?.store.state.inventory.some((item) => item.id === id), errand.reward)).toBe(true)
  }

  await expect(status).toHaveAttribute("data-gears", "12")
  await expect(status).toHaveAttribute("data-errands", "available,available,available,completed,completed,completed")
})

test("дороги деревни проходимы, а жители остаются препятствиями", async ({ page }) => {
  await page.goto("/?scene=forest-village&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "forest-village")

  // Главная западная дорога пересекает стык двух половин большой карты.
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(-60, 800))
  const roadStart = Number(await status.getAttribute("data-player-x"))
  await hold(page, ["d"], 2_000)
  await page.waitForTimeout(150)
  const roadEnd = Number(await status.getAttribute("data-player-x"))
  expect(roadEnd).toBeGreaterThan(roadStart + 60)
  expect(roadEnd).toBeGreaterThan(20)

  // У жителей есть только небольшой блокирующий контур у ног.
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(-1840, 620))
  await hold(page, ["d"], 1_500)
  await page.waitForTimeout(150)
  const blockedByResident = Number(await status.getAttribute("data-player-x"))
  expect(blockedByResident).toBeGreaterThan(-1830)
  expect(blockedByResident).toBeLessThan(-1790)
})

test("все пять домов героев открываются и выдают одноразовые награды", async ({ page }) => {
  await page.goto("/?scene=forest-village")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest-village")
  await page.waitForTimeout(300)
  const homes = [
    { location: "wolf-home", x: 260, y: 590, hero: "wolf" },
    { location: "fox-home", x: 1930, y: 680, hero: "fox" },
    { location: "rabbit-home", x: 830, y: 1480, hero: "rabbit" },
    { location: "sheepwolf-home", x: 1970, y: 1430, hero: "sheepwolf" },
  ] as const
  for (const home of homes) {
    await page.evaluate((point) => window.__FOREST_GAME__?.teleport(point.x, point.y), home)
    await page.waitForTimeout(70)
    await page.keyboard.press("e")
    await expect(page.locator("#game-status")).toHaveAttribute("data-screen", home.location)
    await page.evaluate((hero) => window.__FOREST_GAME__?.completeHomeChallenge(hero), home.hero)
    await page.evaluate(() => window.__FOREST_GAME__?.teleport(640, 720))
    await page.waitForTimeout(70)
    await page.keyboard.press("e")
    await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest-village")
  }
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(1440, 1500))
  await page.waitForTimeout(70)
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "melon-farm")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(1980, 1270))
  await page.waitForTimeout(70)
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "watermelon-home")
  await page.evaluate(() => window.__FOREST_GAME__?.completeHomeChallenge("watermelon"))
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(640, 720))
  await page.waitForTimeout(70)
  await page.keyboard.press("e")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "melon-farm")
  await expect(page.locator("#game-status")).toHaveAttribute("data-home-challenges", "5")
  await expect(page.locator("#game-status")).toHaveAttribute("data-gears", "10")
})

test("реактивный ранец обязателен для пульта дома Бобра", async ({ page }) => {
  await page.goto("/?scene=beaver-house")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "beaver-house")
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    for (const room of ["floor", "launchers", "gas", "battery"] as const) game?.completeBeaverRoom(room)
    game?.teleport(1670, 1050)
  })
  expect(await page.evaluate(() => window.__FOREST_GAME__?.completeBeaverRoom("control"))).toBe(false)
  await page.waitForTimeout(80)
  await page.keyboard.press("q")
  await expect(page.locator("#game-status")).toHaveAttribute("data-chasm-crossed", "true", { timeout: 2_000 })
  for (const point of [
    { x: 2210, y: 1160 },
    { x: 1990, y: 1160 },
    { x: 2320, y: 1160 },
    { x: 2100, y: 1160 },
  ]) {
    await page.evaluate((target) => window.__FOREST_GAME__?.teleport(target.x, target.y), point)
    await page.waitForTimeout(60)
    await page.keyboard.press("e")
  }
  await expect(page.locator("#game-status")).toHaveAttribute("data-beaver-rooms", "5")
})

test("Ферма тёти Дыни мирная, а Арбузик появляется на грядке", async ({ page }) => {
  await page.goto("/?scene=melon-farm&hero=watermelon")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "melon-farm")
  await expect(status).toHaveAttribute("data-character", "watermelon")
  await expect(status).toHaveAttribute("data-location", "melon-farm")
  await expect(status).toHaveAttribute("data-enemies", "0")
  await expect(status).toHaveAttribute("data-player-x", /12[5-9]\d/)
  await expect(status).toHaveAttribute("data-player-y", /7[0-8]\d/)

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(1980, 1270))
  await page.waitForTimeout(150)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "watermelon-home")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(640, 720))
  await page.waitForTimeout(120)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "melon-farm")
})

test("подсказки показываются справа, а реплики персонажей — внизу", async ({ page }) => {
  await page.goto("/?scene=melon-farm&hero=watermelon")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "melon-farm")
  await expect(status).toHaveAttribute("data-notification-placement", "right")
  await expect(status).toHaveAttribute("data-prompt-placement", "right")
  await expect(status).toHaveAttribute("data-controls-placement", "right")
  await expect(status).toHaveAttribute("data-dialogue-placement", "bottom")
  await expect(status).toHaveAttribute("data-last-notification", /На ферме/)
  await expect(status).toHaveAttribute("data-last-message-kind", "notification")

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(920, 770))
  await page.waitForTimeout(150)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-last-message-kind", "dialogue")
  await expect(status).toHaveAttribute("data-last-dialogue", /Арбуз Сеня/)
})

test("тётя Дыня продаёт овощи, а R переключает оружие", async ({ page }) => {
  await page.goto("/?scene=melon-farm&hero=watermelon")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "melon-farm")
  await page.evaluate(() => {
    window.__FOREST_GAME__?.awardGears("e2e-produce", 2)
    window.__FOREST_GAME__?.teleport(650, 590)
  })
  await page.waitForTimeout(150)
  await page.keyboard.press("e")
  const tomatoBuy = await canvasPoint(page, 470, 540)
  await page.mouse.click(tomatoBuy.x, tomatoBuy.y)
  await expect(status).toHaveAttribute("data-tomatoes", "2")
  const cucumberBuy = await canvasPoint(page, 810, 540)
  await page.mouse.click(cucumberBuy.x, cucumberBuy.y)
  await expect(status).toHaveAttribute("data-cucumbers", "2")
  await expect(status).toHaveAttribute("data-gears", "0")
  await page.keyboard.press("Escape")
  await page.keyboard.press("r")
  await expect(status).toHaveAttribute("data-weapon", "tomato")
  await page.keyboard.press("r")
  await expect(status).toHaveAttribute("data-weapon", "cucumber")
  await page.keyboard.press("r")
  await expect(status).toHaveAttribute("data-weapon", "melee")
})

test("четыре помидора обезвреживают обычного робозайца", async ({ page }) => {
  await page.goto("/?scene=wild-forest")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await expect(status).toHaveAttribute("data-active-enemies", "10")
  await expect(status).toHaveAttribute("data-enemy-ranks", /hare-1:weak.*wolf-1:normal.*boar-1:strong.*boar-3:boss/)
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    game?.awardGears("e2e-ammo", 2)
    game?.purchaseProduce("tomato")
    game?.purchaseProduce("tomato")
    game?.equipWeapon("tomato")
    game?.teleport(250, 1220)
  })
  await expect(status).toHaveAttribute("data-tomatoes", "4")
  for (let shot = 0; shot < 4; shot += 1) {
    await page.keyboard.press("Space")
    await page.waitForTimeout(500)
  }
  await expect(status).toHaveAttribute("data-enemies", "1")
  await expect(status).toHaveAttribute("data-active-enemies", "9")
  await expect(status).toHaveAttribute("data-enemy-respawns", /hare-1:/)
  await expect(status).toHaveAttribute("data-tomatoes", "0")
  await expect(status).toHaveAttribute("data-weapon", "melee")
})

test("слабый враг возвращается после дедлайна, а побеждённый босс — нет", async ({ page }) => {
  await page.goto("/?scene=forest-village&hero=fox")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "forest-village")
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    game?.store.defeatEnemy("hare-1", Date.now() - 30_100)
    game?.store.defeatEnemy("boar-3", Date.now())
    game?.acceptQuest("robot-sweep")
    game?.teleport(2280, 360)
  })
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await expect(status).toHaveAttribute("data-active-enemies", "9")
  await expect(status).toHaveAttribute("data-enemies", "2")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(390, 1220))
  await page.waitForTimeout(100)
  await page.keyboard.press("Space")
  await expect(status).toHaveAttribute("data-active-enemies", "8")
  await expect(status).toHaveAttribute("data-enemies", "3")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(470, 1220))
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-gears", "2")
  await expect(status).toHaveAttribute("data-enemy-gear-drops", "1")
})

test("лесной босс открывает Горную Лощину, где стражники вступают в бой фазами", async ({ page }) => {
  test.setTimeout(35_000)
  await page.goto("/?scene=wild-forest&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await expect(status).toHaveAttribute("data-mountain-unlocked", "false")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(2240, 850))
  await page.waitForTimeout(120)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")

  await page.evaluate(() => window.__FOREST_GAME__?.defeatEnemy("boar-3"))
  await expect(status).toHaveAttribute("data-mountain-unlocked", "true")
  await page.waitForTimeout(120)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "mountain-hollow")
  await expect(status).toHaveAttribute("data-player-x", /1\d\d|2\d\d/)
  await expect(status).toHaveAttribute("data-player-y", /7\d\d|8\d\d/)
  await expect(status).toHaveAttribute("data-active-mountain-enemies", "19")
  await expect(status).toHaveAttribute("data-mountain-phase", "axe")
  await expect(status).toHaveAttribute("data-mountain-ranks", /beetle-1:normal.*wasp-1:normal.*mantis-1:strong.*guardian-axe:boss.*guardian-flamethrower:boss/)

  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("guardian-axe", 12))
  await expect(status).toHaveAttribute("data-mountain-phase", "both")
  await expect(status).toHaveAttribute("data-active-mountain-enemies", "20")
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("guardian-axe", 12))
  await page.evaluate(() => window.__FOREST_GAME__?.damageEnemy("guardian-flamethrower", 22))
  await expect(status).toHaveAttribute("data-screen", "mountain-complete")
  await expect(status).toHaveAttribute("data-mountain-cleared", "true")
  await expect(status).toHaveAttribute("data-resources", /iron:4,diamond:2/)
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.inventory.some(({ id }) => id === "mountain-hollow-badge"))).toBe(true)
})

test("автосейв и ручной слот загружают Горную Лощину у входа", async ({ page }) => {
  test.setTimeout(35_000)
  await page.goto("/?scene=mountain-hollow&hero=fox")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "mountain-hollow")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(3000, 900))
  await page.keyboard.press("i")
  const savesTab = await canvasPoint(page, 985, 378)
  await page.mouse.click(savesTab.x, savesTab.y)
  await expect(status).toHaveAttribute("data-save-menu-open", "true")
  const saveFirstSlot = await canvasPoint(page, 755, 505)
  await page.mouse.click(saveFirstSlot.x, saveFirstSlot.y)
  await page.waitForTimeout(120)
  await page.keyboard.press("Escape")

  await page.goto("/")
  await expect(status).toHaveAttribute("data-screen", "main-menu")
  await expect(status).toHaveAttribute("data-save-slots", /auto:filled.*slot-1:filled/)
  const continueButton = await canvasPoint(page, 640, 225)
  await page.mouse.click(continueButton.x, continueButton.y)
  await expect(status).toHaveAttribute("data-screen", "mountain-hollow")
  await expect(status).toHaveAttribute("data-player-x", /1\d\d|2\d\d/)

  await page.goto("/")
  await expect(status).toHaveAttribute("data-screen", "main-menu")
  const loadFirstSlot = await canvasPoint(page, 840, 407)
  await page.mouse.click(loadFirstSlot.x, loadFirstSlot.y)
  await expect(status).toHaveAttribute("data-screen", "mountain-hollow")
  await expect(status).toHaveAttribute("data-player-x", /1\d\d|2\d\d/)

  await page.goto("/")
  await expect(status).toHaveAttribute("data-screen", "main-menu")
  const newGame = await canvasPoint(page, 640, 298)
  await page.mouse.click(newGame.x, newGame.y)
  await expect(status).toHaveAttribute("data-screen", "character-select")
  await expect(status).toHaveAttribute("data-save-slots", /auto:empty.*slot-1:filled/)
})

test("ресурсы позволяют создать кирку, найти случайный вход и добыть руду", async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto("/?scene=forest-village&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "forest-village")
  for (const point of [
    { x: -2220, y: 650 },
    { x: -760, y: 260 },
    { x: -280, y: 1130 },
    { x: -2100, y: 1430 },
    { x: -520, y: 780 },
    { x: -1030, y: 1330 },
    { x: -330, y: 470 },
  ]) {
    await page.evaluate((target) => window.__FOREST_GAME__?.teleport(target.x, target.y), point)
    await page.waitForTimeout(80)
    await page.keyboard.press("e")
  }
  await expect(status).toHaveAttribute("data-gears", "10")
  await expect(status).toHaveAttribute("data-resources", "stone:3,stick:2,rope:1,scrap:1,iron:0,diamond:0")

  await page.keyboard.press("i")
  const resourcesTab = await canvasPoint(page, 720, 378)
  await page.mouse.click(resourcesTab.x, resourcesTab.y)
  const craft = await canvasPoint(page, 870, 575)
  await page.mouse.click(craft.x, craft.y)
  await expect(status).toHaveAttribute("data-pickaxe", "true")
  await page.keyboard.press("Escape")

  await page.evaluate(() => {
    window.__FOREST_GAME__?.acceptQuest("robot-sweep")
    window.__FOREST_GAME__?.teleport(2280, 360)
  })
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  const entranceIndex = Number(await status.getAttribute("data-mine-entrance"))
  const entrances = [{ x: 355, y: 725 }, { x: 1310, y: 1060 }, { x: 2090, y: 930 }]
  await page.evaluate((target) => window.__FOREST_GAME__?.teleport(target.x, target.y), entrances[entranceIndex]!)
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "forest-mine")
  await expect(status).toHaveAttribute("data-mine-ores", "11")
  await expect(status).toHaveAttribute("data-mine-iron", "8")
  await expect(status).toHaveAttribute("data-mine-diamonds", "3")

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(470, 280))
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-mine-ores", "10")
  const oreCount = await page.evaluate(() => {
    const resources = window.__FOREST_GAME__?.store.state.resources
    return (resources?.iron ?? 0) + (resources?.diamond ?? 0)
  })
  expect(oreCount).toBe(1)
})

test("Бобр продаёт комплекты пола и стены", async ({ page }) => {
  await page.goto("/?scene=forest-village")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "forest-village")
  await page.evaluate(() => {
    window.__FOREST_GAME__?.awardGears("e2e-materials", 12)
    window.__FOREST_GAME__?.teleport(650, 1200)
  })
  await page.waitForTimeout(150)
  await page.keyboard.press("e")
  const firstBuy = await canvasPoint(page, 470, 545)
  await page.mouse.click(firstBuy.x, firstBuy.y)
  await expect(status).toHaveAttribute("data-building-materials", "collapsing-floor")
  const secondBuy = await canvasPoint(page, 810, 545)
  await page.mouse.click(secondBuy.x, secondBuy.y)
  await expect(status).toHaveAttribute("data-building-materials", "collapsing-floor,falling-wall")
  await expect(status).toHaveAttribute("data-gears", "0")
})

test("стены и пропасть дома Бобра блокируют обычное движение", async ({ page }) => {
  await page.goto("/?scene=beaver-house")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "beaver-house")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(840, 360))
  await hold(page, ["d"], 900)
  const wallX = Number(await status.getAttribute("data-player-x"))
  expect(wallX).toBeLessThan(875)

  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    for (const room of ["floor", "launchers", "gas", "battery"] as const) game?.completeBeaverRoom(room)
    game?.teleport(1690, 1050)
  })
  await hold(page, ["d"], 900)
  const chasmX = Number(await status.getAttribute("data-player-x"))
  expect(chasmX).toBeLessThan(1755)
  await page.keyboard.press("q")
  await expect(status).toHaveAttribute("data-chasm-crossed", "true", { timeout: 2_000 })
})

test("после поражения в Диком лесу герой двигается, а Esc закрывает инвентарь", async ({ page }) => {
  await page.goto("/?scene=forest-village&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "forest-village")
  await page.evaluate(() => {
    window.__FOREST_GAME__?.acceptQuest("robot-sweep")
    window.__FOREST_GAME__?.teleport(2280, 360)
  })
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await page.evaluate(() => {
    const game = window.__FOREST_GAME__
    const health = game?.store.state.health ?? 1
    game?.takeDamage(Math.max(0, health - 1))
    game?.teleport(390, 1220)
  })

  await expect(status).toHaveAttribute("data-screen", "forest-village", { timeout: 6_000 })
  const villageX = Number(await status.getAttribute("data-player-x"))
  await hold(page, ["d"], 500)
  const movedX = Number(await status.getAttribute("data-player-x"))
  expect(movedX).toBeGreaterThan(villageX + 20)

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(2280, 360))
  await page.waitForTimeout(100)
  await page.keyboard.press("e")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  const returnedForestX = Number(await status.getAttribute("data-player-x"))
  await hold(page, ["d"], 500)
  const returnedForestMovedX = Number(await status.getAttribute("data-player-x"))
  expect(returnedForestMovedX).toBeGreaterThan(returnedForestX + 20)

  const inventoryButton = await canvasPoint(page, 1175, 47)
  await page.mouse.click(inventoryButton.x, inventoryButton.y)
  await expect(status).toHaveAttribute("data-modal-open", "true")
  await page.waitForTimeout(100)
  await page.keyboard.press("Escape")
  await expect(status).toHaveAttribute("data-modal-open", "false")
  const afterInventoryX = Number(await status.getAttribute("data-player-x"))
  await hold(page, ["d"], 500)
  const afterEscapeX = Number(await status.getAttribute("data-player-x"))
  expect(afterEscapeX).toBeGreaterThan(afterInventoryX + 20)
})

test("инвентарь, три улики и правильный вывод", async ({ page }) => {
  await page.goto("/")
  await waitForCharacterSelect(page)
  const wolfCard = await canvasPoint(page, 175, 400)
  await page.mouse.click(wolfCard.x, wolfCard.y)
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "forest")

  const cluePositions = [
    { x: 583, y: 555 },
    { x: 905, y: 430 },
    { x: 1197, y: 280 },
  ]
  for (const position of cluePositions) {
    await page.evaluate((point) => window.__FOREST_GAME__?.teleport(point.x, point.y), position)
    await page.waitForTimeout(60)
    await page.keyboard.press("e")
    await page.waitForTimeout(60)
  }
  await expect(page.locator("#game-status")).toHaveAttribute("data-clues", "3")

  await page.keyboard.press("i")
  await page.waitForTimeout(100)
  const thinkButton = await canvasPoint(page, 898, 592)
  await page.mouse.click(thinkButton.x, thinkButton.y)
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.puzzle.hintsUsed)).toBe(1)
  await page.keyboard.press("Escape")

  await page.evaluate(() => window.__FOREST_GAME__?.teleport(1305, 285))
  await page.waitForTimeout(80)
  await page.keyboard.press("e")
  await page.waitForTimeout(120)

  const wrongAnswer = await canvasPoint(page, 640, 385)
  await page.mouse.click(wrongAnswer.x, wrongAnswer.y)
  expect(await page.evaluate(() => window.__FOREST_GAME__?.store.state.puzzle.selectedAnswer)).toBe("tree")

  const correctAnswer = await canvasPoint(page, 640, 465)
  await page.mouse.click(correctAnswer.x, correctAnswer.y)
  await expect(page.locator("#game-status")).toHaveAttribute("data-completed", "true")
  await expect(page.locator("#game-status")).toHaveAttribute("data-screen", "case-complete", {
    timeout: 3_000,
  })
})

test("лес и скалы вне дорог непроходимы в обеих боевых локациях", async ({ page }) => {
  await page.goto("/?scene=wild-forest&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(100, 100))
  await page.waitForTimeout(180)
  await expect(status).toHaveAttribute("data-player-on-road", "true")
  expect(Number(await status.getAttribute("data-player-x"))).toBeGreaterThan(150)
  expect(Number(await status.getAttribute("data-player-y"))).toBeGreaterThan(1200)

  await page.goto("/?scene=mountain-hollow&hero=sheepwolf")
  await expect(status).toHaveAttribute("data-screen", "mountain-hollow")
  await page.evaluate(() => window.__FOREST_GAME__?.teleport(400, 180))
  await page.waitForTimeout(180)
  await expect(status).toHaveAttribute("data-player-on-road", "true")
  expect(Number(await status.getAttribute("data-player-y"))).toBeGreaterThan(650)
})

test("герой и робозверь физически не проходят друг сквозь друга", async ({ page }) => {
  await page.goto("/?scene=wild-forest&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await expect(status).toHaveAttribute("data-enemy-positions", /hare-1:\d+:\d+/)
  const positions = await status.getAttribute("data-enemy-positions")
  const hare = positions?.split(",").find((entry) => entry.startsWith("hare-1:"))?.split(":").map(Number)
  expect(hare).toHaveLength(3)
  await page.evaluate(([x, y]) => window.__FOREST_GAME__?.teleport(x, y), [hare![1]!, hare![2]!] as [number, number])
  await expect(status).toHaveAttribute("data-enemy-player-collisions", /[1-9]\d*/)
  await expect(status).toHaveAttribute("data-player-on-road", "true")
})

test("клавиша T расходует зелье и лечит на 33 процента", async ({ page }) => {
  await page.goto("/?scene=wild-forest&hero=sheepwolf")
  const status = page.locator("#game-status")
  await expect(status).toHaveAttribute("data-screen", "wild-forest")
  await page.evaluate(() => window.__FOREST_GAME__?.takeDamage(60))
  await expect(status).toHaveAttribute("data-health", "40")
  await page.keyboard.press("t")
  await expect(status).toHaveAttribute("data-health", "73")
  await expect(status).toHaveAttribute("data-healing-potions", "2")
  await expect(status).toHaveAttribute("data-healing-potion-ready-at", /\d+/)

  await page.keyboard.press("t")
  await expect(status).toHaveAttribute("data-health", "100")
  await expect(status).toHaveAttribute("data-healing-potions", "1")
  await page.keyboard.press("t")
  await expect(status).toHaveAttribute("data-healing-potions", "1")
})
