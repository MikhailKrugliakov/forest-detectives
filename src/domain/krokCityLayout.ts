import type { RoadCollisionRect, RoadSegment } from "./roads"

/** Painted neighbourhoods share street/plot boundaries, with architecture,
 * courtyards and lighting integrated into each background. Never mirror them. */
export const KROK_CITY_SECTOR_SIZE = { width: 2400, height: 1600 } as const

/** All city streets are axis-aligned and extend to world boundaries. */
export function krokStreetRectangle(segment: RoadSegment): RoadCollisionRect {
  const vertical = segment.from.x === segment.to.x
  return {
    x: Math.min(segment.from.x, segment.to.x) - (vertical ? segment.halfWidth : 0),
    y: Math.min(segment.from.y, segment.to.y) - (vertical ? 0 : segment.halfWidth),
    width: vertical ? segment.halfWidth * 2 : Math.abs(segment.to.x - segment.from.x),
    height: vertical ? Math.abs(segment.to.y - segment.from.y) : segment.halfWidth * 2,
  }
}

export const KROK_CITY_PLOTS = [
  { id: "nw", art: { x: 300, y: 240, width: 660, height: 400 }, solid: { x: 430, y: 440, width: 400, height: 200 } },
  { id: "ne", art: { x: 1440, y: 240, width: 660, height: 400 }, solid: { x: 1570, y: 440, width: 400, height: 200 } },
  { id: "sw", art: { x: 300, y: 960, width: 660, height: 400 }, solid: { x: 430, y: 1160, width: 400, height: 200 } },
  { id: "se", art: { x: 1440, y: 960, width: 660, height: 400 }, solid: { x: 1570, y: 1160, width: 400, height: 200 } },
] as const

export const KROK_CITY_SECTORS = [
  { name: "Старые ворота", background: "crafts" },
  { name: "Тихий квартал", background: "residential" },
  { name: "Северный рынок", background: "market" },
  { name: "Дворцовая улица", background: "royal" },
  { name: "Садовый квартал", background: "residential" },
  { name: "Квартал мастеров", background: "crafts" },
  { name: "Южный рынок", background: "market" },
  { name: "Сады Принца", background: "royal" },
] as const

export const KROK_CITY_BUILDINGS = KROK_CITY_SECTORS.flatMap((_, index) => {
  const x = index % 4 * KROK_CITY_SECTOR_SIZE.width
  const y = Math.floor(index / 4) * KROK_CITY_SECTOR_SIZE.height
  return KROK_CITY_PLOTS.map((plot) => ({
    id: `sector-${index}-${plot.id}`,
    art: { ...plot.art, x: x + plot.art.x, y: y + plot.art.y },
    solid: { ...plot.solid, x: x + plot.solid.x, y: y + plot.solid.y },
  }))
})

export interface KrokResidentDefinition { name: string; lines: readonly string[] }
export const KROK_RESIDENTS: Readonly<Record<string, KrokResidentDefinition>> = {
  "west-resident": { name: "Садовница Ива", lines: ["Ива: За домом зимуют розы. Весной весь переулок будет в цветах.", "Ива: Здесь, у садовой улицы, намного тише рынка."] },
  "north-resident": { name: "Каменщик Тар", lines: ["Тар: Проверяю крыльцо: ни одна ступенька не должна шататься.", "Тар: Верхняя улица ведёт к кузнецу. По ней теперь можно пройти весь город."] },
  "market-resident": { name: "Ткачиха Нела", lines: ["Нела: Несу домой тёплую ткань. Для зимы нужен двойной шов.", "Нела: Аптека находится на нижней рыночной улице."] },
  "east-resident": { name: "Часовщик Тик", lines: ["Тик: Часы в моём доме идут точно. Даже в такую стужу.", "Тик: К Принцу можно пройти и верхними, и нижними улицами."] },
  "gate-resident": { name: "Почтальон Рун", lines: ["Рун: Забираю письма у соседей, потом вернусь к воротам.", "Рун: У каждого дома здесь свой адрес — даже у самого маленького."] },
  "garden-resident": { name: "Травница Мира", lines: ["Мира: Проверю теплицу и загляну к соседям.", "Мира: Под снегом травы спят. Не торопи весну."] },
  "baker-resident": { name: "Пекарь Корж", lines: ["Корж: Дома уже поднимается тесто. Хватит на всю улицу!", "Корж: Люблю пройтись после выпечки. Морозный воздух бодрит."] },
  "scribe-resident": { name: "Переписчик Лист", lines: ["Лист: Из архива принесли новую карту. Проверяю на ней каждый переулок.", "Лист: Если заблудишься, найди широкую поперечную улицу."] },
  "bell-resident": { name: "Музыкант Лад", lines: ["Лад: Репетирую дома потише, чтобы не мешать соседям.", "Лад: На площади устроим концерт, когда вернётся тепло."] },
  "orchard-resident": { name: "Цветочница Роса", lines: ["Роса: У моего дома цветы даже зимой — в горшках, у окна.", "Роса: Садовая улица соединяется с нижней дорогой. Загляни к нам ещё."] },
  "potter-resident": { name: "Гончар Глин", lines: ["Глин: Оставил чашки остывать и вышел размять ноги.", "Глин: За углом мастерская. Соседи всегда заходят за новой кружкой."] },
  "canal-resident": { name: "Лодочник Вёс", lines: ["Вёс: Пока вода подо льдом, чиню дома вёсла.", "Вёс: Здесь начинается тихая нижняя улица, вдали от караула."] },
}
