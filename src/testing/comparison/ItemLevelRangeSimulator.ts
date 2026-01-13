/**
 * V1: ItemLevelRangeSimulator — добавляет диапазон уровня предмета
 *
 * Отличия от Baseline:
 * - Уровень предмета = random(heroLevel - offset, heroLevel) вместо просто heroLevel
 * - Для максимальной редкости offset меньше (предметы ближе к героLevel)
 */

import { BaselineSimulator } from './BaselineSimulator';
import { Item, Rarity } from './types';
import {
    getLampLevelConfig, getUnlockedSlots, rollRarity,
    generateItemId
} from './config';

// Параметры Item Level Range фичи
const MIN_LEVEL_OFFSET = 5;           // Обычный offset для большинства предметов
const MAX_RARITY_LEVEL_OFFSET = 3;    // Меньший offset для максимальной редкости

export class ItemLevelRangeSimulator extends BaselineSimulator {

    protected lootOneItem(): boolean {
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Случайная редкость по весам лампы
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Проверяем, выпала ли максимальная редкость
        const maxRarity = this.getMaxRarityFromWeights(lampConfig.weights);
        const isMaxRarity = rarity === maxRarity;

        // ИЗМЕНЕНИЕ: Уровень = random(heroLevel - offset, heroLevel)
        const level = this.rollItemLevel(this.hero.level, isMaxRarity);

        // Сила предмета
        const targetPower = this.calculateItemPower(level, rarity);
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

    /**
     * Генерация уровня предмета с диапазоном
     */
    protected rollItemLevel(heroLevel: number, isMaxRarity: boolean): number {
        const offset = isMaxRarity ? MAX_RARITY_LEVEL_OFFSET : MIN_LEVEL_OFFSET;
        const minLevel = Math.max(1, heroLevel - offset);
        return Math.floor(Math.random() * (heroLevel - minLevel + 1)) + minLevel;
    }

    /**
     * Получить максимальную редкость из весов
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
}
