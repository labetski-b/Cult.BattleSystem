import enemiesConfig from '../../data/enemies.json';

export interface DungeonProgress {
    chapter: number;
    stage: number;
    currentEnemyPower: number;
}

export interface StageData {
    power: number;
    xp: number;
}

// Количество стадий в главе (последняя — босс)
export const STAGES_PER_CHAPTER = enemiesConfig.stagesPerChapter;

// Множитель силы босса
export const BOSS_MULTIPLIER = enemiesConfig.boss.powerMultiplier;

// Таблица данных по этапам
const stageTable: StageData[] = enemiesConfig.stageTable;

// Получить данные этапа по глобальному индексу
export function getStageData(globalStage: number): StageData {
    const index = globalStage - 1; // globalStage начинается с 1
    if (index < 0 || index >= stageTable.length) {
        // За пределами таблицы — возвращаем последнее значение
        return stageTable[stageTable.length - 1];
    }
    return stageTable[index];
}

// Глобальный номер этапа из chapter и stage
export function getGlobalStage(chapter: number, stage: number): number {
    return (chapter - 1) * STAGES_PER_CHAPTER + stage;
}

// Создание начального прогресса
export function createDungeonProgress(): DungeonProgress {
    const data = getStageData(1);
    return {
        chapter: 1,
        stage: 1,
        currentEnemyPower: data.power
    };
}

// Расчёт силы врагов на текущем этапе (из таблицы)
export function calculateStagePower(chapter: number, stage: number): number {
    const globalStage = getGlobalStage(chapter, stage);
    return getStageData(globalStage).power;
}

// XP за прохождение этапа (из таблицы)
export function getStageXpReward(chapter: number, stage: number): number {
    const globalStage = getGlobalStage(chapter, stage);
    return getStageData(globalStage).xp;
}

// Проверка — это босс?
export function isBossStage(stage: number): boolean {
    return stage === STAGES_PER_CHAPTER;
}

// Переход на следующий этап
export function advanceProgress(progress: DungeonProgress): DungeonProgress {
    let newStage = progress.stage + 1;
    let newChapter = progress.chapter;

    if (newStage > STAGES_PER_CHAPTER) {
        newStage = 1;
        newChapter++;
    }

    return {
        chapter: newChapter,
        stage: newStage,
        currentEnemyPower: calculateStagePower(newChapter, newStage)
    };
}

// Форматирование для отображения
export function formatDungeonProgress(progress: DungeonProgress): string {
    return `Dungeon ${progress.chapter}-${progress.stage}`;
}

// Максимальное количество этапов в таблице
export function getMaxGlobalStage(): number {
    return stageTable.length;
}
