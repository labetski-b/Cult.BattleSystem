/**
 * V1: ItemLevelSimulator — добавляет Item Level фичу
 *
 * Отличия от Baseline:
 * - Уровень предмета = random(chapter - offset, chapter) вместо просто heroLevel
 * - Гарантированная редкость каждые N лутов (Coupon Collector формула)
 * - TotalDrops отображается на графике
 */

import { BaselineSimulator } from './BaselineSimulator';
import { Item, Rarity } from './types';
import {
    RARITY_ORDER,
    getLampLevelConfig, getUnlockedSlots, rollRarity,
    generateItemId
} from './config';

// Параметры Item Level фичи
const MIN_LEVEL_OFFSET = 5;  // Минимальный уровень = chapter - offset
const GUARANTEED_RARITY_INTERVAL_MULTIPLIER = 1.0;
const BASE_DROPS_FOR_MULTIPLIER = 10;
const DROPS_PER_CHAPTER = 2;

export class ItemLevelSimulator extends BaselineSimulator {
    // Счётчик лутов для гарантированной редкости
    protected rarityLootCounter = 0;

    protected lootOneItem(): boolean {
        this.rarityLootCounter++;
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Получаем гарантированную редкость для текущей главы
        const { rarity: guaranteedRarity, expectedFilled, totalDrops } = this.getGuaranteedRarityWithExpected(
            this.lamp.level,
            unlockedSlots.length,
            this.chapter
        );
        const rarityInterval = Math.round((totalDrops / expectedFilled) * GUARANTEED_RARITY_INTERVAL_MULTIPLIER);

        let item: Item;

        // Проверяем гарантированную редкость
        if (rarityInterval > 0 && this.rarityLootCounter >= rarityInterval) {
            item = this.generateGuaranteedRarityItem(currentStage, guaranteedRarity);
            this.rarityLootCounter = 0;
        } else {
            // Обычный рандомный лут
            item = this.generateNormalItem(currentStage);
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

        if (item.power > currentPower) {
            this.hero.equipment[item.slot] = item;
            this.updateHeroStats();
            return true;
        }

        this.totalIterations++;
        return false;
    }

    protected generateNormalItem(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Случайная редкость по весам лампы
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // ИЗМЕНЕНИЕ: Уровень = random(chapter - offset, chapter)
        const level = this.rollItemLevel(this.chapter);

        // Сила предмета
        const targetPower = this.calculateItemPower(level, rarity);
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

    protected generateGuaranteedRarityItem(currentStage: number, guaranteedRarity: Rarity): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Уровень = уровень героя (максимальный для гарантированной редкости)
        const level = this.hero.level;

        // Сила предмета
        const targetPower = this.calculateItemPower(level, guaranteedRarity);
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

    protected rollItemLevel(dungeonChapter: number): number {
        const minLevel = Math.max(1, dungeonChapter - MIN_LEVEL_OFFSET);
        return Math.floor(Math.random() * (dungeonChapter - minLevel + 1)) + minLevel;
    }

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
            guaranteedEveryN: 0,  // Нет Guaranteed Upgrade в V1
            guaranteedRarity: guaranteedRarity,
            totalDrops: rarityInterval
        });
    }
}
