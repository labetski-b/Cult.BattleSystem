/**
 * V1: ItemLevelRangeSimulator — добавляет диапазон уровня предмета
 *
 * Отличия от Baseline:
 * - Уровень предмета = random(heroLevel - offset, heroLevel) вместо просто heroLevel
 * - Редкости пока нет — все предметы common
 */

import { BaselineSimulator } from './BaselineSimulator';
import { Item, Rarity } from './types';
import {
    getUnlockedSlots,
    generateItemId,
    calculateSellPrice
} from './config';

// Параметры Item Level Range фичи
const MIN_LEVEL_OFFSET = 5;  // Offset для диапазона уровня

export class ItemLevelRangeSimulator extends BaselineSimulator {

    protected lootOneItem(): boolean {
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Пока нет редкостей — все common
        const rarity: Rarity = 'common';

        // ИЗМЕНЕНИЕ: Уровень = random(heroLevel - offset, heroLevel)
        const level = this.rollItemLevel(this.hero.level);

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
            // Апгрейд — надеваем
            this.hero.equipment[slot] = item;
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
     * Генерация уровня предмета с диапазоном
     */
    protected rollItemLevel(heroLevel: number): number {
        const minLevel = Math.max(1, heroLevel - MIN_LEVEL_OFFSET);
        return Math.floor(Math.random() * (heroLevel - minLevel + 1)) + minLevel;
    }
}
