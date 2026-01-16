/**
 * V5: GuaranteedRaritySimulator — добавляет гарантированную редкость
 *
 * Отличия от RaritySimulator (V4):
 * - Гарантированная редкость каждые N лутов (Coupon Collector формула)
 * - Сбрасывает счётчик если случайно выпала нужная редкость
 */

import { RaritySimulator } from './RaritySimulator';
import { Item, Rarity } from './types';
import {
    RARITY_ORDER,
    getLampLevelConfig, getUnlockedSlots, rollRarity,
    generateItemId, calculateSellPrice
} from './config';

// Параметры Guaranteed Rarity фичи
const GUARANTEED_RARITY_INTERVAL_MULTIPLIER = 1.0;
const BASE_DROPS_FOR_MULTIPLIER = 10;
const DROPS_PER_CHAPTER = 2;

// Offset для уровня предмета
const MIN_LEVEL_OFFSET = 5;
const MAX_RARITY_LEVEL_OFFSET = 0;

export class GuaranteedRaritySimulator extends RaritySimulator {
    // Счётчик лутов для гарантированной редкости
    private rarityLootCounter = 0;
    // Счётчик для гарантированного апгрейда (перегружаем)
    private v5GuaranteedUpgradeLootCounter = 0;

    protected lootOneItem(): boolean {
        this.rarityLootCounter++;
        this.v5GuaranteedUpgradeLootCounter++;

        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Получаем гарантированную редкость для текущей главы
        const { rarity: guaranteedRarity, expectedFilled, totalDrops } = this.getGuaranteedRarityWithExpected(
            this.lamp.level,
            unlockedSlots.length,
            this.chapter
        );
        const rarityInterval = Math.round((totalDrops / expectedFilled) * GUARANTEED_RARITY_INTERVAL_MULTIPLIER);

        // Интервал гарантированного апгрейда
        const guaranteedEveryN = this.calculateGuaranteedEveryN(currentStage);

        let item: Item;
        let isGuaranteedUpgrade = false;

        // Приоритет: гарантированный апгрейд > гарантированная редкость > обычный лут
        if (guaranteedEveryN > 0 && this.v5GuaranteedUpgradeLootCounter >= guaranteedEveryN) {
            item = this.generateGuaranteedUpgradeItemV5(currentStage);
            this.v5GuaranteedUpgradeLootCounter = 0;
            isGuaranteedUpgrade = true;
        } else if (rarityInterval > 0 && this.rarityLootCounter >= rarityInterval) {
            // Гарантированная редкость
            item = this.generateGuaranteedRarityItem(currentStage, guaranteedRarity);
            this.rarityLootCounter = 0;
        } else {
            // Обычный рандомный лут
            item = this.generateNormalItemV5(currentStage);
            // Если случайно выпала нужная редкость — сбрасываем счётчик
            if (this.isRarityAtLeast(item.rarity, guaranteedRarity)) {
                this.rarityLootCounter = 0;
            }
        }

        // Статистика
        this.chapterLoots++;
        this.stageLoots++;
        this.chapterLootsByRarity[item.rarity] = (this.chapterLootsByRarity[item.rarity] || 0) + 1;

        // Проверяем апгрейд
        const currentItem = this.hero.equipment[item.slot];
        const currentPower = currentItem?.power || 0;

        if (item.power > currentPower || isGuaranteedUpgrade) {
            // Апгрейд — надеваем
            this.hero.equipment[item.slot] = item;
            this.updateHeroStats();
            return true;
        } else {
            // Не апгрейд — продаём
            const sellPrice = calculateSellPrice(item.rarity);
            this.hero.gold += sellPrice;
            this.chapterGoldEarned += sellPrice;
        }

        this.totalIterations++;
        return false;
    }

    /**
     * Генерация обычного предмета с редкостью
     */
    protected generateNormalItemV5(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Редкость по весам лампы
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Проверяем, выпала ли максимальная редкость
        const maxRarity = this.getMaxRarityFromWeights(lampConfig.weights);
        const isMaxRarity = rarity === maxRarity;

        // Уровень = random(heroLevel - offset, heroLevel)
        const level = this.rollItemLevelV5(this.hero.level, isMaxRarity);

        // Сила предмета с variance
        const basePower = this.calculateItemPower(level, rarity);
        const targetPower = this.applyVariance(basePower);
        const { hp, damage, power } = this.calculateItemStats(slot, targetPower);

        return {
            id: generateItemId(),
            slot,
            rarity,
            level,
            power,
            hp,
            damage
        };
    }

