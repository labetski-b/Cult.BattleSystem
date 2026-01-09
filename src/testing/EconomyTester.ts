import { ChapterMetrics, StageMetrics, TestSummary, TesterConfig, DEFAULT_CONFIG } from './TestMetrics';
import { GameState, getBalance } from '../systems/GameState';
import { Hero, createHero, updateHeroStats, equipItem, healHero, addXp } from '../models/Hero';
import { SLOT_TYPES, SlotType, Item, generateItemId, generateItemName, calculateItemStats, getUnlockedSlots, RARITY_ORDER, Rarity } from '../models/Item';
import { generateItemFromLamp, getUpgradeCost, createLamp, MAX_LAMP_LEVEL, calculateSlotBasedRarityMultiplier, rollRarity, getLampLevelConfig, updateRarityMultiplierAfterKill, getGuaranteedRarity, getGuaranteedRarityWithExpected } from '../models/Lamp';
import { generateEnemyWave } from '../models/Enemy';
import { simulateBattle } from '../systems/BattleSystem';
import { createDungeonProgress, advanceProgress, isBossStage, getBossMultiplier, getBaseStagePower, STAGES_PER_CHAPTER, getStageXpReward, getAdjustedEnemyPower, adjustDifficultyOnVictory, adjustDifficultyOnDefeat } from '../systems/DungeonSystem';
import { getConfig } from '../config/ConfigStore';
import enemiesConfig from '../../data/enemies.json';

// Конфиг врагов
const enemyConfig = {
    minEnemies: enemiesConfig.waves.minEnemies,
    maxEnemies: enemiesConfig.waves.maxEnemies
};

// Расчёт силы культа (effectivePower = maxHp + damage * 4)
function getHeroPower(hero: Hero): number {
    return Math.round((hero.maxHp + hero.damage * 4) * 10) / 10;
}

// Подсчёт заполненных слотов
function getFilledSlots(hero: Hero): number {
    return SLOT_TYPES.filter(slot => hero.equipment[slot] !== null).length;
}

// Подсчёт экипировки по редкостям
function getEquippedByRarity(hero: Hero): Record<string, number> {
    const result: Record<string, number> = {};
    for (const slot of SLOT_TYPES) {
        const item = hero.equipment[slot];
        if (item) {
            result[item.rarity] = (result[item.rarity] || 0) + 1;
        }
    }
    return result;
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
        lastLootedItem: null,
        lootCounter: 0,
        rarityLootCounter: 0
    };
}

