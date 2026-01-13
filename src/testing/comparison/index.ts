/**
 * Независимые симуляторы для сравнения фич
 *
 * Каждый симулятор — это snapshot логики на момент добавления фичи.
 * Не зависят от основной игры, содержат всю логику внутри себя.
 *
 * V0: BaselineSimulator   — базовая симуляция без фич
 * V1: ItemLevelSimulator  — + уровень предмета по главе + гарантированная редкость
 * V2: VarianceSimulator   — + разброс силы (±15%)
 * V3: GuaranteedSimulator — + гарантированный апгрейд каждые N лутов
 */

export { BaselineSimulator } from './BaselineSimulator';
export { ItemLevelSimulator } from './ItemLevelSimulator';
export { VarianceSimulator } from './VarianceSimulator';
export { GuaranteedSimulator } from './GuaranteedSimulator';

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
