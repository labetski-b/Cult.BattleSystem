import { ChapterMetrics, TestSummary, TesterConfig, DEFAULT_CONFIG } from './TestMetrics';
import { GameState, getBalance } from '../systems/GameState';
import { Hero, createHero, updateHeroStats, equipItem, healHero } from '../models/Hero';
import { generateItemFromLamp, getUpgradeCost, createLamp, MAX_LAMP_LEVEL } from '../models/Lamp';
import { generateEnemyWave } from '../models/Enemy';
import { simulateBattle } from '../systems/BattleSystem';
import { createDungeonProgress, advanceProgress, isBossStage, BOSS_MULTIPLIER, calculateStagePower, STAGES_PER_CHAPTER } from '../systems/DungeonSystem';
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
    private balance = getBalance();

    // Счётчики текущей главы
    private chapterLoots = 0;
    private chapterBattles = 0;
    private chapterDefeats = 0;
    private chapterGoldEarned = 0;
    private chapterGoldSpent = 0;

    // Общий счётчик итераций (safety)
    private totalIterations = 0;

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
                console.warn(`Reached max iterations (${this.config.maxIterations}), stopping`);
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

    // Фаза лута: лутаем пока сила героя < силы врагов
    private lootPhase(): void {
        const enemyPower = this.state.dungeon.currentEnemyPower;

        while (getHeroPower(this.state.hero) < enemyPower) {
            // Генерируем предмет напрямую (без траты ламп)
            const item = generateItemFromLamp(this.state.lamp, this.state.hero.level);

            this.chapterLoots++;

            // Проверяем, лучше ли предмет текущего
            const currentItem = this.state.hero.equipment[item.slot];
            const currentPower = currentItem?.power || 0;

            if (item.power > currentPower) {
                equipItem(this.state.hero, item);
                updateHeroStats(this.state.hero);
            }

            // Safety check
            this.totalIterations++;
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

        // Применяем урон
        this.state.hero.hp -= result.heroDamage;
        if (this.state.hero.hp < 0) this.state.hero.hp = 0;

        if (result.victory) {
            const goldReward = result.goldReward + this.balance.economy.goldPerStageClear;
            this.state.hero.gold += goldReward;
            this.chapterGoldEarned += goldReward;
            this.state.dungeon = advanceProgress(this.state.dungeon);
            healHero(this.state.hero);
            return true;
        } else {
            this.chapterDefeats++;
            // После поражения тоже лечим для продолжения
            healHero(this.state.hero);
            return false;
        }
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
            chapters: this.chapters
        };
    }
}
