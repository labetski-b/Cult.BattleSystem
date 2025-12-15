import { Hero, createHero, updateHeroStats, equipItem, healHero } from '../models/Hero';
import { Item, calculateItemStats } from '../models/Item';
import { Enemy, generateEnemyWave } from '../models/Enemy';
import { Lamp, createLamp, generateItemFromLamp, LampConfig } from '../models/Lamp';
import { DungeonProgress, createDungeonProgress, advanceProgress, isBossStage, DungeonConfig } from './DungeonSystem';
import { simulateBattle, CombatConfig, BattleResult, BattleState, initBattleFromGameState, executeBattleRound } from './BattleSystem';
import balanceData from '../../data/balance.json';

// Re-export для использования в main.ts
export type { BattleState, BattleResult };
export { executeBattleRound };

// Типы из баланса
interface BalanceData {
    rarityMultipliers: Record<string, number>;
    rarityWeights: Record<string, number>;
    lampLevels: LampConfig[];
    dungeonScaling: DungeonConfig;
    combat: CombatConfig;
    economy: {
        goldPerEnemy: number;
        goldPerStageClear: number;
        lampsPerMinute: number;
    };
}

const balance: BalanceData = balanceData as BalanceData;

export interface GameState {
    hero: Hero;
    lamp: Lamp;
    dungeon: DungeonProgress;
    inventory: Item[];
    lastBattleResult: BattleResult | null;
    lastLootedItem: Item | null;
}

// Ключ для localStorage
const SAVE_KEY = 'cult_battle_save';

// Создание новой игры
export function createNewGame(): GameState {
    const hero = createHero();
    updateHeroStats(hero);
    hero.hp = hero.maxHp;

    return {
        hero,
        lamp: createLamp(balance.lampLevels[0]),
        dungeon: createDungeonProgress(),
        inventory: [],
        lastBattleResult: null,
        lastLootedItem: null
    };
}

// Сохранение игры
export function saveGame(state: GameState): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

// Загрузка игры с миграцией старых сохранений
export function loadGame(): GameState | null {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
        try {
            const state = JSON.parse(saved) as GameState;

            // Миграция: добавляем damage если отсутствует
            if (state.hero.damage === undefined) {
                state.hero.damage = 10; // Базовый урон
            }

            // Миграция: добавляем hp/damage к предметам если отсутствует
            for (const slotKey of Object.keys(state.hero.equipment)) {
                const item = state.hero.equipment[slotKey as keyof typeof state.hero.equipment];
                if (item) {
                    if (item.hp === undefined || item.damage === undefined) {
                        // Пересчитываем статы на основе power и слота
                        const stats = calculateItemStats(item.slot, item.power);
                        item.hp = stats.hp;
                        item.damage = stats.damage;
                    }
                }
            }

            // Пересчитываем статы героя после миграции
            updateHeroStats(state.hero);

            // Восстанавливаем HP если он был сброшен или равен 0
            if (state.hero.hp <= 0) {
                state.hero.hp = state.hero.maxHp;
            }

            return state;
        } catch {
            return null;
        }
    }
    return null;
}

// Открыть лут (потратить лампу)
export function openLoot(state: GameState): Item | null {
    if (state.hero.lamps <= 0) {
        return null;
    }

    state.hero.lamps--;

    const item = generateItemFromLamp(
        state.lamp,
        balance.rarityWeights as Record<string, number>,
        balance.rarityMultipliers as Record<string, number>
    );

    state.inventory.push(item);
    state.lastLootedItem = item;

    saveGame(state);
    return item;
}

// Экипировать предмет из инвентаря
export function equipFromInventory(state: GameState, itemId: string): boolean {
    const itemIndex = state.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return false;

    const item = state.inventory[itemIndex];
    const oldItem = equipItem(state.hero, item);

    // Удаляем из инвентаря
    state.inventory.splice(itemIndex, 1);

    // Если было старое — добавляем в инвентарь
    if (oldItem) {
        state.inventory.push(oldItem);
    }

    // Пересчитываем статы героя
    updateHeroStats(state.hero);

    saveGame(state);
    return true;
}

