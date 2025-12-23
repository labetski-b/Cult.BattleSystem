// Метрики по главе
export interface ChapterMetrics {
    chapter: number;
    loots: number;           // Сколько лутов потребовалось на главу
    battles: number;         // Сколько боёв (включая поражения)
    defeats: number;         // Количество поражений
    lampLevel: number;       // Уровень лампы на выходе из главы
    heroPower: number;       // Сила культа на выходе (maxHp + damage*4)
    heroLevel: number;       // Уровень героя
    goldEarned: number;      // Заработано золота за главу
    goldSpent: number;       // Потрачено на апгрейд лампы
    maxEnemyPower: number;   // Макс. сила врагов на главе (босс)
}

// Итоговые метрики теста
export interface TestSummary {
    totalChapters: number;
    totalLoots: number;
    totalBattles: number;
    totalDefeats: number;
    totalGoldEarned: number;
    totalGoldSpent: number;
    finalLampLevel: number;
    finalHeroPower: number;
    finalHeroLevel: number;
    chapters: ChapterMetrics[];
}

// Конфигурация тестера
export interface TesterConfig {
    maxChapters: number;        // До какой главы тестировать (default: 10)
    maxIterations: number;      // Лимит итераций (safety, default: 100000)
    verbose: boolean;           // Детальный лог
}

// Значения по умолчанию
export const DEFAULT_CONFIG: TesterConfig = {
    maxChapters: 10,
    maxIterations: 50000,
    verbose: false
};
