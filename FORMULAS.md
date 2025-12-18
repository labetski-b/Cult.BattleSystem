# Формулы баланса

## Предметы (Items)

### Effective Power (сила предмета для сравнения)
```
effectivePower = hp + 4 * damage
```

### Target Power (целевая сила предмета)
```
targetPower = basePowerPerLevel * 1.5^(itemLevel-1) * rarityMultiplier
```
- `itemLevel` = `random(dungeonChapter - minLevelOffset, dungeonChapter)`, минимум 1
- `basePowerPerLevel` = 20 (из items.json)
- `1.5` = множитель роста за уровень (+50%)
- `rarityMultiplier` = из rarities.json (1.0 ... 11.39)

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
heroPower = maxHp + damage * 5
```

---

## Враги (Enemies)

### Сила врага на этапе
```
globalStage = (chapter - 1) * 5 + stage
enemyPower = baseEnemyPower * (powerPerStage ^ (globalStage - 1))
```
- `baseEnemyPower` = 50
- `powerPerStage` = 1.12 (+12% за этап)

### Босс
```
bossPower = enemyPower * bossMultiplier
```
- `bossMultiplier` = 2.5

### Статы врага
```
variance = 0.9 + random() * 0.2  // ±10%
power = targetPower * variance
hp = floor(power * 0.6)
damage = max(1, floor(power * 0.13))
```

### Волны врагов
- Обычный этап: 1-3 врага, сила делится поровну
- Босс: 1 враг с полной силой

---

## Рост силы врагов (примеры)

| Данж | Stage | Global | Power | Босс (×2.5) |
|------|-------|--------|-------|-------------|
| 1-1  | 1     | 1      | 50    | — |
| 1-5  | 5     | 5      | 78    | 196 |
| 2-1  | 1     | 6      | 88    | — |
| 5-1  | 1     | 21     | 548   | — |
| 10-1 | 1     | 46     | 8963  | — |

---

## Конфигурационные файлы

| Файл | Содержимое |
|------|------------|
| `data/items.json` | basePowerPerLevel, levelRange, slotRatios |
| `data/rarities.json` | 7 редкостей с multiplier |
| `data/lamp-levels.json` | 31 уровень лампы с весами редкостей |
| `data/balance.json` | dungeonScaling, combat, economy |
