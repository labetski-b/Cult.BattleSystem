import itemsConfig from '../../data/items.json';
import raritiesData from '../../data/rarities.json';
import enemiesConfig from '../../data/enemies.json';
import balanceData from '../../data/balance.json';

// Типы редкости (синхронизировать с Item.ts)
type Rarity = 'common' | 'good' | 'rare' | 'epic' | 'mythic' | 'legendary' | 'immortal';

// Интерфейс для переопределяемых параметров баланса
export interface BalanceOverrides {
    // items.json
    basePowerPerLevel?: number;
    powerGrowthPerLevel?: number;
    powerVariance?: number;           // ±10% вариация силы предмета
    minLevelOffset?: number;          // диапазон уровня предмета (heroLevel - offset)
    maxRarityLevelOffset?: number;    // диапазон для макс. редкости

    // Guaranteed upgrade (items.json)
    guaranteedUpgradeEveryN?: number;           // каждый N-й лут — гарантированный апгрейд
    guaranteedUpgradeIncreaseEveryNStages?: number;  // каждые N стадий everyN увеличивается на 1
    guaranteedUpgradeMultiplier?: number;       // множитель силы (1.05 = +5%) — не используется

    // rarities.json (множители по id)
    rarityMultipliers?: Partial<Record<Rarity, number>>;

    // DungeonSystem.ts (hardcoded values)
    difficultyEnabled?: boolean;   // включить/выключить адаптивную сложность
    difficultyOnVictory?: number;  // default: 0.01
    difficultyOnDefeat?: number;   // default: -0.02

    // enemies.json
    bossPowerMultiplier?: number;

    // balance.json (rarityMultiplier settings)
    topPercentForAverage?: number;      // % верхних редкостей для расчёта множителя врагов
    minProbForGradualGrowth?: number;   // минимальный шанс для включения в расчёт
    stepsToTarget?: number;             // шагов для достижения целевого множителя
}

// Полный конфиг с дефолтными значениями
export interface BalanceConfig {
    basePowerPerLevel: number;
    powerGrowthPerLevel: number;
    powerVariance: number;
    minLevelOffset: number;
    maxRarityLevelOffset: number;
    guaranteedUpgradeEveryN: number;
    guaranteedUpgradeIncreaseEveryNStages: number;
    guaranteedUpgradeMultiplier: number;
    rarityMultipliers: Record<Rarity, number>;
    difficultyEnabled: boolean;
    difficultyOnVictory: number;
    difficultyOnDefeat: number;
    bossPowerMultiplier: number;
    topPercentForAverage: number;
    minProbForGradualGrowth: number;
    stepsToTarget: number;
}

// Загружаем дефолтные множители редкостей из JSON
const defaultRarityMultipliers: Record<Rarity, number> = Object.fromEntries(
    (raritiesData as { id: string; multiplier: number }[]).map(r => [r.id, r.multiplier])
) as Record<Rarity, number>;

// Типизация для guaranteedUpgrade
const guaranteedUpgrade = (itemsConfig as { guaranteedUpgrade?: { everyNLoots: number; increaseEveryNStages: number; powerMultiplier: number } }).guaranteedUpgrade;

// Дефолтные значения (читаются из JSON при инициализации)
const defaults: BalanceConfig = {
    basePowerPerLevel: itemsConfig.basePowerPerLevel,
    powerGrowthPerLevel: itemsConfig.powerGrowthPerLevel,
    powerVariance: itemsConfig.powerVariance ?? 0.1,
    minLevelOffset: itemsConfig.levelRange.minLevelOffset,
    maxRarityLevelOffset: (itemsConfig.levelRange as { minLevelOffset: number; maxRarityLevelOffset: number }).maxRarityLevelOffset,
    guaranteedUpgradeEveryN: guaranteedUpgrade?.everyNLoots ?? 4,
    guaranteedUpgradeIncreaseEveryNStages: guaranteedUpgrade?.increaseEveryNStages ?? 10,
    guaranteedUpgradeMultiplier: guaranteedUpgrade?.powerMultiplier ?? 1.05,
    rarityMultipliers: defaultRarityMultipliers,
    difficultyEnabled: false,  // ВРЕМЕННО ОТКЛЮЧЕНО
    difficultyOnVictory: 0.01,
    difficultyOnDefeat: -0.02,
    bossPowerMultiplier: enemiesConfig.boss.powerMultiplier,
    topPercentForAverage: balanceData.rarityMultiplier.topPercentForAverage,
    minProbForGradualGrowth: balanceData.rarityMultiplier.minProbForGradualGrowth,
    stepsToTarget: balanceData.rarityMultiplier.stepsToTarget,
};

// Текущие переопределения
let currentOverrides: BalanceOverrides = {};

// Установить переопределения
export function setOverrides(overrides: BalanceOverrides): void {
    currentOverrides = { ...overrides };
}

// Получить текущий конфиг (дефолты + переопределения)
export function getConfig(): BalanceConfig {
    const mergedRarityMultipliers = {
        ...defaults.rarityMultipliers,
        ...(currentOverrides.rarityMultipliers || {})
    };

    return {
        basePowerPerLevel: currentOverrides.basePowerPerLevel ?? defaults.basePowerPerLevel,
        powerGrowthPerLevel: currentOverrides.powerGrowthPerLevel ?? defaults.powerGrowthPerLevel,
        powerVariance: currentOverrides.powerVariance ?? defaults.powerVariance,
        minLevelOffset: currentOverrides.minLevelOffset ?? defaults.minLevelOffset,
        maxRarityLevelOffset: currentOverrides.maxRarityLevelOffset ?? defaults.maxRarityLevelOffset,
        guaranteedUpgradeEveryN: currentOverrides.guaranteedUpgradeEveryN ?? defaults.guaranteedUpgradeEveryN,
        guaranteedUpgradeIncreaseEveryNStages: currentOverrides.guaranteedUpgradeIncreaseEveryNStages ?? defaults.guaranteedUpgradeIncreaseEveryNStages,
        guaranteedUpgradeMultiplier: currentOverrides.guaranteedUpgradeMultiplier ?? defaults.guaranteedUpgradeMultiplier,
        rarityMultipliers: mergedRarityMultipliers,
        difficultyEnabled: currentOverrides.difficultyEnabled ?? defaults.difficultyEnabled,
        difficultyOnVictory: currentOverrides.difficultyOnVictory ?? defaults.difficultyOnVictory,
        difficultyOnDefeat: currentOverrides.difficultyOnDefeat ?? defaults.difficultyOnDefeat,
        bossPowerMultiplier: currentOverrides.bossPowerMultiplier ?? defaults.bossPowerMultiplier,
        topPercentForAverage: currentOverrides.topPercentForAverage ?? defaults.topPercentForAverage,
        minProbForGradualGrowth: currentOverrides.minProbForGradualGrowth ?? defaults.minProbForGradualGrowth,
        stepsToTarget: currentOverrides.stepsToTarget ?? defaults.stepsToTarget,
    };
}

// Сбросить к дефолтам
export function resetToDefaults(): void {
    currentOverrides = {};
}

// Получить дефолтные значения (для UI)
export function getDefaults(): BalanceConfig {
    return { ...defaults };
}

// Получить текущие переопределения
export function getOverrides(): BalanceOverrides {
    return { ...currentOverrides };
}
