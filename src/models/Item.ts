import raritiesData from '../../data/rarities.json';
import itemsConfig from '../../data/items.json';

// Типы редкости предметов (из JSON)
export type Rarity = 'common' | 'good' | 'rare' | 'epic' | 'mythic' | 'legendary' | 'immortal';

// Слоты экипировки
export type SlotType = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'shoes' | 'magic' | 'ring' | 'amulet' | 'pants' | 'cloak' | 'artefact' | 'belt';

// Конфигурация слотов из JSON
interface SlotConfig {
    unlockStage: number;
    hpRatio: number;
    damageRatio: number;
}

const slotsConfig = itemsConfig.slots as Record<SlotType, SlotConfig>;

// Все слоты в порядке разблокировки
export const SLOT_TYPES: SlotType[] = Object.keys(slotsConfig) as SlotType[];

// Получить разблокированные слоты для данной стадии
export function getUnlockedSlots(currentStage: number): SlotType[] {
    return SLOT_TYPES.filter(slot => slotsConfig[slot].unlockStage <= currentStage);
}

// Получить unlockStage для слота
export function getSlotUnlockStage(slot: SlotType): number {
    return slotsConfig[slot].unlockStage;
}

export const SLOT_NAMES: Record<SlotType, string> = {
    weapon: '⚔️ Оружие',
    helmet: '🪖 Шлем',
    armor: '🛡️ Броня',
    gloves: '🧤 Перчатки',
    shoes: '👢 Обувь',
    magic: '🔮 Магия',
    ring: '💍 Кольцо',
    amulet: '📿 Амулет',
    pants: '👖 Штаны',
    cloak: '🧥 Плащ',
    artefact: '🏺 Артефакт',
    belt: '🎗️ Пояс'
};

// Загружаем редкости из JSON
interface RarityConfig {
    id: string;
    name: string;
    nameRu: string;
    color: string;
    multiplier: number;
}

const rarities: RarityConfig[] = raritiesData as RarityConfig[];

// Генерируем RARITY_COLORS из JSON
export const RARITY_COLORS: Record<Rarity, string> = Object.fromEntries(
    rarities.map(r => [r.id, r.color])
) as Record<Rarity, string>;

// Генерируем множители из JSON
export const RARITY_MULTIPLIERS: Record<Rarity, number> = Object.fromEntries(
    rarities.map(r => [r.id, r.multiplier])
) as Record<Rarity, number>;

// Русские названия редкостей
export const RARITY_NAMES_RU: Record<Rarity, string> = Object.fromEntries(
    rarities.map(r => [r.id, r.nameRu])
) as Record<Rarity, string>;

// Порядок редкостей (для сравнения)
export const RARITY_ORDER: Rarity[] = rarities.map(r => r.id) as Rarity[];

// Экспорт данных редкостей
export function getRarities(): RarityConfig[] {
    return rarities;
}

export interface Item {
    id: string;
    name: string;
    rarity: Rarity;
    level: number;
    power: number;  // Сохраняем для обратной совместимости (сумма hp + damage)
    hp: number;     // Бонус к HP
    damage: number; // Бонус к урону
    slot: SlotType;
}

// Какие слоты дают какие статы (в процентах от power) - из items.json
export const SLOT_STAT_RATIOS: Record<SlotType, { hpRatio: number; damageRatio: number }> = Object.fromEntries(
    SLOT_TYPES.map(slot => [slot, { hpRatio: slotsConfig[slot].hpRatio, damageRatio: slotsConfig[slot].damageRatio }])
) as Record<SlotType, { hpRatio: number; damageRatio: number }>;

// Генерация ID
export function generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Генерация уровня предмета (от dungeonChapter - offset до dungeonChapter)
// isMaxRarity — если true, используется maxRarityLevelOffset (меньший разброс для топовых вещей)
export function rollItemLevel(dungeonChapter: number, isMaxRarity: boolean = false): number {
    const offset = isMaxRarity
        ? (itemsConfig.levelRange as { minLevelOffset: number; maxRarityLevelOffset: number }).maxRarityLevelOffset
        : itemsConfig.levelRange.minLevelOffset;
    const minLevel = Math.max(1, dungeonChapter - offset);
    return Math.floor(Math.random() * (dungeonChapter - minLevel + 1)) + minLevel;
}