// Провести бой
export function fight(state: GameState): BattleResult {
    const isBoss = isBossStage(state.dungeon.stage);

    // Генерация врагов
    let targetPower = state.dungeon.currentEnemyPower;
    if (isBoss) {
        targetPower *= balance.dungeonScaling.bossMultiplier;
    }

    const enemies = generateEnemyWave(
        targetPower,
        balance.dungeonScaling.enemiesPerWave.min,
        balance.dungeonScaling.enemiesPerWave.max,
        isBoss
    );

    // Симуляция боя
    const result = simulateBattle(
        state.hero,
        enemies,
        balance.combat,
        balance.economy.goldPerEnemy
    );

    // Применяем результат
    state.hero.hp -= result.heroDamage;
    if (state.hero.hp < 0) state.hero.hp = 0;

    if (result.victory) {
        state.hero.gold += result.goldReward + balance.economy.goldPerStageClear;
        state.dungeon = advanceProgress(state.dungeon, balance.dungeonScaling);
        // После победы восстанавливаем HP
        healHero(state.hero);
    }

    state.lastBattleResult = result;
    saveGame(state);

    return result;
}

// Улучшить лампу
export function upgradeLamp(state: GameState): boolean {
    const currentLevel = state.lamp.level;
    const nextConfig = balance.lampLevels.find(l => l.level === currentLevel + 1);

    if (!nextConfig) return false; // Максимальный уровень

    const currentConfig = balance.lampLevels.find(l => l.level === currentLevel);
    if (!currentConfig) return false;

    if (state.hero.gold < currentConfig.upgradeCost) return false;

    state.hero.gold -= currentConfig.upgradeCost;
    state.lamp = createLamp(nextConfig);

    saveGame(state);
    return true;
}

// Добавить лампы (для тестирования)
export function addLamps(state: GameState, count: number): void {
    state.hero.lamps += count;
    saveGame(state);
}

// Добавить золото (для тестирования)
export function addGold(state: GameState, amount: number): void {
    state.hero.gold += amount;
    saveGame(state);
}

// Сброс игры
export function resetGame(): GameState {
    localStorage.removeItem(SAVE_KEY);
    return createNewGame();
}

// Получить текущий баланс
export function getBalance(): BalanceData {
    return balance;
}

// ===== Пошаговый бой =====

// Сгенерировать врагов для боя
export function generateEnemiesForBattle(state: GameState): Enemy[] {
    const isBoss = isBossStage(state.dungeon.stage);

    let targetPower = state.dungeon.currentEnemyPower;
    if (isBoss) {
        targetPower *= balance.dungeonScaling.bossMultiplier;
    }

    return generateEnemyWave(
        targetPower,
        balance.dungeonScaling.enemiesPerWave.min,
        balance.dungeonScaling.enemiesPerWave.max,
        isBoss
    );
}

// Инициализировать пошаговый бой
export function startStepBattle(state: GameState, enemies: Enemy[]): BattleState {
    return initBattleFromGameState(state.hero, enemies);
}

// Применить результат завершённого боя
export function applyBattleResult(
    state: GameState,
    battleState: BattleState,
    _enemies: Enemy[]
): BattleResult {
    const defeatedEnemies = battleState.enemies.filter(e => e.hp <= 0).map(e => e.name);
    const heroDamage = state.hero.hp - battleState.hero.hp;

    const result: BattleResult = {
        victory: battleState.victory,
        heroHpRemaining: Math.max(0, battleState.hero.hp),
        heroDamage: Math.max(0, heroDamage),
        enemiesDefeated: defeatedEnemies,
        goldReward: defeatedEnemies.length * balance.economy.goldPerEnemy,
        battleLog: battleState.log
    };

    // Применяем урон
    state.hero.hp -= result.heroDamage;
    if (state.hero.hp < 0) state.hero.hp = 0;

    if (result.victory) {
        state.hero.gold += result.goldReward + balance.economy.goldPerStageClear;
        state.dungeon = advanceProgress(state.dungeon, balance.dungeonScaling);
        healHero(state.hero);
    }

    state.lastBattleResult = result;
    saveGame(state);

    return result;
}
