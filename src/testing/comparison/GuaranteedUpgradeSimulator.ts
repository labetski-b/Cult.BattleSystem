/**
 * V3: GuaranteedUpgradeSimulator — добавляет гарантированный апгрейд
 *
 * Отличия от PowerVarianceSimulator (V2):
 * - Гарантированный апгрейд каждые N лутов
 * - N увеличивается на 1 каждые increaseEveryNStages стадий
 * - Предмет для самого слабого слота с максимальным уровнем
 * - Редкости пока нет — все предметы common
 */

import { PowerVarianceSimulator } from './PowerVarianceSimulator';
import { Item, Rarity, SlotType } from './types';
import {
    getUnlockedSlots,
    generateItemId,
    calculateSellPrice
} from './config';

// Параметры Guaranteed Upgrade фичи
const GUARANTEED_UPGRADE_BASE_EVERY_N = 4;
const GUARANTEED_UPGRADE_INCREASE_EVERY_N_STAGES = 14;

export class GuaranteedUpgradeSimulator extends PowerVarianceSimulator {
    // Счётчик лутов для гарантированного апгрейда
    private guaranteedUpgradeLootCounter = 0;

    protected lootOneItem(): boolean {
        this.guaranteedUpgradeLootCounter++;

        const currentStage = this.getCurrentStageNumber();

        // Вычисляем интервал гарантированного апгрейда
        const guaranteedEveryN = this.calculateGuaranteedEveryN(currentStage);

        let item: Item;
        let isGuaranteedUpgrade = false;

        // Проверяем гарантированный апгрейд
        if (guaranteedEveryN > 0 && this.guaranteedUpgradeLootCounter >= guaranteedEveryN) {
            item = this.generateGuaranteedUpgradeItem(currentStage);
            this.guaranteedUpgradeLootCounter = 0;
            isGuaranteedUpgrade = true;
        } else {
            // Обычный рандомный лут
            item = this.generateNormalItem(currentStage);
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
     * Генерация обычного предмета (без редкости, с variance)
     */
    protected generateNormalItem(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Случайный слот
        const slot = unlockedSlots[Math.floor(Math.random() * unlockedSlots.length)];

        // Пока нет редкостей — все common
        const rarity: Rarity = 'common';

        // Уровень = random(heroLevel - offset, heroLevel)
        const level = this.rollItemLevel(this.hero.level);

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
     * Вычислить интервал гарантированного апгрейда для текущей стадии
     */
    protected calculateGuaranteedEveryN(currentStage: number): number {
        const stageIncrease = Math.floor(currentStage / GUARANTEED_UPGRADE_INCREASE_EVERY_N_STAGES);
        return GUARANTEED_UPGRADE_BASE_EVERY_N + stageIncrease;
    }

    /**
     * Генерация предмета для гарантированного апгрейда
     * Выбирает самый слабый слот и даёт предмет максимального уровня
     */
    protected generateGuaranteedUpgradeItem(currentStage: number): Item {
        const unlockedSlots = getUnlockedSlots(currentStage);

        // Находим самый слабый слот
        const slot = this.findWeakestSlot(unlockedSlots);

        // Пока нет редкостей — все common
        const rarity: Rarity = 'common';

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
    protected findWeakestSlot(unlockedSlots: SlotType[]): SlotType {
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
            guaranteedRarity: 'common',
            totalDrops: 0
        });
    }
}
