/**
 * Независимые типы для симуляторов сравнения фич
 * НЕ импортируем из основной игры — полная изоляция
 */

// Редкости
export type Rarity = 'common' | 'good' | 'rare' | 'epic' | 'mythic' | 'legendary' | 'immortal';

// Слоты экипировки
export type SlotType = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'shoes' | 'magic' | 'ring' | 'amulet' | 'pants' | 'cloak' | 'artefact' | 'belt';

// Предмет
export interface Item {
    id: string;
    slot: SlotType;
    rarity: Rarity;
    level: number;
    power: number;
    hp: number;
    damage: number;
}

// Герой (упрощённый)
export interface Hero {
    level: number;
    maxHp: number;
    damage: number;
    hp: number;
    gold: number;
    equipment: Partial<Record<SlotType, Item | null>>;
}

// Лампа (упрощённая)
export interface Lamp {
    level: number;
    currentRarityMultiplier: number;
}

// Метрики стадии
export interface StageMetrics {
    chapter: number;
    stage: number;
    loots: number;
    battles: number;
    defeats: number;
    heroLevel: number;
    heroPower: number;
    heroHp: number;
    heroDamage: number;
    slots: number;
    enemyPower: number;
    rarityMultiplier: number;
    currentRarityMultiplier: number;
    difficultyModifier: number;
    lampLevel: number;
    gold: number;
    guaranteedEveryN: number;
    guaranteedRarity: string;
    totalDrops: number;
}

// Метрики главы
export interface ChapterMetrics {
    chapter: number;
    loots: number;
    battles: number;
    defeats: number;
    unfairDefeats: number;
    lampLevel: number;
    heroPower: number;
    heroLevel: number;
    goldEarned: number;
    goldSpent: number;
    maxEnemyPower: number;
    lootsByRarity: Record<string, number>;
    equippedByRarity: Record<string, number>;
}

// Итоговые метрики
export interface TestSummary {
    totalChapters: number;
    totalLoots: number;
    totalBattles: number;
    totalDefeats: number;
    totalUnfairDefeats: number;
    totalGoldEarned: number;
    totalGoldSpent: number;
    finalLampLevel: number;
    finalHeroPower: number;
    finalHeroLevel: number;
    chapters: ChapterMetrics[];
    stages: StageMetrics[];
}

// Конфиг симулятора
export interface SimulatorConfig {
    maxChapters: number;
    maxIterations?: number;
    verbose?: boolean;
}

// Конфиг уровня лампы
export interface LampLevelConfig {
    level: number;
    price: number;
    weights: Partial<Record<Rarity, number>>;
}

// Конфиг слота
export interface SlotConfig {
    unlockStage: number;
    hpRatio: number;
    damageRatio: number;
}
