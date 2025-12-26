import { EconomyTester } from './EconomyTester';
import { TestSummary, TesterConfig } from './TestMetrics';
import { setOverrides, resetToDefaults, BalanceOverrides } from '../config/ConfigStore';

// Запуск симуляции с кастомными параметрами баланса
export function runSimulation(
    overrides: BalanceOverrides,
    config: Partial<TesterConfig> = {}
): TestSummary {
    // Устанавливаем переопределения
    setOverrides(overrides);

    try {
        // Запускаем тест
        const tester = new EconomyTester(config);
        return tester.run();
    } finally {
        // Сбрасываем к дефолтам после теста
        resetToDefaults();
    }
}

// Экспортируем типы и утилиты для UI
export type { BalanceOverrides } from '../config/ConfigStore';
export { getDefaults, getConfig } from '../config/ConfigStore';
export type { TestSummary, TesterConfig, ChapterMetrics, StageMetrics } from './TestMetrics';
