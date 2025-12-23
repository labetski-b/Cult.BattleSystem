import { Item, SlotType, SLOT_TYPES } from './Item';
import experienceConfig from '../../data/experience.json';

// Базовые статы героя (без экипировки)
export const BASE_HERO_STATS = {
    hp: 0,
    damage: 0
};

export interface Hero {
    hp: number;
    maxHp: number;
    damage: number;      // Урон героя
    power: number;       // Сохраняем для обратной совместимости
    equipment: Record<SlotType, Item | null>;
    gold: number;
    lamps: number;
    level: number;       // Уровень героя
    xp: number;          // Текущий опыт
}

// Расчёт суммарных статов героя от экипировки
export interface HeroStats {
    totalHp: number;
    totalDamage: number;
    totalPower: number;
}

export function calculateHeroStats(hero: Hero): HeroStats {
    let bonusHp = 0;
    let bonusDamage = 0;
    let totalPower = 0;

    for (const slot of SLOT_TYPES) {
        const item = hero.equipment[slot];
        if (item) {
            bonusHp += item.hp || 0;
            bonusDamage += item.damage || 0;
            totalPower += item.power || 0;
        }
    }

    return {
        totalHp: BASE_HERO_STATS.hp + bonusHp,
        totalDamage: BASE_HERO_STATS.damage + bonusDamage,
        totalPower: totalPower
    };
}

// Создание нового героя
export function createHero(): Hero {
    const equipment: Record<SlotType, Item | null> = {
        helmet: null,
        armor: null,
        weapon: null,
        shield: null,
        boots: null,
        accessory: null
    };

    return {
        hp: BASE_HERO_STATS.hp,
        maxHp: BASE_HERO_STATS.hp,
        damage: BASE_HERO_STATS.damage,
        power: 0, // Сила от экипировки
        equipment,
        gold: 0,
        lamps: 20, // Начальные лампы
        level: 1,
        xp: 0
    };
}

// Расчёт суммарной силы героя (для обратной совместимости)
export function calculateHeroPower(hero: Hero): number {
    let totalPower = 0;

    for (const slot of SLOT_TYPES) {
        const item = hero.equipment[slot];
        if (item) {
            totalPower += item.power;
        }
    }

    return totalPower;
}

// Расчёт макс HP на основе экипировки (DEPRECATED - используйте calculateHeroStats)
export function calculateHeroMaxHp(_power: number, _hpPerPower: number): number {
    // Теперь HP считается напрямую от экипировки
    return BASE_HERO_STATS.hp;
}

// Обновить все статы героя после изменения экипировки
export function updateHeroStats(hero: Hero): void {
    const stats = calculateHeroStats(hero);
    hero.maxHp = stats.totalHp;
    hero.damage = stats.totalDamage;
    hero.power = stats.totalPower;
    // Не превышаем maxHp
    if (hero.hp > hero.maxHp) {
        hero.hp = hero.maxHp;
    }
}

// Экипировка предмета
export function equipItem(hero: Hero, item: Item): Item | null {
    const oldItem = hero.equipment[item.slot];
    hero.equipment[item.slot] = item;
    hero.power = calculateHeroPower(hero);
    return oldItem;
}

// Восстановление HP
export function healHero(hero: Hero): void {
    hero.hp = hero.maxHp;
}

// === Система опыта ===

// Таблица XP из конфига (индекс = уровень, значение = XP для перехода на следующий)
const xpTable: number[] = experienceConfig.xpTable;

// Опыт, необходимый для перехода на указанный уровень
// xpRequiredForLevel(2) = XP нужный чтобы перейти с 1 на 2 = xpTable[1]
export function xpRequiredForLevel(level: number): number {
    if (level < 2 || level > xpTable.length) return 0;
    return xpTable[level - 1];
}

// Общий опыт от начала до указанного уровня
export function totalXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i < level && i < xpTable.length; i++) {
        total += xpTable[i];
    }
    return total;
}

// Результат добавления опыта
export interface XpGainResult {
    xpGained: number;
    levelsGained: number;
    newLevel: number;
}

// Добавить опыт герою
export function addXp(hero: Hero, amount: number): XpGainResult {
    const startLevel = hero.level;
    hero.xp += amount;

    // Проверяем повышение уровня
    while (hero.level < experienceConfig.maxLevel) {
        const xpNeeded = xpRequiredForLevel(hero.level + 1);
        if (hero.xp >= xpNeeded) {
            hero.xp -= xpNeeded;
            hero.level++;
        } else {
            break;
        }
    }

    // На максимальном уровне опыт не копится
    if (hero.level >= experienceConfig.maxLevel) {
        hero.xp = 0;
    }

    return {
        xpGained: amount,
        levelsGained: hero.level - startLevel,
        newLevel: hero.level
    };
}

// Прогресс до следующего уровня (0-1)
export function xpProgress(hero: Hero): number {
    if (hero.level >= experienceConfig.maxLevel) return 1;
    const xpNeeded = xpRequiredForLevel(hero.level + 1);
    if (xpNeeded <= 0) return 1;
    return hero.xp / xpNeeded;
}