// Проверить, является ли редкость такой же или лучше целевой
function isRarityAtLeast(itemRarity: Rarity, targetRarity: Rarity): boolean {
    const itemIndex = RARITY_ORDER.indexOf(itemRarity);
    const targetIndex = RARITY_ORDER.indexOf(targetRarity);
    // RARITY_ORDER идёт от худшей к лучшей: ['common', 'good', 'rare', 'epic', 'mythic', 'legendary', 'immortal']
    return itemIndex >= targetIndex;
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
    private chapterUnfairDefeats = 0;  // Поражения при heroPower > enemyPower
    private chapterGoldEarned = 0;
    private chapterGoldSpent = 0;
    private chapterLootsByRarity: Record<string, number> = {};

    // Счётчики текущего этапа
    private stageLoots = 0;
    private stageBattles = 0;
    private stageDefeats = 0;

    // Общий счётчик итераций (safety)
    private totalIterations = 0;

    // Флаг поражения в прошлом бою
    private lastBattleLost = false;

    // Счётчик лутов для гарантированного апгрейда
    private totalLootCounter = 0;

    // Счётчик лутов для гарантированной редкости (сбрасывается при дропе нужной редкости)
    private rarityLootCounter = 0;

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

    // Получить общий номер стадии (для разблокировки слотов)
    private getCurrentStageNumber(): number {
        return (this.state.dungeon.chapter - 1) * STAGES_PER_CHAPTER + this.state.dungeon.stage;
    }

    // Лут одного предмета
    // Возвращает true если предмет был экипирован (апгрейд)
    private lootOneItem(): boolean {
        this.totalLootCounter++;
        this.rarityLootCounter++;
        const currentStage = this.getCurrentStageNumber();
        const config = getConfig();

        let item: Item;

        // Вычисляем текущий everyN с учётом прогресса
        // everyN увеличивается на 1 каждые increaseEveryNStages стадий
        const baseEveryN = config.guaranteedUpgradeEveryN;
        const increaseRate = config.guaranteedUpgradeIncreaseEveryNStages;
        const currentEveryN = increaseRate > 0
            ? baseEveryN + Math.floor((currentStage - 1) / increaseRate)
            : baseEveryN;

        // Получаем гарантированную редкость для текущей главы
        const unlockedSlots = getUnlockedSlots(currentStage);
        const chapter = this.state.dungeon.chapter;
        const { rarity: guaranteedRarity, expectedFilled, totalDrops } = getGuaranteedRarityWithExpected(
            this.state.lamp.level,
            unlockedSlots.length,
            chapter
        );
        const rarityInterval = Math.round((totalDrops / expectedFilled) * config.guaranteedRarityIntervalMultiplier);

        // Приоритет генерации лута:
        // 1. Гарантированный апгрейд для слабого слота (каждый currentEveryN-й)
        // 2. Гарантированная редкость (каждый rarityInterval-й по счётчику rarityLootCounter)
        // 3. Обычный рандомный лут

        if (currentEveryN > 0 && this.totalLootCounter % currentEveryN === 0) {
            // Гарантированный апгрейд: предмет с максимальным уровнем для слабого слота
            item = this.generateGuaranteedUpgrade(currentStage);
            // Сбрасываем счётчик редкости, если выпала нужная редкость
            if (isRarityAtLeast(item.rarity as Rarity, guaranteedRarity)) {
                this.rarityLootCounter = 0;
            }
        } else if (config.guaranteedRarityEnabled && rarityInterval > 0 && this.rarityLootCounter >= rarityInterval) {
            // Гарантированная редкость на основе расчёта заполнения слотов
            item = this.generateGuaranteedRarityItem(currentStage);
            this.rarityLootCounter = 0;  // Сбрасываем счётчик после гарантированного дропа
        } else {
            // Обычный рандомный лут
            item = generateItemFromLamp(this.state.lamp, this.state.hero.level, currentStage);
            // Если случайно выпала нужная редкость или лучше — сбрасываем счётчик
            if (isRarityAtLeast(item.rarity as Rarity, guaranteedRarity)) {
                this.rarityLootCounter = 0;
            }
        }

        this.chapterLoots++;
        this.stageLoots++;
        this.chapterLootsByRarity[item.rarity] = (this.chapterLootsByRarity[item.rarity] || 0) + 1;

        // Проверяем, лучше ли предмет текущего
        const currentItem = this.state.hero.equipment[item.slot];
        const currentPower = currentItem?.power || 0;

        let wasEquipped = false;
        if (item.power > currentPower) {
            equipItem(this.state.hero, item);
            updateHeroStats(this.state.hero);
            wasEquipped = true;
        }

        this.totalIterations++;
        return wasEquipped;
    }

    // Генерация предмета с гарантированной редкостью
    // Редкость выбирается на основе расчёта заполнения слотов (лучшая с expectedFilled >= 1)
    private generateGuaranteedRarityItem(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);
        const chapter = this.state.dungeon.chapter;

        // Получаем гарантированную редкость
        const rarity = getGuaranteedRarity(this.state.lamp.level, unlockedSlots.length, chapter);

        // Случайный слот из разблокированных
        const slot: SlotType = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Уровень — с бонусом (как для максимальной редкости)
        const config = getConfig();
        const levelOffset = config.maxRarityLevelOffset;
        const itemLevel = Math.max(1, this.state.hero.level - Math.floor(Math.random() * (levelOffset + 1)));

        // Рассчитываем статы
        const stats = calculateItemStats(slot, itemLevel, rarity);

        return {
            id: generateItemId(),
            name: generateItemName(slot, rarity),
            rarity,
            level: itemLevel,
            slot,
            power: stats.power,
            hp: stats.hp,
            damage: stats.damage
        };
    }

    // Генерация гарантированного апгрейда для самого слабого слота
    // Предмет генерируется с максимальным уровнем (текущая глава)
    private generateGuaranteedUpgrade(currentStage: number): Item {
        // Получаем только разблокированные слоты
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Находим самый слабый экипированный предмет среди разблокированных
        let weakestSlot: SlotType | null = null;
        let weakestPower = Infinity;

        for (const slot of unlockedSlots) {
            const equipped = this.state.hero.equipment[slot];
            const power = equipped?.power || 0;
            if (power < weakestPower) {
                weakestPower = power;
                weakestSlot = slot;
            }
        }

        // Если нет экипировки — берём первый разблокированный слот
        if (weakestSlot === null) {
            weakestSlot = unlockedSlots[0];
        }

        // Генерируем редкость через лампу
        const lampConfig = getLampLevelConfig(this.state.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Уровень предмета = уровень героя (максимальный доступный)
        const itemLevel = this.state.hero.level;

        // Генерируем предмет с максимальным уровнем
        const stats = calculateItemStats(weakestSlot, itemLevel, rarity);

        return {
            id: generateItemId(),
            name: generateItemName(weakestSlot, rarity),
            rarity,
            level: itemLevel,
            slot: weakestSlot,
            power: stats.power,
            hp: stats.hp,
            damage: stats.damage
        };
    }

    // Фаза лута: лутаем только после поражения
    // Лутаем пока не получим апгрейд (предмет лучше текущего), затем сразу в бой
    // Защита от бесконечного лута: максимум 100 предметов
    private lootPhase(): void {
        // Лутаем только если был проигрыш
        if (!this.lastBattleLost) {
            return;
        }

        this.lastBattleLost = false;
        const maxLootsPerPhase = 100;  // Защита от бесконечного лута

        // Лутаем пока не получим апгрейд
        for (let i = 0; i < maxLootsPerPhase; i++) {
            const gotUpgrade = this.lootOneItem();
            if (this.totalIterations > this.config.maxIterations) break;
            // Получили апгрейд — идём в бой
            if (gotUpgrade) break;
        }
    }

    // Фаза апгрейда лампы
    private upgradePhase(): void {
        while (this.state.lamp.level < MAX_LAMP_LEVEL) {
            const cost = getUpgradeCost(this.state.lamp.level);
            if (cost === null) break;

            if (this.state.hero.gold >= cost) {
                this.state.hero.gold -= cost;
                // Сохраняем текущий множитель как базовый при апгрейде
                const oldMultiplier = this.state.lamp.currentRarityMultiplier;
                this.state.lamp = createLamp(this.state.lamp.level + 1);
                this.state.lamp.currentRarityMultiplier = oldMultiplier;
                this.state.lamp.baseRarityMultiplier = oldMultiplier;
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

        // Генерация врагов (с учётом всех множителей)
        let targetPower = getAdjustedEnemyPower(this.state.dungeon, this.state.lamp);
        if (isBoss) {
            targetPower *= getBossMultiplier();
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
            // Плавно увеличиваем множитель редкости после победы
            // Передаём актуальные слоты и главу для корректного расчёта target
            const currentStageNumber = this.getCurrentStageNumber();
            const unlockedSlots = getUnlockedSlots(currentStageNumber);
            updateRarityMultiplierAfterKill(this.state.lamp, unlockedSlots.length, currentChapter);

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

            // Увеличиваем сложность при победе (+1%)
            adjustDifficultyOnVictory(this.state.dungeon);

            this.state.dungeon = advanceProgress(this.state.dungeon);
            healHero(this.state.hero);
            return true;
        } else {
            this.chapterDefeats++;
            this.stageDefeats++;
            // Проверяем "несправедливое" поражение (герой сильнее, но проиграл)
            const heroPower = getHeroPower(this.state.hero);
            if (heroPower > targetPower) {
                this.chapterUnfairDefeats++;
            }
            // Уменьшаем сложность при поражении (-2%, только 1 раз за stage)
            adjustDifficultyOnDefeat(this.state.dungeon);
            this.lastBattleLost = true;
            // После поражения тоже лечим для продолжения
            healHero(this.state.hero);
            return false;
        }
    }

    // Записать метрики этапа
    private recordStageMetrics(chapter: number, stage: number, enemyPower: number): void {
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);
        const targetRarityMultiplier = calculateSlotBasedRarityMultiplier(
            this.state.lamp.level,
            unlockedSlots.length,
            chapter
        );
        const config = getConfig();
        const baseEveryN = config.guaranteedUpgradeEveryN;
        const increaseRate = config.guaranteedUpgradeIncreaseEveryNStages;
        const currentEveryN = increaseRate > 0
            ? baseEveryN + Math.floor((currentStage - 1) / increaseRate)
            : baseEveryN;

        // Гарантированная редкость на основе расчёта заполнения слотов
        const { rarity: guaranteedRarity, expectedFilled, totalDrops: baseTotalDrops } = getGuaranteedRarityWithExpected(
            this.state.lamp.level,
            unlockedSlots.length,
            chapter
        );

        // Интервал гарантированного лута по редкости = (totalDrops / expectedFilled) * multiplier
        const rarityInterval = Math.round((baseTotalDrops / expectedFilled) * config.guaranteedRarityIntervalMultiplier);

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
            rarityMultiplier: Math.round(targetRarityMultiplier * 100) / 100,  // целевой множитель
            currentRarityMultiplier: Math.round(this.state.lamp.currentRarityMultiplier * 100) / 100,  // текущий (плавный)
            difficultyModifier: Math.round(this.state.dungeon.difficultyModifier * 100),  // в процентах
            lampLevel: this.state.lamp.level,
            gold: this.state.hero.gold,
            guaranteedEveryN: currentEveryN,
            guaranteedRarity: guaranteedRarity,
            totalDrops: rarityInterval
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
        // Макс. сила врагов = сила босса (этап 10) с учётом множителей
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);
        const baseBossPower = getBaseStagePower(chapter, STAGES_PER_CHAPTER);
        const rarityMultiplier = calculateSlotBasedRarityMultiplier(
            this.state.lamp.level,
            unlockedSlots.length,
            chapter
        );
        const bossPower = baseBossPower * rarityMultiplier * getBossMultiplier();

        this.chapters.push({
            chapter,
            loots: this.chapterLoots,
            battles: this.chapterBattles,
            defeats: this.chapterDefeats,
            unfairDefeats: this.chapterUnfairDefeats,
            lampLevel: this.state.lamp.level,
            heroPower: getHeroPower(this.state.hero),
            heroLevel: this.state.hero.level,
            goldEarned: this.chapterGoldEarned,
            goldSpent: this.chapterGoldSpent,
            maxEnemyPower: Math.floor(bossPower),
            lootsByRarity: { ...this.chapterLootsByRarity },
            equippedByRarity: getEquippedByRarity(this.state.hero)
        });
    }

    // Сбросить счётчики главы
    private resetChapterCounters(): void {
        this.chapterLoots = 0;
        this.chapterBattles = 0;
        this.chapterDefeats = 0;
        this.chapterUnfairDefeats = 0;
        this.chapterGoldEarned = 0;
        this.chapterGoldSpent = 0;
        this.chapterLootsByRarity = {};
    }

    // Собрать итоговые метрики
    private buildSummary(): TestSummary {
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
