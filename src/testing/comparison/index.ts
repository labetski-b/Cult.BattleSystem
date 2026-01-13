/**
 * Независимые симуляторы для сравнения фич
 *
 * Каждый симулятор — это snapshot логики на момент добавления фичи.
 * Не зависят от основной игры, содержат всю логику внутри себя.
 *
 * V0: BaselineSimulator          — базовая симуляция (itemLevel = heroLevel, всё common)
 * V1: ItemLevelRangeSimulator    — + диапазон уровня предмета (heroLevel - offset)
 * V2: PowerVarianceSimulator     — + разброс силы (±10%)
 * V3: GuaranteedUpgradeSimulator — + гарантированный апгрейд для слабого слота
 * V4: RaritySimulator            — + редкости по весам лампы
 * V5: GuaranteedRaritySimulator  — + гарантированная редкость каждые N лутов
 */

export { BaselineSimulator } from './BaselineSimulator';
export { ItemLevelRangeSimulator } from './ItemLevelRangeSimulator';
export { PowerVarianceSimulator } from './PowerVarianceSimulator';
export { GuaranteedUpgradeSimulator } from './GuaranteedUpgradeSimulator';
export { RaritySimulator } from './RaritySimulator';
export { GuaranteedRaritySimulator } from './GuaranteedRaritySimulator';

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
