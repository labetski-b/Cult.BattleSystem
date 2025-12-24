# Формулы баланса

## Опыт (Experience)

### Опыт за этап
XP за прохождение этапа берётся из таблицы `stageTable` в `data/enemies.json`:
```
xpReward = stageTable[globalStage - 1].xp
```

### Опыт для уровня
```
xpRequiredForLevel(level) = xpTable[level]
```
- `xpTable` = массив из experience.json (100 значений)
- `maxLevel` = из experience.json (100)

Примеры значений:
| Lvl | XP |
|-----|-----|
| 1→2 | 80 |
| 2→3 | 145 |
| 3→4 | 195 |
| 10→11 | 1050 |
| 50→51 | 179880 |
| 99→100 | 16145840 |

---

## Предметы (Items)

### Effective Power (сила предмета для сравнения)
```
effectivePower = hp + 4 * damage
```

### Target Power (целевая сила предмета)
```
targetPower = basePowerPerLevel * powerGrowthPerLevel^(itemLevel-1) * rarityMultiplier
```
- `basePowerPerLevel` = 20 (из items.json)
- `powerGrowthPerLevel` = 1.5 (из items.json) — множитель роста за уровень (+50%)
- `rarityMultiplier` = из rarities.json (1.0 ... 11.39)

### Уровень предмета
```
// Для обычных редкостей:
itemLevel = random(heroLevel - minLevelOffset, heroLevel)

// Для максимальной редкости лампы:
itemLevel = random(heroLevel - maxRarityLevelOffset, heroLevel)
```
- `minLevelOffset` = 3 (из items.json)
- `maxRarityLevelOffset` = 1 (из items.json)

### Генерация статов предмета
```
effectiveMultiplier = hpRatio + 4 * damageRatio  // из slotRatios
variance = 0.85 + random() * 0.3                 // ±15%
actualTarget = targetPower * variance
internalPower = actualTarget / effectiveMultiplier
hp = floor(internalPower * hpRatio)
damage = floor(internalPower * damageRatio)
power = hp + 4 * damage  // итоговый effectivePower
```

### Effective Multiplier по слотам
| Слот | hpRatio | dmgRatio | effectiveMultiplier |
|------|---------|----------|---------------------|
| helmet | 0.8 | 0.2 | 1.6 |
| armor | 0.9 | 0.1 | 1.3 |
| weapon | 0.1 | 0.9 | 3.7 |
| shield | 0.7 | 0.3 | 1.9 |
| boots | 0.6 | 0.4 | 2.2 |
| accessory | 0.5 | 0.5 | 2.5 |

---

## Герой (Hero)

### Сила Культа (для отображения)
```
heroPower = maxHp + damage * 4
```

---

## Враги (Enemies)

Все настройки в `data/enemies.json`

### Сила врага на этапе (из таблицы + множитель редкости)
```
globalStage = (chapter - 1) * stagesPerChapter + stage
basePower = stageTable[globalStage - 1].power
rarityMultiplier = calculateExpectedRarityMultiplier(lampLevel)
enemyPower = basePower * rarityMultiplier
```
- `stageTable` = массив из enemies.json (100 записей с power и xp)
- `stagesPerChapter` = из enemies.json (10)
- `rarityMultiplier` = средневзвешенный множитель редкости для текущего уровня лампы

### Ожидаемый множитель редкости
```
expectedMultiplier = Σ(weight[rarity] * multiplier[rarity]) / totalWeight
```
Пример для лампы 6 уровня (weights: common=79, good=16, rare=5):
- common: 79 × 1.0 = 79
- good: 16 × 1.5 = 24
- rare: 5 × 2.25 = 11.25
- expectedMultiplier = 114.25 / 100 = **1.14**

Примеры значений:
| Dungeon | Power | XP |
|---------|-------|-----|
| 1-1 | 10 | 10 |
| 1-10 | 100 | 15 |
| 2-10 | 112 | 20 |
| 5-10 | 263 | 35 |
| 10-10 | 1798 | 55 |

### Босс
```
bossPower = enemyPower * powerMultiplier
```
- `powerMultiplier` = из enemies.json/boss (1.1)

### Статы врага
```
variance = 0.9 + random() * 0.2  // ±10%
power = targetPower * variance
hp = floor(power * hpRatio)
damage = max(1, floor(power * damageRatio))
```
- `hpRatio` = из enemies.json/stats (0.6)
- `damageRatio` = из enemies.json/stats (0.13)

### Волны врагов
- Обычный этап: minEnemies-maxEnemies врагов, сила делится поровну
- Босс: 1 враг с полной силой

---

## Конфигурационные файлы

| Файл | Содержимое |
|------|------------|
| `data/items.json` | basePowerPerLevel, powerGrowthPerLevel, levelRange, slotRatios |
| `data/rarities.json` | 7 редкостей с multiplier |
| `data/lamp-levels.json` | 31 уровень лампы с весами редкостей |
| `data/enemies.json` | stageTable[] (power, xp), волны, босс, статы |
| `data/experience.json` | maxLevel, xpTable[] |
| `data/balance.json` | combat, economy |
