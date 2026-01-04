import { Hero, createHero, updateHeroStats, equipItem, healHero } from '../models/Hero';
import { Item, migrateItemStats, SLOT_TYPES, SlotType, generateItemId, generateItemName, calculateItemStatsWithTargetPower } from '../models/Item';
import { Enemy, generateEnemyWave } from '../models/Enemy';
import { Lamp, createLamp, generateItemFromLamp, getUpgradeCost, getLampLevelConfig, MAX_LAMP_LEVEL, rollRarity } from '../models/Lamp';
import { getConfig } from '../config/ConfigStore';
import { DungeonProgress, createDungeonProgress, advanceProgress, isBossStage, BOSS_MULTIPLIER, getStageXpReward, STAGES_PER_CHAPTER } from './DungeonSystem';
import { simulateBattle, CombatConfig, BattleResult, BattleState, initBattleFromGameState, executeBattleRound } from './BattleSystem';
import balanceData from '../../data/balance.json';
import enemiesConfig from '../../data/enemies.json';

// Re-export для использования в main.ts
export type { BattleState, BattleResult };
export { executeBattleRound, getStageXpReward };

// Типы из баланса (только для combat, economy)
interface BalanceData {
    combat: CombatConfig;
    economy: {
        goldPerEnemy: number;
        goldPerStageClear: number;
        lampsPerMinute: number;
    };
}

const balance: BalanceData = balanceData as BalanceData;

// Конфиг врагов из enemies.json
const enemyConfig = {
    minEnemies: enemiesConfig.waves.minEnemies,
    maxEnemies: enemiesConfig.waves.maxEnemies,
    bossMultiplier: BOSS_MULTIPLIER
};

export interface GameState {
    hero: Hero;
    lamp: Lamp;
    dungeon: DungeonProgress;
    inventory: Item[];
    lastBattleResult: BattleResult | null;
    lastLootedItem: Item | null;
    lootCounter: number;  // Счётчик лутов для гарантированного апгрейда
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
        lamp: createLamp(1),
        dungeon: createDungeonProgress(),
        inventory: [],
        lastBattleResult: null,
        lastLootedItem: null,
        lootCounter: 0
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
                state.hero.damage = 0; // Базовый урон (теперь 0)
            }

            // Миграция: добавляем hp/damage к предметам если отсутствует
            for (const slotKey of Object.keys(state.hero.equipment)) {
                const item = state.hero.equipment[slotKey as keyof typeof state.hero.equipment];
                if (item) {
                    if (item.hp === undefined || item.damage === undefined) {
                        // Пересчитываем статы на основе power и слота
                        const stats = migrateItemStats(item.slot, item.power);
                        item.hp = stats.hp;
                        item.damage = stats.damage;
                    }
                }
            }

            // Миграция: конвертируем старый формат лампы в новый
            if (typeof state.lamp !== 'object' || state.lamp === null) {
                state.lamp = createLamp(1);
            } else if ('maxRarity' in state.lamp) {
                // Старый формат с maxRarity - конвертируем в новый
                state.lamp = createLamp(state.lamp.level || 1);
            }

            // Миграция: добавляем level и xp если отсутствуют
            if (state.hero.level === undefined) {
                state.hero.level = 1;
            }
            if (state.hero.xp === undefined) {
                state.hero.xp = 0;
            }

            // Миграция: добавляем lootCounter если отсутствует
            if (state.lootCounter === undefined) {
                state.lootCounter = 0;
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

// Генерация гарантированного апгрейда для самого слабого слота
function generateGuaranteedUpgrade(state: GameState): Item {
    const config = getConfig();

    // Находим самый слабый экипированный предмет
    let weakestSlot: SlotType | null = null;
    let weakestPower = Infinity;

    for (const slot of SLOT_TYPES) {
        const equipped = state.hero.equipment[slot];
        const power = equipped?.power || 0;
        if (power < weakestPower) {
            weakestPower = power;
            weakestSlot = slot;
        }
    }

    // Если нет экипировки — берём первый доступный слот
    if (weakestSlot === null) {
        weakestSlot = SLOT_TYPES[0];
    }

    // Целевая сила = текущая × множитель
    const targetPower = Math.max(1, Math.floor(weakestPower * config.guaranteedUpgradeMultiplier));

    // Генерируем редкость через лампу
    const lampConfig = getLampLevelConfig(state.lamp.level);
    const rarity = rollRarity(lampConfig.weights);

    // Генерируем предмет с заданной силой
    const stats = calculateItemStatsWithTargetPower(weakestSlot, targetPower, rarity);

    return {
        id: generateItemId(),
        name: generateItemName(weakestSlot, rarity),
        rarity,
        level: stats.level,
        slot: weakestSlot,
        power: stats.power,
        hp: stats.hp,
        damage: stats.damage
    };
}

// Открыть лут (потратить лампу)
export function openLoot(state: GameState): Item | null {
    if (state.hero.lamps <= 0) {
        return null;
    }

    state.hero.lamps--;
    state.lootCounter++;

    // Вычисляем общий номер стадии для разблокировки слотов
    const currentStage = (state.dungeon.chapter - 1) * STAGES_PER_CHAPTER + state.dungeon.stage;

    const config = getConfig();
    let item: Item;

    // Проверяем, нужен ли гарантированный апгрейд
    if (config.guaranteedUpgradeEveryN > 0 &&
        state.lootCounter % config.guaranteedUpgradeEveryN === 0) {
        // Гарантированный апгрейд: генерируем предмет для самого слабого слота
        item = generateGuaranteedUpgrade(state);
    } else {
        // Обычный рандомный лут
        item = generateItemFromLamp(state.lamp, state.hero.level, currentStage);
    }

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

    // Генерация врагов (используем enemies.json)
    let targetPower = state.dungeon.currentEnemyPower;
    if (isBoss) {
        targetPower *= enemyConfig.bossMultiplier;
    }

    const enemies = generateEnemyWave(
        targetPower,
        enemyConfig.minEnemies,
        enemyConfig.maxEnemies,
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
        state.dungeon = advanceProgress(state.dungeon);
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

    // Проверяем, не максимальный ли уровень
    if (currentLevel >= MAX_LAMP_LEVEL) {
        return false;
    }

    const cost = getUpgradeCost(currentLevel);
    if (cost === null) return false;

    if (state.hero.gold < cost) return false;

    state.hero.gold -= cost;
    state.lamp = createLamp(currentLevel + 1);

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

// Получить конфиг текущего уровня лампы
export function getCurrentLampConfig(state: GameState) {
    return getLampLevelConfig(state.lamp.level);
}

// ===== Пошаговый бой =====

// Сгенерировать врагов для боя
export function generateEnemiesForBattle(state: GameState): Enemy[] {
    const isBoss = isBossStage(state.dungeon.stage);

    // Используем enemies.json
    let targetPower = state.dungeon.currentEnemyPower;
    if (isBoss) {
        targetPower *= enemyConfig.bossMultiplier;
    }

    return generateEnemyWave(
        targetPower,
        enemyConfig.minEnemies,
        enemyConfig.maxEnemies,
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
        state.dungeon = advanceProgress(state.dungeon);
        healHero(state.hero);
    }

    state.lastBattleResult = result;
    saveGame(state);

    return result;
}
