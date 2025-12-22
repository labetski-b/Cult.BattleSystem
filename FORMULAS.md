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
targetPower = basePowerPerLevel * 1.5^(itemLevel-1) * rarityMultiplier
```
- `basePowerPerLevel` = 20 (из items.json)
- `1.5` = множитель роста за уровень (+50%)
- `rarityMultiplier` = из rarities.json (1.0 ... 11.39)

### Уровень предмета
```
// Для обычных редкостей:
itemLevel = random(dungeonChapter - minLevelOffset, dungeonChapter)

// Для максимальной редкости лампы:
itemLevel = random(dungeonChapter - maxRarityLevelOffset, dungeonChapter)
```
- `minLevelOffset` = 2 (из items.json)
- `maxRarityLevelOffset` = 0 (из items.json) — топовые вещи всегда максимального уровня

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

### Сила врага на этапе (из таблицы)
```
globalStage = (chapter - 1) * stagesPerChapter + stage
enemyPower = stageTable[globalStage - 1].power
```
- `stageTable` = массив из enemies.json (100 записей с power и xp)
- `stagesPerChapter` = из enemies.json (10)

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
- `powerMultiplier` = из enemies.json/boss (1.3)

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
| `data/items.json` | basePowerPerLevel, levelRange, slotRatios |
| `data/rarities.json` | 7 редкостей с multiplier |
| `data/lamp-levels.json` | 31 уровень лампы с весами редкостей |
| `data/enemies.json` | stageTable[] (power, xp), волны, босс, статы |
| `data/experience.json` | maxLevel, xpTable[] |
| `data/balance.json` | combat, economy |
