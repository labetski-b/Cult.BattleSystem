import { Rarity, Item, SlotType, generateItemId, generateItemName, calculateItemStats, rollItemLevel, getUnlockedSlots } from './Item';
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

// Новая логика: slot-based multiplier
// Рассчитывает ожидаемый множитель силы на основе заполнения слотов предметами
// chapter — текущая глава (влияет на количество ожидаемых дропов)
// totalSlots — количество разблокированных слотов (6/9/12)
export function calculateSlotBasedRarityMultiplier(
    lampLevel: number,
    totalSlots: number = 6,
    chapter: number = 1
): number {
    const lampConfig = getLampLevelConfig(lampLevel);
    const weights = lampConfig.weights;
    const config = getConfig();

    // Параметры
    // totalDrops растёт с главой: baseDrops + (chapter - 1) * dropsPerChapter
    const baseDrops = config.baseDropsForMultiplier;      // 10
    const dropsPerChapter = config.dropsPerChapter;       // 2
    const totalDrops = baseDrops + (chapter - 1) * dropsPerChapter;
    const minProbThreshold = config.minProbForGradualGrowth;  // 0.015 (1.5%)

    // Считаем общий вес
    let totalWeight = 0;
    for (const weight of Object.values(weights)) {
        if (weight !== undefined && weight > 0) {
            totalWeight += weight;
        }
    }

    if (totalWeight === 0) return 1.0;

    // Собираем редкости: только те, что >= minProbThreshold
    const validRarities: { rarity: Rarity; prob: number; mult: number }[] = [];
    for (const [rarity, weight] of Object.entries(weights)) {
        if (weight === undefined || weight <= 0) continue;
        const prob = weight / totalWeight;
        if (prob < minProbThreshold) continue;  // Исключаем редкие

        const mult = config.rarityMultipliers[rarity as Rarity] || 1.0;
        validRarities.push({ rarity: rarity as Rarity, prob, mult });
    }

    // Если все редкости исключены, возвращаем 1.0
    if (validRarities.length === 0) {
        return 1.0;
    }

    // Сортируем по множителю (убывание) — лучшие редкости заполняют слоты первыми
    validRarities.sort((a, b) => b.mult - a.mult);

    // Рассчитываем заполнение слотов
    let remainingSlots = totalSlots;
    let totalPower = 0;

    for (const { prob, mult } of validRarities) {
        if (remainingSlots < 1) break;  // Меньше 1 слота — выходим

        const drops = totalDrops * prob;
        // Формула Coupon Collector: ожидаемое заполнение
        // remainingSlots должен быть >= 1, иначе формула даёт NaN
        const expectedFilled = remainingSlots * (1 - Math.pow((remainingSlots - 1) / remainingSlots, drops));
        const filledSlots = Math.min(expectedFilled, remainingSlots);

        totalPower += filledSlots * mult;
        remainingSlots -= filledSlots;
    }

    // Если остались незаполненные слоты — считаем их с mult=1.0
    if (remainingSlots > 0) {
        totalPower += remainingSlots * 1.0;
    }

    return totalPower / totalSlots;
}

