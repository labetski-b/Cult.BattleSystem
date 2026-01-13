/**
 * V0: BaselineSimulator — базовая симуляция без дополнительных фич
 *
 * Особенности:
 * - Лут: случайный слот, случайная редкость по весам лампы
 * - Сила предмета: basePower * 1.5^(level-1) * rarityMultiplier (БЕЗ variance)
 * - Уровень предмета: heroLevel (без диапазона)
 * - Нет гарантированного апгрейда
 * - Нет гарантированной редкости
 */

import {
    Item, Hero, Lamp, Rarity, SlotType,
    SimulatorConfig, TestSummary, StageMetrics, ChapterMetrics
} from './types';

import {
    STAGES_PER_CHAPTER, BASE_POWER_PER_LEVEL, POWER_GROWTH_PER_LEVEL,
    BOSS_MULTIPLIER, GOLD_PER_ENEMY, GOLD_PER_STAGE, XP_PER_STAGE,
    HERO_BASE_HP, HERO_BASE_DAMAGE, HERO_HP_PER_LEVEL, HERO_DAMAGE_PER_LEVEL,
    SLOT_CONFIGS, RARITY_MULTIPLIERS, MAX_LAMP_LEVEL,
    getLampLevelConfig, getUpgradeCost, getUnlockedSlots, rollRarity,
    getBaseStagePower, generateItemId
} from './config';

const DEFAULT_CONFIG: SimulatorConfig = {
    maxChapters: 30,
    maxIterations: 100000,
    verbose: false
};

export class BaselineSimulator {
    protected config: SimulatorConfig;
    protected hero: Hero;
    protected lamp: Lamp;
    protected chapter: number = 1;
    protected stage: number = 1;

    protected chapters: ChapterMetrics[] = [];
    protected stages: StageMetrics[] = [];

    // Счётчики главы
    protected chapterLoots = 0;
    protected chapterBattles = 0;
    protected chapterDefeats = 0;
    protected chapterUnfairDefeats = 0;
    protected chapterGoldEarned = 0;
    protected chapterGoldSpent = 0;
    protected chapterLootsByRarity: Record<string, number> = {};

    // Счётчики стадии
    protected stageLoots = 0;
    protected stageBattles = 0;
    protected stageDefeats = 0;

    // Общие счётчики
    protected totalIterations = 0;
    protected lastBattleLost = false;

    constructor(config: Partial<SimulatorConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.hero = this.createHero();
        this.lamp = this.createLamp(1);
    }

    // ============= ОСНОВНОЙ ЦИКЛ =============

    run(): TestSummary {
        while (this.chapter <= this.config.maxChapters!) {
            this.totalIterations++;
            if (this.totalIterations > this.config.maxIterations!) {
                break;
            }

            const currentChapter = this.chapter;
            const startStage = this.stage;

            // Фаза лута (только после поражения)
            this.lootPhase();

            // Фаза апгрейда лампы
            this.upgradePhase();

            // Фаза боя
            const victory = this.battlePhase();

            if (!victory) {
                continue;
            }

            // Проверяем переход на новую главу
            if (this.chapter > currentChapter || (this.stage === 1 && startStage === STAGES_PER_CHAPTER)) {
                this.recordChapterMetrics(currentChapter);
                this.resetChapterCounters();
            }
        }

        return this.buildSummary();
    }

    // ============= СОЗДАНИЕ СУЩНОСТЕЙ =============

    protected createHero(): Hero {
        return {
            level: 1,
            maxHp: HERO_BASE_HP,
            damage: HERO_BASE_DAMAGE,
            hp: HERO_BASE_HP,
            gold: 0,
            equipment: {}
        };
    }

    protected createLamp(level: number): Lamp {
        return {
            level,
            currentRarityMultiplier: this.calculateExpectedRarityMultiplier(level)
        };
    }

    protected updateHeroStats(): void {
        this.hero.maxHp = HERO_BASE_HP + (this.hero.level - 1) * HERO_HP_PER_LEVEL;
        this.hero.damage = HERO_BASE_DAMAGE + (this.hero.level - 1) * HERO_DAMAGE_PER_LEVEL;

        // Добавляем статы от экипировки
        for (const item of Object.values(this.hero.equipment)) {
            if (item) {
                this.hero.maxHp += item.hp;
                this.hero.damage += item.damage;
            }
        }
    }

    // ============= РАСЧЁТЫ =============

    protected getCurrentStageNumber(): number {
        return (this.chapter - 1) * STAGES_PER_CHAPTER + this.stage;
    }

