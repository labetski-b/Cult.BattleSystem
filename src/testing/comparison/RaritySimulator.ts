/**
 * V4: RaritySimulator — добавляет редкости
 *
 * Отличия от GuaranteedUpgradeSimulator (V3):
 * - Редкости по весам лампы (rollRarity)
 * - Множитель силы от редкости (RARITY_MULTIPLIERS)
 * - Предметы максимальной редкости имеют полный уровень (без offset)
 */

import { GuaranteedUpgradeSimulator } from './GuaranteedUpgradeSimulator';
import { Item, Rarity } from './types';
import {
    getLampLevelConfig, getUnlockedSlots, rollRarity,
    generateItemId
} from './config';

// Offset для уровня предмета
const MIN_LEVEL_OFFSET = 5;
const MAX_RARITY_LEVEL_OFFSET = 0;  // Предметы макс. редкости имеют полный уровень

export class RaritySimulator extends GuaranteedUpgradeSimulator {
    // Счётчик лутов для гарантированного апгрейда (наследуем)
    private rarityGuaranteedUpgradeLootCounter = 0;

    protected lootOneItem(): boolean {
        this.rarityGuaranteedUpgradeLootCounter++;

        const currentStage = this.getCurrentStageNumber();

        // Вычисляем интервал гарантированного апгрейда
        const guaranteedEveryN = this.calculateGuaranteedEveryN(currentStage);

        let item: Item;
        let isGuaranteedUpgrade = false;

        // Проверяем гарантированный апгрейд
        if (guaranteedEveryN > 0 && this.rarityGuaranteedUpgradeLootCounter >= guaranteedEveryN) {
            item = this.generateGuaranteedUpgradeItemWithRarity(currentStage);
            this.rarityGuaranteedUpgradeLootCounter = 0;
            isGuaranteedUpgrade = true;
        } else {
            // Обычный рандомный лут с редкостью
            item = this.generateNormalItemWithRarity(currentStage);
        }

        // Статистика
        this.chapterLoots++;
        this.stageLoots++;
        this.chapterLootsByRarity[item.rarity] = (this.chapterLootsByRarity[item.rarity] || 0) + 1;

        // Проверяем апгрейд
        const currentItem = this.hero.equipment[item.slot];
        const currentPower = currentItem?.power || 0;

        if (item.power > currentPower || isGuaranteedUpgrade) {
            this.hero.equipment[item.slot] = item;
            this.updateHeroStats();
            return true;
        }

        this.totalIterations++;
        return false;
    }

    /**
     * Генерация обычного предмета С редкостью
     */
    protected generateNormalItemWithRarity(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // ИЗМЕНЕНИЕ: Редкость по весам лампы
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Проверяем, выпала ли максимальная редкость
        const maxRarity = this.getMaxRarityFromWeights(lampConfig.weights);
        const isMaxRarity = rarity === maxRarity;

        // Уровень = random(heroLevel - offset, heroLevel)
        // Для макс. редкости — полный уровень
        const level = this.rollItemLevelWithRarity(this.hero.level, isMaxRarity);

        // Сила с разбросом и множителем редкости
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
     * Генерация предмета для гарантированного апгрейда С редкостью
     */
    protected generateGuaranteedUpgradeItemWithRarity(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Находим самый слабый слот
        const slot = this.findWeakestSlot(unlockedSlots);

        // Редкость по весам лампы (для гарантированного апгрейда)
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Уровень = уровень героя (максимальный)
        const level = this.hero.level;

        // Сила с разбросом и множителем редкости
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
    protected rollItemLevelWithRarity(heroLevel: number, isMaxRarity: boolean): number {
        const offset = isMaxRarity ? MAX_RARITY_LEVEL_OFFSET : MIN_LEVEL_OFFSET;
        const minLevel = Math.max(1, heroLevel - offset);
        return Math.floor(Math.random() * (heroLevel - minLevel + 1)) + minLevel;
    }

    /**
     * Получить максимальную редкость из весов лампы
     */
    protected getMaxRarityFromWeights(weights: Partial<Record<Rarity, number>>): Rarity {
        const rarityOrder: Rarity[] = ['immortal', 'legendary', 'mythic', 'epic', 'rare', 'good', 'common'];

        for (const rarity of rarityOrder) {
            if (weights[rarity] && weights[rarity]! > 0) {
                return rarity;
            }
        }

        return 'common';
    }

    protected recordStageMetrics(chapter: number, stage: number, enemyPower: number): void {
        const currentStage = this.getCurrentStageNumber();
        const guaranteedEveryN = this.calculateGuaranteedEveryN(currentStage);

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
            guaranteedRarity: 'common',  // Нет гарантированной редкости в V4
            totalDrops: 0
        });
    }
}
