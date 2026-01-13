/**
 * Независимые симуляторы для сравнения фич
 *
 * Каждый симулятор — это snapshot логики на момент добавления фичи.
 * Не зависят от основной игры, содержат всю логику внутри себя.
 *
 * V0: BaselineSimulator          — базовая симуляция (itemLevel = heroLevel)
 * V1: ItemLevelRangeSimulator    — + диапазон уровня предмета (heroLevel - offset)
 * V2: GuaranteedRaritySimulator  — + гарантированная редкость каждые N лутов
 * V3: PowerVarianceSimulator     — + разброс силы (±10%)
 * V4: GuaranteedUpgradeSimulator — + гарантированный апгрейд для слабого слота
 */

export { BaselineSimulator } from './BaselineSimulator';
export { ItemLevelRangeSimulator } from './ItemLevelRangeSimulator';
export { GuaranteedRaritySimulator } from './GuaranteedRaritySimulator';
export { PowerVarianceSimulator } from './PowerVarianceSimulator';
export { GuaranteedUpgradeSimulator } from './GuaranteedUpgradeSimulator';

// Типы
export type {
    Rarity,
    SlotType,
    Item,
    Hero,
    Lamp,
    StageMetrics,
    ChapterMetrics,
    TestSummary,
    SimulatorConfig,
    LampLevelConfig,
    SlotConfig
} from './types';