// Расчёт статов предмета с учётом effectivePower = hp + 4*dmg
// Генерирует статы так, чтобы effectivePower попадал в targetPower ± 15%
export function calculateItemStats(
    slot: SlotType,
    level: number,
    rarity: Rarity
): { hp: number; damage: number; power: number } {
    const ratios = SLOT_STAT_RATIOS[slot];

    // Target power от уровня и редкости (экспоненциальный рост)
    const growthRate = itemsConfig.powerGrowthPerLevel;
    const targetPower = itemsConfig.basePowerPerLevel * Math.pow(growthRate, level - 1) * RARITY_MULTIPLIERS[rarity];

    // Вариация (из items.json, по умолчанию ±15%)
    const varianceRange = itemsConfig.powerVariance ?? 0.15;
    const variance = (1 - varianceRange) + Math.random() * (2 * varianceRange);
    const actualTarget = targetPower * variance;

    // effectiveMultiplier = hpRatio + 4 * damageRatio (считается динамически)
    const effectiveMultiplier = ratios.hpRatio + 4 * ratios.damageRatio;

    // internalPower для расчёта статов
    const internalPower = actualTarget / effectiveMultiplier;

    const hp = Math.floor(internalPower * ratios.hpRatio);
    const damage = Math.floor(internalPower * ratios.damageRatio);

    // Фактический effectivePower (для отображения)
    const power = hp + 4 * damage;

    return { hp, damage, power };
}

// Миграция старых предметов (для обратной совместимости)
// Используется когда у предмета есть power, но нет hp/damage
export function migrateItemStats(slot: SlotType, power: number): { hp: number; damage: number } {
    const ratios = SLOT_STAT_RATIOS[slot];
    const effectiveMultiplier = ratios.hpRatio + 4 * ratios.damageRatio;
    const internalPower = power / effectiveMultiplier;
    return {
        hp: Math.floor(internalPower * ratios.hpRatio),
        damage: Math.floor(internalPower * ratios.damageRatio)
    };
}

// Генерация имени предмета
const ITEM_PREFIXES: Record<Rarity, string[]> = {
    common: ['Простой', 'Обычный', 'Базовый'],
    good: ['Добротный', 'Хороший', 'Качественный'],
    rare: ['Редкий', 'Улучшенный', 'Крепкий'],
    epic: ['Эпический', 'Мощный', 'Великий'],
    mythic: ['Мифический', 'Древний', 'Священный'],
    legendary: ['Легендарный', 'Божественный', 'Прославленный'],
    immortal: ['Бессмертный', 'Вечный', 'Небесный']
};

const ITEM_TYPES: Record<SlotType, string[]> = {
    weapon: ['Меч', 'Топор', 'Клинок'],
    helmet: ['Шлем', 'Каска', 'Корона'],
    armor: ['Доспех', 'Кираса', 'Броня'],
    gloves: ['Перчатки', 'Рукавицы', 'Наручи'],
    shoes: ['Сапоги', 'Ботинки', 'Поножи'],
    magic: ['Посох', 'Жезл', 'Орб'],
    ring: ['Кольцо', 'Перстень', 'Печатка'],
    amulet: ['Амулет', 'Ожерелье', 'Кулон'],
    pants: ['Штаны', 'Поножи', 'Набедренники'],
    cloak: ['Плащ', 'Накидка', 'Мантия'],
    artefact: ['Артефакт', 'Реликвия', 'Талисман'],
    belt: ['Пояс', 'Ремень', 'Кушак']
};

export function generateItemName(slot: SlotType, rarity: Rarity): string {
    const prefixes = ITEM_PREFIXES[rarity];
    const types = ITEM_TYPES[slot];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    return `${prefix} ${type}`;
}
