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
export function generateEnemy(targetPower: number, isBoss: boolean = false): Enemy {
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
    const k = enemiesConfig.stats.hpToDamageRatio;
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
        return [generateEnemy(targetPower, true)];
    }

    const count = Math.floor(Math.random() * (maxEnemies - minEnemies + 1)) + minEnemies;
    const powerPerEnemy = targetPower / count;

    const enemies: Enemy[] = [];
    for (let i = 0; i < count; i++) {
        enemies.push(generateEnemy(powerPerEnemy));
    }

    return enemies;
}
