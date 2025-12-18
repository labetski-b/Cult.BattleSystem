# Инструкция для Claude Code

## Рабочий процесс

### После завершения задачи — ВСЕГДА:
1. **Запустить билд** — `npm run build` для проверки ошибок
2. **Закоммитить в git** — без напоминания пользователя
3. **Запушить в git** — `git push` сразу после коммита

### Git workflow:
```bash
git status
git add <files>
git commit -m "feat/fix: описание"
git push
```

### Формат коммитов:
- `feat:` — новая функциональность
- `fix:` — исправление бага
- `refactor:` — рефакторинг без изменения поведения
- Коммит на русском языке (проект на русском)

## Архитектура проекта

### Разделение ответственности:
| Сущность | Что определяет |
|----------|----------------|
| **Лампа (lamp.level)** | Веса редкостей (какие могут выпасть) |
| **Данж (dungeon.chapter)** | Уровень предмета → базовые статы |
| **Редкость (rarity)** | Множитель к базовым статам |

### Конфигурационные файлы (data/):
- `rarities.json` — 7 редкостей с цветами и множителями
- `lamp-levels.json` — 31 уровень лампы с весами редкостей
- `items.json` — basePowerPerLevel, levelRange, slotRatios
- `balance.json` — dungeonScaling, combat, economy

### Формула силы предмета:
```
power = itemLevel * basePowerPerLevel * rarityMultiplier
```
- `itemLevel` = `random(dungeonChapter - minLevelOffset, dungeonChapter)`
- `basePowerPerLevel` = из items.json
- `rarityMultiplier` = из rarities.json

## Частые ошибки (не забывать!)

1. **Не забывать пушить в git** после коммита
2. **Проверять билд** перед коммитом
3. **Сбрасывать localStorage** при изменении структуры данных (напомнить пользователю)

## Команды

```bash
npm run dev      # Запуск dev сервера
npm run build    # Сборка для продакшена
git push         # Деплой на GitHub Pages
```

## Деплой

Проект автоматически деплоится на GitHub Pages:
https://labetski-b.github.io/Cult.BattleSystem/
