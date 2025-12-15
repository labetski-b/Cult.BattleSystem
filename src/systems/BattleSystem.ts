/**
 * Алгоритм генерации врагов из целевой силы
 *
 * Принцип: Целевая сила распределяется между 1-3 врагами.
 * Чем больше врагов — тем слабее каждый, но больше суммарного урона.
 *
 * Формулы:
 * - HP врага = power * hpMultiplier (по умолчанию 2)
 * - Урон врага = power * damageMultiplier (по умолчанию 0.3)
 * - Сила врага = HP + Урон * некий коэффициент
 */

import { Hero } from '../models/Hero';
import { Enemy } from '../models/Enemy';

// Конфигурация боя из balance.json
export interface CombatConfig {
    baseDamage: number;
    hpPerPower: number;
    damagePerPower: number;
}

// Результат симуляции боя
export interface BattleResult {
    victory: boolean;
    heroHpRemaining: number;
    heroDamage: number;
    enemiesDefeated: string[];
    goldReward: number;
    battleLog: BattleLogEntry[];
}

export interface BattleUnit {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    damage: number;
    isHero: boolean;
}

export interface BattleState {
    hero: BattleUnit;
    enemies: BattleUnit[];
    log: BattleLogEntry[];
    currentTurn: number;
    isComplete: boolean;
    victory: boolean;
}

export interface BattleLogEntry {
    turn: number;
    attacker: string;
    target: string;
    damage: number;
    targetHpAfter: number;
    isCritical?: boolean;
}

// Имена врагов
const ENEMY_PREFIXES = ['', 'Злой ', 'Тёмный ', 'Проклятый ', 'Безумный '];
const ENEMY_NAMES = ['Гоблин', 'Скелет', 'Орк', 'Зомби', 'Слайм', 'Крыса', 'Паук', 'Волк', 'Призрак'];
const BOSS_NAMES = ['Король Гоблинов', 'Лич', 'Вождь Орков', 'Демон', 'Некромант'];

/**
 * Генерация врагов из целевой силы
 * 
 * Алгоритм:
 * 1. Определяем количество врагов (1-3)
 * 2. Распределяем целевую силу между врагами с вариацией
 * 3. Конвертируем силу в HP и урон
 */
export function generateEnemiesFromPower(
    targetPower: number,
    enemyCount: number,
    isBoss: boolean = false
): BattleUnit[] {
    const enemies: BattleUnit[] = [];

    // Босс — один сильный враг
    if (isBoss) {
        return [createEnemy(targetPower, true)];
    }

    // Распределяем силу между врагами
    const basePowerPerEnemy = targetPower / enemyCount;

    for (let i = 0; i < enemyCount; i++) {
        // Вариация силы ±20%
        const variance = 0.8 + Math.random() * 0.4;
        const enemyPower = Math.floor(basePowerPerEnemy * variance);
        enemies.push(createEnemy(enemyPower, false));
    }

    return enemies;
}

/**
 * Создать одного врага из его силы
 * 
 * Формула конвертации силы в статы:
 * - power = hp/2 + damage*3
 * - Решая: hp = power * 0.6, damage = power * 0.15
 */
