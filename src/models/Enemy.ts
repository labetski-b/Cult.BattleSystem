import enemiesConfig from '../../data/enemies.json';

export interface Enemy {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    damage: number;
    power: number;
    isBoss: boolean;
}

const ENEMY_NAMES = [
    'Гоблин', 'Скелет', 'Орк', 'Тролль', 'Зомби',
    'Призрак', 'Паук', 'Слайм', 'Крыса', 'Волк'
];

const BOSS_NAMES = [
    'Король Гоблинов', 'Лич', 'Вождь Орков', 'Горный Тролль',
    'Некромант', 'Демон Тьмы', 'Паучья Королева'
];

// Генерация врага из целевой силы
// customK — опциональный hpToDamageRatio (для волн из 2-3 врагов используется k героя)
export function generateEnemy(targetPower: number, isBoss: boolean = false, customK?: number): Enemy {
    const names = isBoss ? BOSS_NAMES : ENEMY_NAMES;
    const name = names[Math.floor(Math.random() * names.length)];

    // Враг имеет силу примерно равную целевой
    // TODO: вернуть разброс ±10% когда баланс будет настроен
    // const variance = 0.9 + Math.random() * 0.2;
    // const power = Math.floor(targetPower * variance);
    const power = Math.floor(targetPower);

    // HP и урон рассчитываются по формуле: power = hp + 4*damage
    // k = hpToDamageRatio (соотношение hp/damage)
    // damage = power / (4 + k); hp = damage * k
    const k = customK ?? enemiesConfig.stats.hpToDamageRatio;
    const damage = Math.max(1, Math.floor(power / (4 + k)));
    const hp = Math.floor(damage * k);

    return {
        id: `enemy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: isBoss ? `👑 ${name}` : name,
        hp,
        maxHp: hp,
        damage,
        power,
        isBoss
    };
}

// Генерация волны врагов
export function generateEnemyWave(
    targetPower: number,
    minEnemies: number,
    maxEnemies: number,
    isBossWave: boolean = false
): Enemy[] {
    if (isBossWave) {
        // Босс всегда один, использует стандартный k из конфига
        return [generateEnemy(targetPower, true)];
    }

    const count = Math.floor(Math.random() * (maxEnemies - minEnemies + 1)) + minEnemies;

    // Для 1 врага — стандартная генерация
    if (count === 1) {
        return [generateEnemy(targetPower, false)];
    }

    // Для 2-3 врагов — специальная формула:
    // totalHP = targetPower * 0.5, делится поровну
    // damage: 2 врага = targetPower * 0.083, 3 врага = targetPower * 0.0625
    const totalHp = Math.floor(targetPower * 0.5);
    const hpPerEnemy = Math.max(1, Math.floor(totalHp / count));
    const damageMultiplier = count === 2 ? 0.083 : 0.0625;
    const damage = Math.max(1, Math.floor(targetPower * damageMultiplier));

    const enemies: Enemy[] = [];
    for (let i = 0; i < count; i++) {
        const name = ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)];
        enemies.push({
            id: `enemy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name,
            hp: hpPerEnemy,
            maxHp: hpPerEnemy,
            damage,
            power: hpPerEnemy + damage * 4,
            isBoss: false
        });
    }

    return enemies;
}
