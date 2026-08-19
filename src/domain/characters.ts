import type { CharacterDefinition, CharacterId } from "./types"

export const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: "wolf",
    name: "Волчонок",
    subtitle: "Смелый следопыт",
    description: "Надёжный и сильный сыщик. Никогда не бросает друзей в беде.",
    stats: { strength: 8, agility: 5, endurance: 8, intelligence: 5 },
    equipment: {
      id: "steel-lasso",
      name: "Стальное лассо",
      description: "Прочное лассо. Его особое действие откроется в следующей главе.",
      icon: "➰",
    },
    ability: "Мастер лассо",
    assetKey: "hero-wolf",
    accent: 0x4ba3a3,
  },
  {
    id: "fox",
    name: "Лисичка",
    subtitle: "Проницательная сыщица",
    description: "Замечает необычные детали и быстро находит связь между уликами.",
    stats: { strength: 4, agility: 8, endurance: 6, intelligence: 8 },
    equipment: {
      id: "mirror",
      name: "Серебряное зеркальце",
      description: "Ослепляет врагов и отражает выстрелы. Пока хранится в инвентаре.",
      icon: "🪞",
    },
    ability: "Зеркальный отблеск",
    assetKey: "hero-fox",
    accent: 0xe6754e,
  },
  {
    id: "rabbit",
    name: "Зайчонок",
    subtitle: "Самый умный и быстрый",
    description: "Очень наблюдательный, ловкий и готов перепрыгнуть любую преграду.",
    stats: { strength: 3, agility: 10, endurance: 6, intelligence: 10 },
    equipment: {
      id: "detective-bag",
      name: "Сумка сыщика",
      description: "Лёгкая сумка для важных находок и записей о расследовании.",
      icon: "🎒",
    },
    ability: "Высокий прыжок",
    assetKey: "hero-rabbit",
    accent: 0x5a8ed2,
  },
  {
    id: "watermelon",
    name: "Арбузик",
    subtitle: "Неуловимый оригинал",
    description: "Живой арбуз в солнечных очках. Удивительно ловкий и невозмутимый.",
    stats: { strength: 3, agility: 9, endurance: 5, intelligence: 5 },
    equipment: {
      id: "steel-fan",
      name: "Стальной веер",
      description: "Блестящий боевой веер. Его особое действие появится позднее.",
      icon: "🪭",
    },
    ability: "Стальной вихрь",
    assetKey: "hero-watermelon",
    accent: 0x6ead55,
  },
  {
    id: "sheepwolf",
    name: "Овцеволк",
    subtitle: "Добрый ловкач",
    description: "Пушистый ретривер в бейсболке. Смелый, быстрый и немного простодушный.",
    stats: { strength: 5, agility: 7, endurance: 5, intelligence: 1 },
    equipment: {
      id: "sturdy-bat",
      name: "Крепкая бита",
      description: "Надёжная деревянная бита для меткого бейсбольного замаха.",
      icon: "🏏",
    },
    ability: "Бейсбольный замах",
    assetKey: "hero-sheepwolf",
    accent: 0xd6aa55,
  },
] as const

export function getCharacter(id: CharacterId): CharacterDefinition {
  const character = CHARACTERS.find((candidate) => candidate.id === id)
  if (!character) {
    throw new Error(`Неизвестный герой: ${id}`)
  }
  return character
}
