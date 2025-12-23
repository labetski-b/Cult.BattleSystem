import { ChapterMetrics, StageMetrics, TestSummary, TesterConfig, DEFAULT_CONFIG } from './TestMetrics';
import { GameState, getBalance } from '../systems/GameState';
import { Hero, createHero, updateHeroStats, equipItem, healHero, addXp } from '../models/Hero';
import { SLOT_TYPES } from '../models/Item';
import { generateItemFromLamp, getUpgradeCost, createLamp, MAX_LAMP_LEVEL } from '../models/Lamp';
import { generateEnemyWave } from '../models/Enemy';
import { simulateBattle } from '../systems/BattleSystem';
import { createDungeonProgress, advanceProgress, isBossStage, BOSS_MULTIPLIER, calculateStagePower, STAGES_PER_CHAPTER, getStageXpReward } from '../systems/DungeonSystem';
import enemiesConfig from '../../data/enemies.json';

// Конфиг врагов
const enemyConfig = {
    minEnemies: enemiesConfig.waves.minEnemies,
    maxEnemies: enemiesConfig.waves.maxEnemies,
    bossMultiplier: BOSS_MULTIPLIER
};

// Расчёт силы культа (effectivePower = maxHp + damage * 4)
function getHeroPower(hero: Hero): number {
    return hero.maxHp + hero.damage * 4;
}

// Подсчёт заполненных слотов
function getFilledSlots(hero: Hero): number {
    return SLOT_TYPES.filter(slot => hero.equipment[slot] !== null).length;
}

// Создание чистого GameState (без localStorage)
function createCleanGameState(): GameState {
    const hero = createHero();
    updateHeroStats(hero);
    hero.hp = hero.maxHp;

    return {
        hero,
        lamp: createLamp(1),
        dungeon: createDungeonProgress(),
        inventory: [],
        lastBattleResult: null,
        lastLootedItem: null
    };
}

export class EconomyTester {
    private config: TesterConfig;
    private state: GameState;
    private chapters: ChapterMetrics[] = [];
    private stages: StageMetrics[] = [];
    private balance = getBalance();

    // Счётчики текущей главы
    private chapterLoots = 0;
    private chapterBattles = 0;
    private chapterDefeats = 0;
    private chapterGoldEarned = 0;
    private chapterGoldSpent = 0;

    // Счётчики текущего этапа
    private stageLoots = 0;
    private stageBattles = 0;
    private stageDefeats = 0;

    // Общий счётчик итераций (safety)
    private totalIterations = 0;

    // Флаг поражения в прошлом бою
    private lastBattleLost = false;

    constructor(config: Partial<TesterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.state = createCleanGameState();
    }

    // Основной метод запуска теста
    run(): TestSummary {
        if (this.config.verbose) {
            console.log('=== Starting Economy Test ===');
            console.log(`Max chapters: ${this.config.maxChapters}`);
        }

        while (this.state.dungeon.chapter <= this.config.maxChapters) {
            this.totalIterations++;
            if (this.totalIterations > this.config.maxIterations) {
                console.warn(`\nReached max iterations (${this.config.maxIterations}), stopping at Ch ${this.state.dungeon.chapter}.${this.state.dungeon.stage}`);
                console.warn(`Hero: Lvl ${this.state.hero.level}, Power ${getHeroPower(this.state.hero)}, Gold ${this.state.hero.gold}`);
                console.warn(`Enemy Power: ${this.state.dungeon.currentEnemyPower}, Lamp Lvl: ${this.state.lamp.level}`);
                break;
            }

            const currentChapter = this.state.dungeon.chapter;
            const startStage = this.state.dungeon.stage;

            // Фаза лута: лутаем пока сила < силы врагов
            this.lootPhase();

            // Фаза апгрейда лампы
            this.upgradePhase();

            // Фаза боя
            const victory = this.battlePhase();

            // Если проиграли - продолжаем лутать
            if (!victory) {
                continue;
            }

            // Проверяем, прошли ли главу (stage сбросился на 1)
            if (this.state.dungeon.chapter > currentChapter ||
                (this.state.dungeon.stage === 1 && startStage === 10)) {
                this.recordChapterMetrics(currentChapter);
                this.resetChapterCounters();

                if (this.config.verbose) {
                    console.log(`Chapter ${currentChapter} completed!`);
                }
            }
        }

        return this.buildSummary();
    }

    // Лут одного предмета
    private lootOneItem(): void {
        const item = generateItemFromLamp(this.state.lamp, this.state.hero.level);

        this.chapterLoots++;
        this.stageLoots++;

        // Проверяем, лучше ли предмет текущего
        const currentItem = this.state.hero.equipment[item.slot];
        const currentPower = currentItem?.power || 0;

        if (item.power > currentPower) {
            equipItem(this.state.hero, item);
            updateHeroStats(this.state.hero);
        }

        this.totalIterations++;
    }

    // Фаза лута: лутаем пока сила героя < силы врагов
    // Если прошлый бой проигран — сначала обязательно 1 лут
    private lootPhase(): void {
        const enemyPower = this.state.dungeon.currentEnemyPower;

        // После поражения — сначала минимум 1 лут
        if (this.lastBattleLost) {
            this.lootOneItem();
            this.lastBattleLost = false;
            if (this.totalIterations > this.config.maxIterations) return;
        }

        // Затем лутаем пока сила < силы врагов
        while (getHeroPower(this.state.hero) < enemyPower) {
            this.lootOneItem();
            if (this.totalIterations > this.config.maxIterations) break;
        }
    }

