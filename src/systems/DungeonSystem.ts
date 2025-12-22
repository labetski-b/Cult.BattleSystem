import enemiesConfig from '../../data/enemies.json';

export interface DungeonProgress {
    chapter: number;
    stage: number;
    currentEnemyPower: number;
}

export interface DungeonConfig {
    baseEnemyPower: number;
    powerPerStage: number; // Множитель силы за этап
    enemiesPerWave: { min: number; max: number };
    bossMultiplier: number;
}

// Количество стадий в главе (последняя — босс)
export const STAGES_PER_CHAPTER = enemiesConfig.progression.stagesPerChapter;

// Множитель силы босса
export const BOSS_MULTIPLIER = enemiesConfig.boss.powerMultiplier;

// Создание начального прогресса
export function createDungeonProgress(): DungeonProgress {
    return {
        chapter: 1,
        stage: 1,
        currentEnemyPower: enemiesConfig.progression.baseEnemyPower
    };
}

// Расчёт силы врагов на текущем этапе
export function calculateStagePower(
    chapter: number,
    stage: number,
    config: DungeonConfig
): number {
    // Глобальный уровень = (chapter - 1) * 5 + stage
    const globalStage = (chapter - 1) * STAGES_PER_CHAPTER + stage;

    // Экспоненциальный рост силы
    return Math.floor(config.baseEnemyPower * Math.pow(config.powerPerStage, globalStage - 1));
}

// Проверка — это босс?
export function isBossStage(stage: number): boolean {
    return stage === STAGES_PER_CHAPTER; // 5-й этап — босс
}

// Переход на следующий этап
export function advanceProgress(progress: DungeonProgress, config: DungeonConfig): DungeonProgress {
    let newStage = progress.stage + 1;
    let newChapter = progress.chapter;

    if (newStage > STAGES_PER_CHAPTER) {
        newStage = 1;
        newChapter++;
    }

    return {
        chapter: newChapter,
        stage: newStage,
        currentEnemyPower: calculateStagePower(newChapter, newStage, config)
    };
}

// Форматирование для отображения
export function formatDungeonProgress(progress: DungeonProgress): string {
    return `Dungeon ${progress.chapter}-${progress.stage}`;
}
