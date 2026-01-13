/**
 * V3: PowerVarianceSimulator — добавляет разброс силы предметов
 *
 * Отличия от GuaranteedRaritySimulator (V2):
 * - Сила предмета = targetPower * (1 - variance + random * 2 * variance)
 * - По умолчанию variance = 0.10 (±10%)
 */

import { GuaranteedRaritySimulator } from './GuaranteedRaritySimulator';
import { Item, Rarity } from './types';
import {
    getLampLevelConfig, getUnlockedSlots, rollRarity,
    generateItemId
} from './config';

// Параметры Power Variance фичи
const POWER_VARIANCE = 0.10;  // ±10% разброс силы

export class PowerVarianceSimulator extends GuaranteedRaritySimulator {

    protected generateNormalItem(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Случайная редкость по весам лампы
        const lampConfig = getLampLevelConfig(this.lamp.level);
        const rarity = rollRarity(lampConfig.weights);

        // Проверяем, выпала ли максимальная редкость
        const maxRarity = this.getMaxRarityFromWeights(lampConfig.weights);
        const isMaxRarity = rarity === maxRarity;

        // Уровень = random(heroLevel - offset, heroLevel)
        const level = this.rollItemLevel(this.hero.level, isMaxRarity);

        // ИЗМЕНЕНИЕ: Сила с разбросом
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

    protected generateGuaranteedRarityItem(currentStage: number, guaranteedRarity: Rarity): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Уровень = уровень героя (максимальный для гарантированной редкости)
        const level = this.hero.level;

        // ИЗМЕНЕНИЕ: Сила с разбросом
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
     * Применить разброс к силе предмета
     * targetPower * (1 - variance + random * 2 * variance)
     */
    protected applyVariance(basePower: number): number {
        const variance = POWER_VARIANCE;
        const randomFactor = 1 - variance + Math.random() * 2 * variance;
        return basePower * randomFactor;
    }
}
