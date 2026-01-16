/**
 * Захардкоженные константы для независимых симуляторов
 * Читаем из JSON файлов, но не зависим от основной игры
 */

import { Rarity, SlotType, LampLevelConfig, SlotConfig } from './types';
import itemsConfig from '../../../data/items.json';
import raritiesConfig from '../../../data/rarities.json';
import lampLevelsConfig from '../../../data/lamp-levels.json';
import sellPricesConfig from '../../../data/sell-prices.json';

// ============= КОНСТАНТЫ =============

export const STAGES_PER_CHAPTER = 10;
export const BASE_POWER_PER_LEVEL = 10;
export const POWER_GROWTH_PER_LEVEL = 1.5;
export const MAX_LAMP_LEVEL = 31;

// Формула силы врагов: basePower * 1.5^(stage-1)
export const ENEMY_BASE_POWER = 100;
export const ENEMY_POWER_GROWTH = 1.5;

// Босс
export const BOSS_MULTIPLIER = 1.5;

// Цены продажи предметов из sell-prices.json
interface SellPriceData {
    rarity: string;
    minPrice: number;
    maxPrice: number;
}

export const SELL_PRICES: Record<Rarity, { min: number; max: number }> = Object.fromEntries(
    (sellPricesConfig as SellPriceData[]).map(c => [c.rarity, { min: c.minPrice, max: c.maxPrice }])
) as Record<Rarity, { min: number; max: number }>;

// XP
export const XP_PER_STAGE = 1;

// Герой
export const HERO_BASE_HP = 100;
export const HERO_BASE_DAMAGE = 10;
export const HERO_HP_PER_LEVEL = 20;
export const HERO_DAMAGE_PER_LEVEL = 5;

// ============= ДАННЫЕ ИЗ JSON =============

// Слоты из items.json
const slotsData = itemsConfig.slots as Record<string, { unlockStage: number; hpRatio: number; damageRatio: number }>;

export const SLOT_TYPES: SlotType[] = Object.keys(slotsData) as SlotType[];

export const SLOT_CONFIGS: Record<SlotType, SlotConfig> = Object.fromEntries(
    Object.entries(slotsData).map(([slot, config]) => [
        slot as SlotType,
        {
            unlockStage: config.unlockStage,
            hpRatio: config.hpRatio,
            damageRatio: config.damageRatio
        }
    ])
) as Record<SlotType, SlotConfig>;

// Редкости из rarities.json
interface RarityData {
    id: string;
    multiplier: number;
    color: string;
}

const raritiesData = raritiesConfig as RarityData[];

export const RARITY_MULTIPLIERS: Record<Rarity, number> = Object.fromEntries(
    raritiesData.map(r => [r.id as Rarity, r.multiplier])
) as Record<Rarity, number>;

export const RARITY_ORDER: Rarity[] = raritiesData.map(r => r.id as Rarity);

export const RARITY_COLORS: Record<Rarity, string> = Object.fromEntries(
    raritiesData.map(r => [r.id as Rarity, r.color])
) as Record<Rarity, string>;

// Уровни лампы из lamp-levels.json
interface LampLevelData {
    level: number;
    price: number;
    time: number;
    weights: Partial<Record<string, number>>;
}

const lampLevelsData = lampLevelsConfig as LampLevelData[];

export const LAMP_LEVELS: LampLevelConfig[] = lampLevelsData.map(l => ({
    level: l.level,
    price: l.price,
    weights: l.weights as Partial<Record<Rarity, number>>
}));

// ============= ХЕЛПЕРЫ =============

/**
 * Получить конфиг уровня лампы
 */
export function getLampLevelConfig(level: number): LampLevelConfig {
    const config = LAMP_LEVELS.find(l => l.level === level);
    return config || LAMP_LEVELS[LAMP_LEVELS.length - 1];
}

/**
 * Получить стоимость апгрейда лампы
 */
export function getUpgradeCost(currentLevel: number): number | null {
    const nextConfig = LAMP_LEVELS.find(l => l.level === currentLevel + 1);
    return nextConfig?.price ?? null;
}

/**
 * Получить разблокированные слоты для стадии
 */
export function getUnlockedSlots(currentStage: number): SlotType[] {
    return SLOT_TYPES.filter(slot => SLOT_CONFIGS[slot].unlockStage <= currentStage);
}

/**
 * Бросок редкости по весам
 */
export function rollRarity(weights: Partial<Record<Rarity, number>>): Rarity {
    let totalWeight = 0;
    const entries = Object.entries(weights) as [Rarity, number][];

    for (const [, weight] of entries) {
        totalWeight += weight;
    }

    let roll = Math.random() * totalWeight;

    for (const [rarity, weight] of entries) {
        roll -= weight;
        if (roll <= 0) {
            return rarity;
        }
    }

    return entries[0]?.[0] ?? 'common';
}

/**
 * Получить базовую силу врагов для стадии
 * Глобальный номер стадии = (chapter - 1) * 10 + stage
 */
export function getBaseStagePower(chapter: number, stage: number): number {
    const globalStage = (chapter - 1) * STAGES_PER_CHAPTER + stage;
    return ENEMY_BASE_POWER * Math.pow(ENEMY_POWER_GROWTH, globalStage - 1);
}

/**
 * Генерация уникального ID
 */
export function generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Расчёт цены продажи предмета (случайная в диапазоне для редкости)
 */
export function calculateSellPrice(rarity: Rarity): number {
    const priceRange = SELL_PRICES[rarity];
    return Math.floor(priceRange.min + Math.random() * (priceRange.max - priceRange.min));
}
