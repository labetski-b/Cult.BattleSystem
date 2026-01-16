// Статистика боёв по количеству врагов (fair/unfair)
export interface UnfairBattleStats {
    wins: [number, number, number];      // [1 враг, 2 врага, 3 врага] — unfair побед (heroPower < enemyPower)
    losses: [number, number, number];    // [1 враг, 2 врага, 3 врага] — unfair поражений (heroPower > enemyPower)
    victories: [number, number, number]; // [1 враг, 2 врага, 3 врага] — всего побед
    defeats: [number, number, number];   // [1 враг, 2 врага, 3 врага] — всего поражений
    total: [number, number, number];     // [1 враг, 2 врага, 3 врага] — всего боёв
}

// Создать пустую статистику
export function createEmptyUnfairStats(): UnfairBattleStats {
    return {
        wins: [0, 0, 0],
        losses: [0, 0, 0],
        victories: [0, 0, 0],
        defeats: [0, 0, 0],
        total: [0, 0, 0]
    };
}

// Метрики по этапу (противнику)
export interface StageMetrics {
    chapter: number;
    stage: number;
    loots: number;           // Сколько лутов перед этим этапом
    battles: number;         // Сколько попыток боя (включая поражения)
    defeats: number;         // Количество поражений
    heroLevel: number;       // Уровень героя
    heroPower: number;       // Сила героя перед боем
    heroHp: number;          // HP героя
    heroDamage: number;      // Урон героя
    slots: number;           // Заполненных слотов (0-12)
    enemyPower: number;      // Сила врага (после множителя редкости)
    rarityMultiplier: number; // Целевой множитель редкости лампы
    currentRarityMultiplier: number; // Текущий множитель (плавно растёт к целевому)
    difficultyModifier: number; // Множитель адаптивной сложности (-20% до +20%)
    lampLevel: number;       // Уровень лампы
    gold: number;            // Золото у игрока
    guaranteedEveryN: number; // Текущий интервал гарантированного апгрейда
    guaranteedRarity: string; // Гарантированная редкость (на основе расчёта заполнения слотов)
    rarityInterval: number;   // Интервал гарантированного лута по редкости (каждый N-й лут)
    totalDrops: number;       // Ожидаемое количество дропов для расчёта (baseDrops + chapter*dropsPerChapter)
}

// Метрики по главе
export interface ChapterMetrics {
    chapter: number;
    loots: number;           // Сколько лутов потребовалось на главу
    battles: number;         // Сколько боёв (включая поражения)
    defeats: number;         // Количество поражений
    unfairDefeats: number;   // Поражения при heroPower > enemyPower
    unfairStats: UnfairBattleStats;  // Детальная статистика unfair по количеству врагов
    lampLevel: number;       // Уровень лампы на выходе из главы
    heroPower: number;       // Сила культа на выходе (maxHp + damage*4)
    heroLevel: number;       // Уровень героя
    goldEarned: number;      // Заработано золота за главу
    goldSpent: number;       // Потрачено на апгрейд лампы
    maxEnemyPower: number;   // Макс. сила врагов на главе (босс)
    lootsByRarity: Record<string, number>;  // Количество лутов по редкостям { common: N, good: N, ... }
    equippedByRarity: Record<string, number>;  // Распределение экипировки по редкостям (количество слотов)
    avgItemLevel: number;    // Средний уровень экипированных предметов
}

// Итоговые метрики теста
export interface TestSummary {
    totalChapters: number;
    totalLoots: number;
    totalBattles: number;
    totalDefeats: number;
    totalUnfairDefeats: number;  // Всего "несправедливых" поражений
    totalGoldEarned: number;
    totalGoldSpent: number;
    finalLampLevel: number;
    finalHeroPower: number;
    finalHeroLevel: number;
    chapters: ChapterMetrics[];
    stages: StageMetrics[];      // Детальная статистика по этапам
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
    maxIterations: 1000000,
    verbose: false
};
