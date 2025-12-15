import { Rarity, Item, SlotType, SLOT_TYPES, generateItemId, generateItemName, calculateItemPower, calculateItemStats } from './Item';

export interface Lamp {
    level: number;
    maxRarity: Rarity;
    maxItemLevel: number;
}

export interface LampConfig {
    level: number;
    maxRarity: Rarity;
    maxItemLevel: number;
    upgradeCost: number;
}

// Создание лампы по уровню
export function createLamp(config: LampConfig): Lamp {
    return {
        level: config.level,
        maxRarity: config.maxRarity,
        maxItemLevel: config.maxItemLevel
    };
}

// Выбор редкости по весам (с учётом максимальной)
export function rollRarity(
    weights: Record<Rarity, number>,
    maxRarity: Rarity
): Rarity {
    const rarityOrder: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
    const maxIndex = rarityOrder.indexOf(maxRarity);

    // Фильтруем редкости до максимальной
    const availableRarities = rarityOrder.slice(0, maxIndex + 1);

    // Суммируем веса доступных редкостей
    let totalWeight = 0;
    for (const rarity of availableRarities) {
        totalWeight += weights[rarity];
    }

    // Рандом
    let roll = Math.random() * totalWeight;

    for (const rarity of availableRarities) {
        roll -= weights[rarity];
        if (roll <= 0) {
            return rarity;
        }
    }

    return 'common';
}

// Генерация предмета из лампы
export function generateItemFromLamp(
    lamp: Lamp,
    rarityWeights: Record<Rarity, number>,
    rarityMultipliers: Record<Rarity, number>
): Item {
    // Случайный слот
    const slot: SlotType = SLOT_TYPES[Math.floor(Math.random() * SLOT_TYPES.length)];

    // Случайная редкость (в пределах лампы)
    const rarity = rollRarity(rarityWeights, lamp.maxRarity);

    // Случайный уровень (1 до maxItemLevel)
    const level = Math.floor(Math.random() * lamp.maxItemLevel) + 1;

    // Рассчитываем силу
    const power = calculateItemPower(level, rarity, rarityMultipliers);

    // Рассчитываем HP и урон на основе слота и силы
    const stats = calculateItemStats(slot, power);

    return {
        id: generateItemId(),
        name: generateItemName(slot, rarity),
        rarity,
        level,
        power,
        hp: stats.hp,
        damage: stats.damage,
        slot
    };
}
