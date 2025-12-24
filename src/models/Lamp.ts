import { Rarity, Item, SlotType, SLOT_TYPES, generateItemId, generateItemName, calculateItemStats, rollItemLevel } from './Item';
import lampLevelsData from '../../data/lamp-levels.json';

// Типы для конфигурации уровней лампы
export interface LampLevelConfig {
    level: number;
    price: number;
    time: number;
    weights: Partial<Record<Rarity, number>>;
}

// Загружаем уровни лампы из JSON
const lampLevels: LampLevelConfig[] = lampLevelsData as LampLevelConfig[];

// Максимальный уровень лампы
export const MAX_LAMP_LEVEL = lampLevels.length;

export interface Lamp {
    level: number;
}

// Получить конфиг уровня лампы
export function getLampLevelConfig(level: number): LampLevelConfig {
    const config = lampLevels.find(l => l.level === level);
    if (!config) {
        // Если уровень не найден, возвращаем последний
        return lampLevels[lampLevels.length - 1];
    }
    return config;
}

// Получить стоимость улучшения до следующего уровня
export function getUpgradeCost(currentLevel: number): number | null {
    const nextConfig = lampLevels.find(l => l.level === currentLevel + 1);
    if (!nextConfig) {
        return null; // Максимальный уровень
    }
    return nextConfig.price;
}

// Получить все конфиги уровней
export function getAllLampLevels(): LampLevelConfig[] {
    return lampLevels;
}

// Создание лампы по уровню
export function createLamp(level: number): Lamp {
    return { level };
}

// Выбор редкости по весам из конфига уровня лампы
export function rollRarity(weights: Partial<Record<Rarity, number>>): Rarity {
    // Суммируем все веса
    let totalWeight = 0;
    const entries = Object.entries(weights) as [Rarity, number][];

    for (const [, weight] of entries) {
        totalWeight += weight;
    }

    // Рандом
    let roll = Math.random() * totalWeight;

    for (const [rarity, weight] of entries) {
        roll -= weight;
        if (roll <= 0) {
            return rarity;
        }
    }

    // Fallback на первую доступную редкость
    return entries[0]?.[0] ?? 'common';
}

// Определить максимальную редкость из доступных в конфиге лампы
function getMaxRarityFromWeights(weights: Partial<Record<Rarity, number>>): Rarity {
    const rarityOrder: Rarity[] = ['common', 'good', 'rare', 'epic', 'mythic', 'legendary', 'immortal'];
    const availableRarities = Object.keys(weights) as Rarity[];
    let maxRarity: Rarity = 'common';
    for (const r of rarityOrder) {
        if (availableRarities.includes(r)) {
            maxRarity = r;
        }
    }
    return maxRarity;
}

// Рассчитать ожидаемый средний множитель редкости для уровня лампы
// Используется для масштабирования силы врагов
export function calculateExpectedRarityMultiplier(lampLevel: number): number {
    const config = getLampLevelConfig(lampLevel);
    const weights = config.weights;

    let totalWeight = 0;
    let weightedSum = 0;

    // Импортируем множители редкости из Item.ts
    const RARITY_MULTIPLIERS: Record<Rarity, number> = {
        common: 1.0,
        good: 1.5,
        rare: 2.25,
        epic: 3.375,
        mythic: 5.0625,
        legendary: 7.59375,
        immortal: 11.39
    };

    for (const [rarity, weight] of Object.entries(weights)) {
        const multiplier = RARITY_MULTIPLIERS[rarity as Rarity] || 1.0;
        weightedSum += weight * multiplier;
        totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 1.0;
}

// Генерация предмета из лампы
// lamp — определяет редкость (веса)
// heroLevel — определяет уровень предмета (базовые статы)
export function generateItemFromLamp(lamp: Lamp, heroLevel: number): Item {
    const config = getLampLevelConfig(lamp.level);

    // Случайный слот
    const slot: SlotType = SLOT_TYPES[Math.floor(Math.random() * SLOT_TYPES.length)];

    // Случайная редкость по весам текущего уровня лампы
    const rarity = rollRarity(config.weights);

    // Проверяем, выпала ли максимальная доступная редкость
    const maxRarity = getMaxRarityFromWeights(config.weights);
    const isMaxRarity = rarity === maxRarity;

    // Уровень предмета = от heroLevel (с диапазоном из items.json)
    // Для максимальной редкости используется меньший offset
    const level = rollItemLevel(heroLevel, isMaxRarity);

    // Рассчитываем статы (hp, damage, power) с учётом effectivePower = hp + 4*dmg
    const stats = calculateItemStats(slot, level, rarity);

    return {
        id: generateItemId(),
        name: generateItemName(slot, rarity),
        rarity,
        level,
        power: stats.power,  // effectivePower = hp + 4 * damage
        hp: stats.hp,
        damage: stats.damage,
        slot
    };
}