    protected getHeroPower(): number {
        return Math.round((this.hero.maxHp + this.hero.damage * 4) * 10) / 10;
    }

    protected getFilledSlots(): number {
        return Object.values(this.hero.equipment).filter(item => item !== null).length;
    }

    protected calculateExpectedRarityMultiplier(lampLevel: number): number {
        // Упрощённый расчёт — среднее по весам
        const lampConfig = getLampLevelConfig(lampLevel);
        const weights = lampConfig.weights;

        let totalWeight = 0;
        let weightedSum = 0;

        for (const [rarity, weight] of Object.entries(weights)) {
            if (weight && weight > 0) {
                totalWeight += weight;
                weightedSum += weight * (RARITY_MULTIPLIERS[rarity as Rarity] || 1);
            }
        }

        return totalWeight > 0 ? weightedSum / totalWeight : 1;
    }

    protected calculateItemPower(level: number, rarity: Rarity): number {
        const rarityMult = RARITY_MULTIPLIERS[rarity] || 1;
        return BASE_POWER_PER_LEVEL * Math.pow(POWER_GROWTH_PER_LEVEL, level - 1) * rarityMult;
    }

    // ============= ЛУТ =============

    protected lootPhase(): void {
        if (!this.lastBattleLost) {
            return;
        }

        this.lastBattleLost = false;
        const maxLootsPerPhase = 100;

        for (let i = 0; i < maxLootsPerPhase; i++) {
            const gotUpgrade = this.lootOneItem();
            if (this.totalIterations > this.config.maxIterations!) break;
            if (gotUpgrade) break;
        }
    }

    protected lootOneItem(): boolean {
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Случайная редкость по весам лампы
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Уровень = уровень героя (в Baseline нет диапазона)
        const level = this.hero.level;

        // Сила предмета (без variance в Baseline)
        const targetPower = this.calculateItemPower(level, rarity);

        // Генерируем статы
        const { hp, damage, power } = this.calculateItemStats(slot, targetPower);

        const item: Item = {
            id: generateItemId(),
            slot,
            rarity,
            level,
            power,
            hp,
            damage
        };

        // Статистика
        this.chapterLoots++;
        this.stageLoots++;
        this.chapterLootsByRarity[rarity] = (this.chapterLootsByRarity[rarity] || 0) + 1;

        // Проверяем апгрейд
        const currentItem = this.hero.equipment[slot];
        const currentPower = currentItem?.power || 0;

        if (item.power > currentPower) {
            this.hero.equipment[slot] = item;
            this.updateHeroStats();
            return true;
        }

        this.totalIterations++;
        return false;
    }

    protected calculateItemStats(slot: SlotType, targetPower: number): { hp: number; damage: number; power: number } {
        const config = SLOT_CONFIGS[slot];
        const effectiveMultiplier = config.hpRatio + 4 * config.damageRatio;
        const internalPower = targetPower / effectiveMultiplier;

        const hp = Math.round(internalPower * config.hpRatio * 10) / 10;
        const damage = Math.round(internalPower * config.damageRatio * 10) / 10;
        const power = Math.round((hp + 4 * damage) * 10) / 10;

        return { hp, damage, power };
    }

    // ============= АПГРЕЙД ЛАМПЫ =============

    protected upgradePhase(): void {
        while (this.lamp.level < MAX_LAMP_LEVEL) {
            const cost = getUpgradeCost(this.lamp.level);
            if (cost === null) break;

            if (this.hero.gold >= cost) {
                this.hero.gold -= cost;
                this.lamp = this.createLamp(this.lamp.level + 1);
                this.chapterGoldSpent += cost;
            } else {
                break;
            }
        }
    }

    // ============= БОЙ =============

    protected battlePhase(): boolean {
        const isBoss = this.stage === STAGES_PER_CHAPTER;

        // Сила врагов
        let enemyPower = getBaseStagePower(this.chapter, this.stage);
        enemyPower *= this.lamp.currentRarityMultiplier;
        if (isBoss) {
            enemyPower *= BOSS_MULTIPLIER;
        }

        this.chapterBattles++;
        this.stageBattles++;

        // Простая симуляция боя: сравниваем силы
        const heroPower = this.getHeroPower();
        const victory = heroPower >= enemyPower || Math.random() < 0.3; // 30% шанс победить даже если слабее

        if (victory) {
            // Записываем метрики стадии
            this.recordStageMetrics(this.chapter, this.stage, enemyPower);
            this.resetStageCounters();

            // Награды
            const goldReward = GOLD_PER_ENEMY * 3 + GOLD_PER_STAGE;
            this.hero.gold += goldReward;
            this.chapterGoldEarned += goldReward;

            // XP
            this.addXp(XP_PER_STAGE);

            // Переход на следующую стадию
            this.advanceStage();
            this.hero.hp = this.hero.maxHp;
            return true;
        } else {
            this.chapterDefeats++;
            this.stageDefeats++;
            if (heroPower > enemyPower) {
                this.chapterUnfairDefeats++;
            }
            this.lastBattleLost = true;
            this.hero.hp = this.hero.maxHp;
            return false;
        }
    }