function createEnemy(power: number, isBoss: boolean): BattleUnit {
    const names = isBoss ? BOSS_NAMES : ENEMY_NAMES;
    const prefix = isBoss ? '👑 ' : ENEMY_PREFIXES[Math.floor(Math.random() * ENEMY_PREFIXES.length)];
    const name = names[Math.floor(Math.random() * names.length)];

    // Конвертация силы в статы
    // Больше HP = tankier, больше damage = опаснее
    // Баланс: HP важнее чтобы бой длился дольше
    const hpRatio = 0.6;
    const damageRatio = 0.13;

    const hp = Math.floor(power * hpRatio);
    const damage = Math.max(1, Math.floor(power * damageRatio));

    return {
        id: `enemy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: prefix + name,
        hp,
        maxHp: hp,
        damage,
        isHero: false
    };
}

/**
 * Создать героя для боя из его характеристик
 */
export function createBattleHeroFromStats(heroHp: number, heroMaxHp: number, heroDamage: number): BattleUnit {
    return {
        id: 'hero',
        name: 'Герой',
        hp: heroHp,
        maxHp: heroMaxHp,
        damage: heroDamage,
        isHero: true
    };
}

/**
 * Инициализация нового боя
 */
export function initBattle(hero: BattleUnit, enemies: BattleUnit[]): BattleState {
    return {
        hero: { ...hero },
        enemies: enemies.map(e => ({ ...e })),
        log: [],
        currentTurn: 0,
        isComplete: false,
        victory: false
    };
}

/**
 * Выполнить один раунд боя (герой бьёт, потом все враги бьют)
 * Возвращает обновлённое состояние
 */
export function executeBattleRound(state: BattleState): BattleState {
    const newState = {
        ...state,
        hero: { ...state.hero },
        enemies: state.enemies.map(e => ({ ...e })),
        log: [...state.log]
    };

    newState.currentTurn++;

    // 1. Герой атакует первого живого врага
    const aliveEnemies = newState.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length > 0) {
        const target = aliveEnemies[0];
        const targetIndex = newState.enemies.findIndex(e => e.id === target.id);

        const damage = newState.hero.damage;
        newState.enemies[targetIndex].hp = Math.max(0, newState.enemies[targetIndex].hp - damage);

        newState.log.push({
            turn: newState.currentTurn,
            attacker: newState.hero.name,
            target: target.name,
            damage,
            targetHpAfter: newState.enemies[targetIndex].hp
        });
    }

    // 2. Каждый живой враг атакует героя
    const stillAliveEnemies = newState.enemies.filter(e => e.hp > 0);
    for (const enemy of stillAliveEnemies) {
        if (newState.hero.hp <= 0) break; // Герой уже мёртв

        const damage = enemy.damage;
        newState.hero.hp = Math.max(0, newState.hero.hp - damage);

        newState.log.push({
            turn: newState.currentTurn,
            attacker: enemy.name,
            target: newState.hero.name,
            damage,
            targetHpAfter: newState.hero.hp
        });
    }

    // 3. Проверка завершения боя
    const allEnemiesDead = newState.enemies.every(e => e.hp <= 0);
    const heroIsDead = newState.hero.hp <= 0;

    if (allEnemiesDead || heroIsDead) {
        newState.isComplete = true;
        newState.victory = allEnemiesDead && !heroIsDead;
    }

    return newState;
}

/**
 * Запустить полный бой до конца (для мгновенного результата)
 */
export function runFullBattle(hero: BattleUnit, enemies: BattleUnit[]): BattleState {
    let state = initBattle(hero, enemies);

    // Максимум 100 раундов для защиты от бесконечных циклов
    while (!state.isComplete && state.currentTurn < 100) {
        state = executeBattleRound(state);
    }

    return state;
}

/**
 * Получить шаги анимации боя (для пошаговой визуализации)
 */
export interface BattleAnimationStep {
    type: 'hero_attack' | 'enemy_attack' | 'hero_death' | 'enemy_death' | 'victory' | 'defeat';
    attackerId: string;
    targetId: string;
    damage: number;
    targetHpAfter: number;
    targetMaxHp: number;
}

export function getBattleAnimationSteps(finalState: BattleState): BattleAnimationStep[] {
    const steps: BattleAnimationStep[] = [];

    for (const entry of finalState.log) {
        const isHeroAttack = entry.attacker === 'Герой';

        steps.push({
            type: isHeroAttack ? 'hero_attack' : 'enemy_attack',
            attackerId: isHeroAttack ? 'hero' : 'enemy',
            targetId: isHeroAttack ? 'enemy' : 'hero',
            damage: entry.damage,
            targetHpAfter: entry.targetHpAfter,
            targetMaxHp: isHeroAttack ? 100 : finalState.hero.maxHp // Примерно
        });
    }

    // Добавляем финальный шаг
    steps.push({
        type: finalState.victory ? 'victory' : 'defeat',
        attackerId: '',
        targetId: '',
        damage: 0,
        targetHpAfter: 0,
        targetMaxHp: 0
    });

    return steps;
}

/**
 * Симуляция полного боя (для мгновенного результата)
 * Используется в GameState.fight()
 */
export function simulateBattle(
    hero: Hero,
    enemies: Enemy[],
    _config: CombatConfig,
    goldPerEnemy: number
): BattleResult {
    // Конвертируем героя в BattleUnit с его реальными статами
    const heroUnit = createBattleHeroFromStats(hero.hp, hero.maxHp, hero.damage);

    // Конвертируем врагов в BattleUnit[]
    const enemyUnits: BattleUnit[] = enemies.map(enemy => ({
        id: enemy.id,
        name: enemy.name,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        damage: enemy.damage,
        isHero: false
    }));

    // Запускаем полный бой
    const finalState = runFullBattle(heroUnit, enemyUnits);

    // Считаем побеждённых врагов
    const defeatedEnemies = finalState.enemies.filter(e => e.hp <= 0).map(e => e.name);

    // Считаем урон по герою
    const heroDamage = hero.hp - finalState.hero.hp;

    return {
        victory: finalState.victory,
        heroHpRemaining: Math.max(0, finalState.hero.hp),
        heroDamage: Math.max(0, heroDamage),
        enemiesDefeated: defeatedEnemies,
        goldReward: defeatedEnemies.length * goldPerEnemy,
        battleLog: finalState.log
    };
}

/**
 * Инициализация пошагового боя из Hero и Enemy[]
 * Используется для UI пошаговой визуализации
 */
export function initBattleFromGameState(
    hero: Hero,
    enemies: Enemy[]
): BattleState {
    // Используем реальные статы героя
    const heroUnit = createBattleHeroFromStats(hero.hp, hero.maxHp, hero.damage);

    // Используем реальные статы врагов
    const enemyUnits: BattleUnit[] = enemies.map(enemy => ({
        id: enemy.id,
        name: enemy.name,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        damage: enemy.damage,
        isHero: false
    }));

    return initBattle(heroUnit, enemyUnits);
}
