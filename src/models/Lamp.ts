import { Rarity, Item, SlotType, generateItemId, generateItemName, calculateItemStats, rollItemLevel, RARITY_MULTIPLIERS, getUnlockedSlots } from './Item';
import lampLevelsData from '../../data/lamp-levels.json';
import { getConfig } from '../config/ConfigStore';

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
    currentRarityMultiplier: number;  // Текущий множитель (плавно растёт к целевому)
    baseRarityMultiplier: number;     // Множитель на момент апгрейда (для расчёта скорости роста)
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
    const mult = calculateExpectedRarityMultiplier(level);
    return {
        level,
        currentRarityMultiplier: mult,
        baseRarityMultiplier: mult
    };
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

// Рассчитать множитель редкости для уровня лампы (взвешенный верх)
// Берём редкости, покрывающие верхний % веса (из ConfigStore), и считаем их среднее
// Редкости с шансом < minProbForGradualGrowth исключаются из расчёта
// Используется для масштабирования силы врагов
export function calculateExpectedRarityMultiplier(lampLevel: number): number {
    const lampConfig = getLampLevelConfig(lampLevel);
    const weights = lampConfig.weights;
    const balanceConfig = getConfig();
    const topPercent = balanceConfig.topPercentForAverage;
    const minProb = balanceConfig.minProbForGradualGrowth;

    // Сначала считаем общий вес для определения вероятностей
    let rawTotalWeight = 0;
    for (const weight of Object.values(weights)) {
        if (weight !== undefined && weight > 0) {
            rawTotalWeight += weight;
        }
    }

    // Собираем редкости с весами, исключая те, чей шанс < minProb
    const entries: { rarity: Rarity; weight: number; multiplier: number }[] = [];
    let totalWeight = 0;

    for (const [rarity, weight] of Object.entries(weights)) {
        if (weight === undefined || weight <= 0) continue;

        const probability = weight / rawTotalWeight;
        // Исключаем редкости с шансом < порога
        if (probability < minProb) continue;

        const multiplier = RARITY_MULTIPLIERS[rarity as Rarity] || 1.0;
        entries.push({ rarity: rarity as Rarity, weight, multiplier });
        totalWeight += weight;
    }

    // Если все редкости исключены, возвращаем 1.0
    if (entries.length === 0 || totalWeight === 0) {
        return 1.0;
    }

    // Сортируем по множителю (от лучшего к худшему)
    entries.sort((a, b) => b.multiplier - a.multiplier);

    // Берём верхние N% веса (из balance.json)
    const topThreshold = totalWeight * topPercent;
    let accumulatedWeight = 0;
    let topWeightedSum = 0;
    let topTotalWeight = 0;

    for (const entry of entries) {
        if (accumulatedWeight >= topThreshold) break;

        // Сколько веса ещё можем взять
        const remainingThreshold = topThreshold - accumulatedWeight;
        const weightToTake = Math.min(entry.weight, remainingThreshold);

        topWeightedSum += weightToTake * entry.multiplier;
        topTotalWeight += weightToTake;
        accumulatedWeight += entry.weight;
    }

    return topTotalWeight > 0 ? topWeightedSum / topTotalWeight : 1.0;
}

// Получить вероятность самой редкой редкости (с минимальным весом > 0)
export function getLowestRarityProbability(lampLevel: number): number {
    const config = getLampLevelConfig(lampLevel);
    const weights = config.weights;
    let totalWeight = 0;
    let minWeight = Infinity;

    for (const weight of Object.values(weights)) {
        if (weight !== undefined && weight > 0) {
            totalWeight += weight;
            if (weight < minWeight) {
                minWeight = weight;
            }
        }
    }

    if (totalWeight === 0 || minWeight === Infinity) return 1;
    return minWeight / totalWeight;
}

// Обновить множитель редкости после убийства врага
// Множитель плавно растёт от базового к целевому за фиксированное число шагов
export function updateRarityMultiplierAfterKill(lamp: Lamp): void {
    const targetMultiplier = calculateExpectedRarityMultiplier(lamp.level);

    // Если уже достигли целевого — ничего не делаем
    if (lamp.currentRarityMultiplier >= targetMultiplier) {
        lamp.currentRarityMultiplier = targetMultiplier;
        return;
    }

    // Фиксированный инкремент: достигаем target за stepsToTarget шагов
    const stepsToTarget = getConfig().stepsToTarget;
    const totalDelta = targetMultiplier - lamp.baseRarityMultiplier;
    const increment = totalDelta / stepsToTarget;

    lamp.currentRarityMultiplier = Math.min(
        lamp.currentRarityMultiplier + increment,
        targetMultiplier
    );
}

// Генерация предмета из лампы
// lamp — определяет редкость (веса)
// heroLevel — определяет уровень предмета (базовые статы)
// currentStage — определяет какие слоты разблокированы (по умолчанию = heroLevel для обратной совместимости)
export function generateItemFromLamp(lamp: Lamp, heroLevel: number, currentStage?: number): Item {
    const config = getLampLevelConfig(lamp.level);

    // Получаем разблокированные слоты для текущей стадии
    const stage = currentStage ?? heroLevel;
    const unlockedSlots = getUnlockedSlots(stage);

    // Случайный слот из разблокированных
    const slot: SlotType = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

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
