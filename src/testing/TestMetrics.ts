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
}

// Метрики по главе
export interface ChapterMetrics {
    chapter: number;
    loots: number;           // Сколько лутов потребовалось на главу
    battles: number;         // Сколько боёв (включая поражения)
    defeats: number;         // Количество поражений
    unfairDefeats: number;   // Поражения при heroPower > enemyPower
    lampLevel: number;       // Уровень лампы на выходе из главы
    heroPower: number;       // Сила культа на выходе (maxHp + damage*4)
    heroLevel: number;       // Уровень героя
    goldEarned: number;      // Заработано золота за главу
    goldSpent: number;       // Потрачено на апгрейд лампы
    maxEnemyPower: number;   // Макс. сила врагов на главе (босс)
    lootsByRarity: Record<string, number>;  // Количество лутов по редкостям { common: N, good: N, ... }
    equippedByRarity: Record<string, number>;  // Распределение экипировки по редкостям (количество слотов)
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
