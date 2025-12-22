import { Item, SlotType, SLOT_TYPES } from './Item';

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
        lamps: 5 // Начальные лампы
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