    protected addXp(xp: number): void {
        // 1 XP = 1 уровень (упрощённо)
        this.hero.level += xp;
        this.updateHeroStats();
    }

    protected advanceStage(): void {
        this.stage++;
        if (this.stage > STAGES_PER_CHAPTER) {
            this.stage = 1;
            this.chapter++;
        }
    }

    // ============= МЕТРИКИ =============

    protected recordStageMetrics(chapter: number, stage: number, enemyPower: number): void {
        this.stages.push({
            chapter,
            stage,
            loots: this.stageLoots,
            battles: this.stageBattles,
            defeats: this.stageDefeats,
            heroLevel: this.hero.level,
            heroPower: this.getHeroPower(),
            heroHp: this.hero.maxHp,
            heroDamage: this.hero.damage,
            slots: this.getFilledSlots(),
            enemyPower: Math.floor(enemyPower),
            rarityMultiplier: this.lamp.currentRarityMultiplier,
            currentRarityMultiplier: this.lamp.currentRarityMultiplier,
            difficultyModifier: 0,
            lampLevel: this.lamp.level,
            gold: this.hero.gold,
            guaranteedEveryN: 0,  // Нет в Baseline
            guaranteedRarity: 'common',  // Нет в Baseline
            totalDrops: 0  // Нет в Baseline
        });
    }

    protected resetStageCounters(): void {
        this.stageLoots = 0;
        this.stageBattles = 0;
        this.stageDefeats = 0;
    }

    protected recordChapterMetrics(chapter: number): void {
        const maxEnemyPower = getBaseStagePower(chapter, STAGES_PER_CHAPTER)
            * this.lamp.currentRarityMultiplier
            * BOSS_MULTIPLIER;

        const equippedByRarity: Record<string, number> = {};
        for (const item of Object.values(this.hero.equipment)) {
            if (item) {
                equippedByRarity[item.rarity] = (equippedByRarity[item.rarity] || 0) + 1;
            }
        }

        this.chapters.push({
            chapter,
            loots: this.chapterLoots,
            battles: this.chapterBattles,
            defeats: this.chapterDefeats,
            unfairDefeats: this.chapterUnfairDefeats,
            lampLevel: this.lamp.level,
            heroPower: this.getHeroPower(),
            heroLevel: this.hero.level,
            goldEarned: this.chapterGoldEarned,
            goldSpent: this.chapterGoldSpent,
            maxEnemyPower: Math.floor(maxEnemyPower),
            lootsByRarity: { ...this.chapterLootsByRarity },
            equippedByRarity
        });
    }

    protected resetChapterCounters(): void {
        this.chapterLoots = 0;
        this.chapterBattles = 0;
        this.chapterDefeats = 0;
        this.chapterUnfairDefeats = 0;
        this.chapterGoldEarned = 0;
        this.chapterGoldSpent = 0;
        this.chapterLootsByRarity = {};
    }

    protected buildSummary(): TestSummary {
        const totalLoots = this.chapters.reduce((sum, c) => sum + c.loots, 0);
        const totalBattles = this.chapters.reduce((sum, c) => sum + c.battles, 0);
        const totalDefeats = this.chapters.reduce((sum, c) => sum + c.defeats, 0);
        const totalUnfairDefeats = this.chapters.reduce((sum, c) => sum + c.unfairDefeats, 0);
        const totalGoldEarned = this.chapters.reduce((sum, c) => sum + c.goldEarned, 0);
        const totalGoldSpent = this.chapters.reduce((sum, c) => sum + c.goldSpent, 0);

        const lastChapter = this.chapters[this.chapters.length - 1];

        return {
            totalChapters: this.chapters.length,
            totalLoots,
            totalBattles,
            totalDefeats,
            totalUnfairDefeats,
            totalGoldEarned,
            totalGoldSpent,
            finalLampLevel: lastChapter?.lampLevel || 1,
            finalHeroPower: lastChapter?.heroPower || 0,
            finalHeroLevel: lastChapter?.heroLevel || 1,
            chapters: this.chapters,
            stages: this.stages
        };
    }
}
