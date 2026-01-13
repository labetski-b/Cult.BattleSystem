/**
 * V4: GuaranteedUpgradeSimulator — добавляет гарантированный апгрейд
 *
 * Отличия от PowerVarianceSimulator (V3):
 * - Гарантированный апгрейд каждые N лутов
 * - N увеличивается на 1 каждые increaseEveryNStages стадий
 * - Предмет для самого слабого слота с максимальным уровнем
 */

import { PowerVarianceSimulator } from './PowerVarianceSimulator';
import { Item, SlotType } from './types';
import {
    getLampLevelConfig, getUnlockedSlots, rollRarity,
    generateItemId
} from './config';

// Параметры Guaranteed Upgrade фичи
const GUARANTEED_UPGRADE_BASE_EVERY_N = 4;
const GUARANTEED_UPGRADE_INCREASE_EVERY_N_STAGES = 14;

export class GuaranteedUpgradeSimulator extends PowerVarianceSimulator {
    // Счётчик лутов для гарантированного апгрейда
    private guaranteedUpgradeLootCounter = 0;

    protected lootOneItem(): boolean {
        this.rarityLootCounter++;
        this.guaranteedUpgradeLootCounter++;

        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Получаем гарантированную редкость для текущей главы
        const { rarity: guaranteedRarity, expectedFilled, totalDrops } = this.getGuaranteedRarityWithExpected(
            this.lamp.level,
            unlockedSlots.length,
            this.chapter
        );
        const rarityInterval = Math.round((totalDrops / expectedFilled) * 1.0);

        // Вычисляем интервал гарантированного апгрейда
        const guaranteedEveryN = this.calculateGuaranteedEveryN(currentStage);

        let item: Item;
        let isGuaranteedUpgrade = false;

        // Проверяем гарантированный апгрейд (приоритет над гарантированной редкостью)
        if (guaranteedEveryN > 0 && this.guaranteedUpgradeLootCounter >= guaranteedEveryN) {
            item = this.generateGuaranteedUpgradeItem(currentStage);
            this.guaranteedUpgradeLootCounter = 0;
            isGuaranteedUpgrade = true;
        }
        // Проверяем гарантированную редкость
        else if (rarityInterval > 0 && this.rarityLootCounter >= rarityInterval) {
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

        if (item.power > currentPower || isGuaranteedUpgrade) {
            this.hero.equipment[item.slot] = item;
            this.updateHeroStats();
            return true;
        }

        this.totalIterations++;
        return false;
    }

    /**
     * Вычислить интервал гарантированного апгрейда для текущей стадии
     */
    private calculateGuaranteedEveryN(currentStage: number): number {
        const stageIncrease = Math.floor(currentStage / GUARANTEED_UPGRADE_INCREASE_EVERY_N_STAGES);
        return GUARANTEED_UPGRADE_BASE_EVERY_N + stageIncrease;
    }

    /**
     * Генерация предмета для гарантированного апгрейда
     * Выбирает самый слабый слот и даёт предмет максимального уровня
     */
    private generateGuaranteedUpgradeItem(currentStage: number): Item {
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
     * Найти самый слабый слот (по силе экипированного предмета)
     */
    private findWeakestSlot(unlockedSlots: SlotType[]): SlotType {
        let weakestSlot = unlockedSlots[0];
        let weakestPower = Infinity;

        for (const slot of unlockedSlots) {
            const item = this.hero.equipment[slot];
            const power = item?.power || 0;

            if (power < weakestPower) {
                weakestPower = power;
                weakestSlot = slot;
            }
        }

        return weakestSlot;
    }

    protected recordStageMetrics(chapter: number, stage: number, enemyPower: number): void {
        const currentStage = this.getCurrentStageNumber();
        const unlockedSlots = getUnlockedSlots(currentStage);

        const { rarity: guaranteedRarity, expectedFilled, totalDrops } = this.getGuaranteedRarityWithExpected(
            this.lamp.level,
            unlockedSlots.length,
            chapter
        );
        const rarityInterval = Math.round((totalDrops / expectedFilled) * 1.0);
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
            guaranteedRarity: guaranteedRarity,
            totalDrops: rarityInterval
        });
    }
}