// Обёртка для обратной совместимости (использует 6 слотов и главу 1 по умолчанию)
export function calculateExpectedRarityMultiplier(lampLevel: number): number {
    return calculateSlotBasedRarityMultiplier(lampLevel, 6, 1);
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
// Множитель плавно растёт от текущего к целевому за фиксированное число шагов
// При изменении target (новые слоты, новая глава) шаг пересчитывается
export function updateRarityMultiplierAfterKill(
    lamp: Lamp,
    totalSlots: number = 6,
    chapter: number = 1
): void {
    const targetMultiplier = calculateSlotBasedRarityMultiplier(lamp.level, totalSlots, chapter);

    // Если уже достигли целевого — ничего не делаем
    if (lamp.currentRarityMultiplier >= targetMultiplier) {
        lamp.currentRarityMultiplier = targetMultiplier;
        return;
    }

    // Шаг пересчитывается от ТЕКУЩЕГО значения к target
    // Всегда достигаем target за stepsToTarget шагов от текущей позиции
    const stepsToTarget = getConfig().stepsToTarget;
    const remainingDelta = targetMultiplier - lamp.currentRarityMultiplier;
    const increment = remainingDelta / stepsToTarget;

    lamp.currentRarityMultiplier = Math.min(
        lamp.currentRarityMultiplier + increment,
        targetMultiplier
    );
}

// Результат функции getGuaranteedRarityWithExpected
export interface GuaranteedRarityResult {
    rarity: Rarity;
    expectedFilled: number;  // Ожидаемое заполнение слотов для этой редкости
    totalDrops: number;      // Базовое количество дропов (для расчёта интервала)
}

// Получить гарантированную редкость на основе расчёта заполнения слотов
// Возвращает лучшую редкость с expectedFilled >= 1.0 и её expectedFilled
export function getGuaranteedRarityWithExpected(
    lampLevel: number,
    totalSlots: number,
    chapter: number
): GuaranteedRarityResult {
    const lampConfig = getLampLevelConfig(lampLevel);
    const weights = lampConfig.weights;
    const config = getConfig();

    const totalDrops = config.baseDropsForMultiplier + (chapter - 1) * config.dropsPerChapter;

    // Считаем общий вес
    let totalWeight = 0;
    for (const weight of Object.values(weights)) {
        if (weight && weight > 0) totalWeight += weight;
    }
    if (totalWeight === 0) return { rarity: 'common', expectedFilled: 1.0, totalDrops };

    // Редкости от лучшей к худшей
    const rarityOrder: Rarity[] = ['immortal', 'legendary', 'mythic', 'epic', 'rare', 'good', 'common'];

    let remainingSlots = totalSlots;

    for (const rarity of rarityOrder) {
        const weight = weights[rarity];
        if (!weight || weight <= 0) continue;

        const prob = weight / totalWeight;
        const drops = totalDrops * prob;

        // Защита от деления на 0
        if (remainingSlots < 1) break;

        const expectedFilled = remainingSlots * (1 - Math.pow((remainingSlots - 1) / remainingSlots, drops));

        if (expectedFilled >= 1.0) {
            return { rarity, expectedFilled, totalDrops };  // Лучшая редкость с ожидаемым заполнением >= 1 слота
        }

        remainingSlots -= expectedFilled;
    }

    return { rarity: 'common', expectedFilled: 1.0, totalDrops };  // Fallback
}

// Обёртка для обратной совместимости — возвращает только редкость
export function getGuaranteedRarity(
    lampLevel: number,
    totalSlots: number,
    chapter: number
): Rarity {
    return getGuaranteedRarityWithExpected(lampLevel, totalSlots, chapter).rarity;
}

// Генерация предмета с гарантированной редкостью
// Используется каждый totalDrops-й лут
export function generateGuaranteedRarityItem(
    lamp: Lamp,
    heroLevel: number,
    currentStage: number
): Item {
    const unlockedSlots = getUnlockedSlots(currentStage);
    const chapter = Math.floor((currentStage - 1) / 10) + 1;  // STAGES_PER_CHAPTER = 10
    const config = getConfig();

    // Получаем гарантированную редкость
    const rarity = getGuaranteedRarity(lamp.level, unlockedSlots.length, chapter);

    // Случайный слот из разблокированных
    const slot: SlotType = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

    // Уровень: heroLevel + offset (offset от -5 до 0, где 0 = max)
    const levelOffset = config.guaranteedRarityLevelOffset;
    const level = Math.max(1, heroLevel + levelOffset);

    // Рассчитываем статы
    const stats = calculateItemStats(slot, level, rarity);

    return {
        id: generateItemId(),
        name: generateItemName(slot, rarity),
        rarity,
        level,
        power: stats.power,
        hp: stats.hp,
        damage: stats.damage,
        slot
    };
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