    // Фаза апгрейда лампы
    private upgradePhase(): void {
        while (this.state.lamp.level < MAX_LAMP_LEVEL) {
            const cost = getUpgradeCost(this.state.lamp.level);
            if (cost === null) break;

            if (this.state.hero.gold >= cost) {
                this.state.hero.gold -= cost;
                this.state.lamp = createLamp(this.state.lamp.level + 1);
                this.chapterGoldSpent += cost;
            } else {
                break;
            }
        }
    }

    // Фаза боя
    private battlePhase(): boolean {
        const isBoss = isBossStage(this.state.dungeon.stage);
        const currentChapter = this.state.dungeon.chapter;
        const currentStage = this.state.dungeon.stage;

        // Генерация врагов
        let targetPower = this.state.dungeon.currentEnemyPower;
        if (isBoss) {
            targetPower *= enemyConfig.bossMultiplier;
        }

        const enemies = generateEnemyWave(
            targetPower,
            enemyConfig.minEnemies,
            enemyConfig.maxEnemies,
            isBoss
        );

        // Симуляция боя
        const result = simulateBattle(
            this.state.hero,
            enemies,
            this.balance.combat,
            this.balance.economy.goldPerEnemy
        );

        this.chapterBattles++;
        this.stageBattles++;

        // Применяем урон
        this.state.hero.hp -= result.heroDamage;
        if (this.state.hero.hp < 0) this.state.hero.hp = 0;

        if (result.victory) {
            // Записываем метрики этапа перед переходом
            this.recordStageMetrics(currentChapter, currentStage, targetPower);
            this.resetStageCounters();

            // Золото
            const goldReward = result.goldReward + this.balance.economy.goldPerStageClear;
            this.state.hero.gold += goldReward;
            this.chapterGoldEarned += goldReward;

            // XP за этап (до advanceProgress!)
            const xpReward = getStageXpReward(this.state.dungeon.chapter, this.state.dungeon.stage);
            addXp(this.state.hero, xpReward);

            this.state.dungeon = advanceProgress(this.state.dungeon);
            healHero(this.state.hero);
            return true;
        } else {
            this.chapterDefeats++;
            this.stageDefeats++;
            this.lastBattleLost = true;
            // После поражения тоже лечим для продолжения
            healHero(this.state.hero);
            return false;
        }
    }

    // Записать метрики этапа
    private recordStageMetrics(chapter: number, stage: number, enemyPower: number): void {
        this.stages.push({
            chapter,
            stage,
            loots: this.stageLoots,
            battles: this.stageBattles,
            defeats: this.stageDefeats,
            heroLevel: this.state.hero.level,
            heroPower: getHeroPower(this.state.hero),
            heroHp: this.state.hero.maxHp,
            heroDamage: this.state.hero.damage,
            slots: getFilledSlots(this.state.hero),
            enemyPower: Math.floor(enemyPower),
            lampLevel: this.state.lamp.level,
            gold: this.state.hero.gold
        });
    }

    // Сбросить счётчики этапа
    private resetStageCounters(): void {
        this.stageLoots = 0;
        this.stageBattles = 0;
        this.stageDefeats = 0;
    }

    // Записать метрики главы
    private recordChapterMetrics(chapter: number): void {
        // Макс. сила врагов = сила босса (этап 10)
        const bossPower = calculateStagePower(chapter, STAGES_PER_CHAPTER) * BOSS_MULTIPLIER;

        this.chapters.push({
            chapter,
            loots: this.chapterLoots,
            battles: this.chapterBattles,
            defeats: this.chapterDefeats,
            lampLevel: this.state.lamp.level,
            heroPower: getHeroPower(this.state.hero),
            heroLevel: this.state.hero.level,
            goldEarned: this.chapterGoldEarned,
            goldSpent: this.chapterGoldSpent,
            maxEnemyPower: Math.floor(bossPower)
        });
    }

    // Сбросить счётчики главы
    private resetChapterCounters(): void {
        this.chapterLoots = 0;
        this.chapterBattles = 0;
        this.chapterDefeats = 0;
        this.chapterGoldEarned = 0;
        this.chapterGoldSpent = 0;
    }

    // Собрать итоговые метрики
    private buildSummary(): TestSummary {
        const totalLoots = this.chapters.reduce((sum, c) => sum + c.loots, 0);
        const totalBattles = this.chapters.reduce((sum, c) => sum + c.battles, 0);
        const totalDefeats = this.chapters.reduce((sum, c) => sum + c.defeats, 0);
        const totalGoldEarned = this.chapters.reduce((sum, c) => sum + c.goldEarned, 0);
        const totalGoldSpent = this.chapters.reduce((sum, c) => sum + c.goldSpent, 0);

        const lastChapter = this.chapters[this.chapters.length - 1];

        return {
            totalChapters: this.chapters.length,
            totalLoots,
            totalBattles,
            totalDefeats,
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
