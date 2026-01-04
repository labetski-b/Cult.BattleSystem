import enemiesConfig from '../../data/enemies.json';
import { calculateExpectedRarityMultiplier } from '../models/Lamp';
import { getConfig } from '../config/ConfigStore';

export interface DungeonProgress {
    chapter: number;
    stage: number;
    currentEnemyPower: number;  // basePower (без множителей)
    difficultyModifier: number;  // без лимитов (+1% за победу, -2% за поражение)
    lastDefeatStage: number;     // для защиты от повторных -2%
}

export interface StageData {
    power: number;
    xp: number;
}

// Количество стадий в главе (последняя — босс)
export const STAGES_PER_CHAPTER = enemiesConfig.stagesPerChapter;

// Множитель силы босса (дефолт из JSON, может быть переопределён)
export const BOSS_MULTIPLIER = enemiesConfig.boss.powerMultiplier;

// Получить множитель босса из ConfigStore
export function getBossMultiplier(): number {
    return getConfig().bossPowerMultiplier;
}

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
        currentEnemyPower: data.power,  // basePower без множителей
        difficultyModifier: 0,
        lastDefeatStage: 0
    };
}

// Получить basePower этапа (без множителей)
export function getBaseStagePower(chapter: number, stage: number): number {
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
// currentEnemyPower хранит basePower (без множителей)
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
        currentEnemyPower: getBaseStagePower(newChapter, newStage),
        difficultyModifier: progress.difficultyModifier,
        lastDefeatStage: progress.lastDefeatStage
    };
}

// Изменение множителя сложности при победе (из ConfigStore, без лимита)
export function adjustDifficultyOnVictory(dungeon: DungeonProgress): void {
    const config = getConfig();
    if (!config.difficultyEnabled) return;
    dungeon.difficultyModifier += config.difficultyOnVictory;
}

// Изменение множителя сложности при поражении (из ConfigStore, без лимита)
// Только 1 раз за stage (повторные поражения не уменьшают)
export function adjustDifficultyOnDefeat(dungeon: DungeonProgress): void {
    const config = getConfig();
    if (!config.difficultyEnabled) return;
    const stageId = dungeon.chapter * 100 + dungeon.stage;
    if (dungeon.lastDefeatStage !== stageId) {
        dungeon.difficultyModifier += config.difficultyOnDefeat; // отрицательное значение
        dungeon.lastDefeatStage = stageId;
    }
}

// Получить силу врагов с учётом ВСЕХ множителей
// enemyPower = basePower × rarityMultiplier × (1 + difficultyModifier)
export function getAdjustedEnemyPower(dungeon: DungeonProgress, lampLevel: number): number {
    const basePower = dungeon.currentEnemyPower;
    const rarityMultiplier = calculateExpectedRarityMultiplier(lampLevel);
    const difficultyMultiplier = 1 + dungeon.difficultyModifier;
    return Math.round(basePower * rarityMultiplier * difficultyMultiplier);
}

// Форматирование для отображения
export function formatDungeonProgress(progress: DungeonProgress): string {
    return `Dungeon ${progress.chapter}-${progress.stage}`;
}

// Максимальное количество этапов в таблице
export function getMaxGlobalStage(): number {
    return stageTable.length;
}
