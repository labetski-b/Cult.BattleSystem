// Типы редкости предметов
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

// Слоты экипировки
export type SlotType = 'helmet' | 'armor' | 'weapon' | 'shield' | 'boots' | 'accessory';

export const SLOT_TYPES: SlotType[] = ['helmet', 'armor', 'weapon', 'shield', 'boots', 'accessory'];

export const SLOT_NAMES: Record<SlotType, string> = {
    helmet: '🪖 Шлем',
    armor: '🛡️ Броня',
    weapon: '⚔️ Оружие',
    shield: '🔰 Щит',
    boots: '👢 Сапоги',
    accessory: '💍 Аксессуар'
};

export const RARITY_COLORS: Record<Rarity, string> = {
    common: '#9ca3af',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b'
};

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

// Какие слоты дают какие статы (в процентах от power)
// helmet, armor, shield, boots - больше HP
// weapon - больше урона
// accessory - 50/50
export const SLOT_STAT_RATIOS: Record<SlotType, { hpRatio: number; damageRatio: number }> = {
    helmet: { hpRatio: 0.8, damageRatio: 0.2 },
    armor: { hpRatio: 0.9, damageRatio: 0.1 },
    weapon: { hpRatio: 0.1, damageRatio: 0.9 },
    shield: { hpRatio: 0.7, damageRatio: 0.3 },
    boots: { hpRatio: 0.6, damageRatio: 0.4 },
    accessory: { hpRatio: 0.5, damageRatio: 0.5 }
};

// Генерация ID
export function generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Расчёт силы предмета
export function calculateItemPower(level: number, rarity: Rarity, rarityMultipliers: Record<Rarity, number>): number {
    const basePower = level * 10;
    return Math.floor(basePower * rarityMultipliers[rarity]);
}

// Расчёт статов предмета (hp и damage) на основе слота и силы
export function calculateItemStats(slot: SlotType, power: number): { hp: number; damage: number } {
    const ratios = SLOT_STAT_RATIOS[slot];
    return {
        hp: Math.floor(power * ratios.hpRatio),
        damage: Math.floor(power * ratios.damageRatio)
    };
}

// Генерация имени предмета
const ITEM_PREFIXES: Record<Rarity, string[]> = {
    common: ['Простой', 'Обычный', 'Базовый'],
    rare: ['Редкий', 'Улучшенный', 'Крепкий'],
    epic: ['Эпический', 'Мощный', 'Великий'],
    legendary: ['Легендарный', 'Мифический', 'Божественный']
};

const ITEM_TYPES: Record<SlotType, string[]> = {
    helmet: ['Шлем', 'Каска', 'Корона'],
    armor: ['Доспех', 'Кираса', 'Броня'],
    weapon: ['Меч', 'Топор', 'Клинок'],
    shield: ['Щит', 'Барьер', 'Защита'],
    boots: ['Сапоги', 'Ботинки', 'Поножи'],
    accessory: ['Кольцо', 'Амулет', 'Талисман']
};

export function generateItemName(slot: SlotType, rarity: Rarity): string {
    const prefixes = ITEM_PREFIXES[rarity];
    const types = ITEM_TYPES[slot];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    return `${prefix} ${type}`;
}
