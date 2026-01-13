/**
 * V2: PowerVarianceSimulator — добавляет разброс силы предметов
 *
 * Отличия от ItemLevelRangeSimulator (V1):
 * - Сила предмета = targetPower * (1 - variance + random * 2 * variance)
 * - По умолчанию variance = 0.10 (±10%)
 * - Редкости пока нет — все предметы common
 */

import { ItemLevelRangeSimulator } from './ItemLevelRangeSimulator';
import { Item, Rarity } from './types';
import {
    getUnlockedSlots,
    generateItemId
} from './config';

// Параметры Power Variance фичи
const POWER_VARIANCE = 0.10;  // ±10% разброс силы

export class PowerVarianceSimulator extends ItemLevelRangeSimulator {

    protected lootOneItem(): boolean {
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Пока нет редкостей — все common
        const rarity: Rarity = 'common';

        // Уровень = random(heroLevel - offset, heroLevel)
        const level = this.rollItemLevel(this.hero.level);

        // ИЗМЕНЕНИЕ: Сила с разбросом
        const basePower = this.calculateItemPower(level, rarity);
        const targetPower = this.applyVariance(basePower);

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
     * Применить разброс к силе предмета
     * targetPower * (1 - variance + random * 2 * variance)
     */
    protected applyVariance(basePower: number): number {
        const variance = POWER_VARIANCE;
        const randomFactor = 1 - variance + Math.random() * 2 * variance;
        return basePower * randomFactor;
    }
}