    /**
     * Генерация предмета с гарантированной редкостью
     */
    protected generateGuaranteedRarityItem(currentStage: number, guaranteedRarity: Rarity): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Уровень = уровень героя (максимальный для гарантированной редкости)
        const level = this.hero.level;

        // Сила предмета с variance
        const basePower = this.calculateItemPower(level, guaranteedRarity);
        const targetPower = this.applyVariance(basePower);
        const { hp, damage, power } = this.calculateItemStats(slot, targetPower);

        return {
            id: generateItemId(),
            slot,
            rarity: guaranteedRarity,
            level,
            power,
            hp,
            damage
        };
    }

    /**
     * Генерация предмета для гарантированного апгрейда
     */
    protected generateGuaranteedUpgradeItemV5(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Находим самый слабый слот
        const slot = this.findWeakestSlot(unlockedSlots);

        // Редкость по весам лампы
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Уровень = уровень героя (максимальный)
        const level = this.hero.level;

        // Сила с разбросом
        const basePower = this.calculateItemPower(level, rarity);
        const targetPower = this.applyVariance(basePower);
        const { hp, damage, power } = this.calculateItemStats(slot, targetPower);

        return {
            id: generateItemId(),
            slot,
            rarity,
            level,
            power,
            hp,
            damage
        };
    }

    /**
     * Генерация уровня предмета с учётом редкости
     */
    protected rollItemLevelV5(heroLevel: number, isMaxRarity: boolean): number {
        const offset = isMaxRarity ? MAX_RARITY_LEVEL_OFFSET : MIN_LEVEL_OFFSET;
        const minLevel = Math.max(1, heroLevel - offset);
        return Math.floor(Math.random() * (heroLevel - minLevel + 1)) + minLevel;
    }

    /**
     * Проверка: редкость >= целевой
     */
    protected isRarityAtLeast(itemRarity: Rarity, targetRarity: Rarity): boolean {
        const itemIndex = RARITY_ORDER.indexOf(itemRarity);
        const targetIndex = RARITY_ORDER.indexOf(targetRarity);
        return itemIndex >= targetIndex;
    }

    /**
     * Получить гарантированную редкость на основе Coupon Collector формулы
     */
    protected getGuaranteedRarityWithExpected(
        lampLevel: number,
        totalSlots: number,
        chapter: number
    ): { rarity: Rarity; expectedFilled: number; totalDrops: number } {
        const lampConfig = getLampLevelConfig(lampLevel);
        const weights = lampConfig.weights;

        const totalDrops = BASE_DROPS_FOR_MULTIPLIER + (chapter - 1) * DROPS_PER_CHAPTER;

        // Считаем общий вес
        let totalWeight = 0;
        for (const weight of Object.values(weights)) {
            if (weight && weight > 0) totalWeight += weight;
        }
        if (totalWeight === 0) return { rarity: 'common', expectedFilled: 1.0, totalDrops };

        // Редкости от лучшей к худшей
        const rarityOrder: Rarity[] = ['immortal', 'legendary', 'mythic', 'epic', 'rare', 'good', 'common'];

        let remainingSlots = totalSlots;

        for (const rarity of rarityOrder) {
            const weight = weights[rarity];
            if (!weight || weight <= 0) continue;

            const prob = weight / totalWeight;
            const drops = totalDrops * prob;

            if (remainingSlots < 1) break;

            const expectedFilled = remainingSlots * (1 - Math.pow((remainingSlots - 1) / remainingSlots, drops));

            if (expectedFilled >= 1.0) {
                return { rarity, expectedFilled, totalDrops };
            }

            remainingSlots -= expectedFilled;
        }

        return { rarity: 'common', expectedFilled: 1.0, totalDrops };
    }

    protected recordStageMetrics(chapter: number, stage: number, enemyPower: number): void {
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);
        const guaranteedEveryN = this.calculateGuaranteedEveryN(currentStage);

        const { rarity: guaranteedRarity, expectedFilled, totalDrops } = this.getGuaranteedRarityWithExpected(
            this.lamp.level,
            unlockedSlots.length,
            chapter
        );
        const rarityInterval = Math.round((totalDrops / expectedFilled) * GUARANTEED_RARITY_INTERVAL_MULTIPLIER);

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
            guaranteedEveryN: guaranteedEveryN,
            guaranteedRarity: guaranteedRarity,
            totalDrops: rarityInterval
        });
    }
}
