import './style.css';
import {
    GameState,
    createNewGame,
    loadGame,
    openLoot,
    equipFromInventory,
    upgradeLamp,
    addLamps,
    resetGame,
    saveGame,
    generateEnemiesForBattle,
    startStepBattle,
    applyBattleResult,
    executeBattleRound,
    BattleState
} from './systems/GameState';
import { Enemy } from './models/Enemy';
import { SLOT_TYPES, SLOT_NAMES, RARITY_COLORS, RARITY_NAMES_RU, Item, SlotType, Rarity } from './models/Item';
import { getLampLevelConfig, getUpgradeCost, MAX_LAMP_LEVEL } from './models/Lamp';
import { isBossStage, BOSS_MULTIPLIER, STAGES_PER_CHAPTER, getStageXpReward } from './systems/DungeonSystem';
import { addXp, xpProgress, XpGainResult } from './models/Hero';

// DOM элементы
const $ = <T extends HTMLElement>(selector: string): T => document.querySelector(selector) as T;

// Инициализация игры
let gameState: GameState = loadGame() || createNewGame();
let pendingItem: Item | null = null; // Предмет ожидающий решения

// Состояние пошагового боя
let currentBattle: BattleState | null = null;
let currentEnemies: Enemy[] = [];
let isAutoMode: boolean = false;
let autoIntervalId: number | null = null;

// Счётчик сессии для дебага (сохраняется в localStorage)
const STORAGE_SESSION_KEY = 'cult_session_counter';
let sessionCounter: number = parseInt(localStorage.getItem(STORAGE_SESSION_KEY) || '1', 10);

// Иконки слотов
const SLOT_ICONS: Record<SlotType, string> = {
    helmet: '🪖',
    armor: '🛡️',
    weapon: '⚔️',
    shield: '🔰',
    boots: '👢',
    accessory: '💍'
};

// Цена продажи предмета
function calculateSellPrice(item: Item): number {
    const rarityMultiplier: Record<Rarity, number> = {
        common: 1,
        good: 1.5,
        rare: 2,
        epic: 5,
        mythic: 10,
        legendary: 20,
        immortal: 50
    };
    return Math.floor(item.power * rarityMultiplier[item.rarity] * 0.5);
}

// Анимация Level Up
function showLevelUpAnimation(newLevel: number): void {
    const overlay = $('#level-up-overlay');
    $('#level-up-level').textContent = `LVL ${newLevel}`;
    overlay.classList.remove('hidden');

    // Автоматически скрыть через 2 секунды
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 2000);

    // Закрыть по клику
    overlay.onclick = () => {
        overlay.classList.add('hidden');
    };
}

// Генерация точек прогресса
function renderProgressDots(): void {
    const container = $('#progress-dots');
    container.innerHTML = '';

    for (let i = 1; i <= STAGES_PER_CHAPTER; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.dataset.stage = i.toString();

        if (i === STAGES_PER_CHAPTER) {
            dot.classList.add('boss');
            dot.textContent = '💀';
        }

        if (i < gameState.dungeon.stage) {
            dot.classList.add('completed');
        } else if (i === gameState.dungeon.stage) {
            dot.classList.add('active');
        }

        container.appendChild(dot);
    }
}

// Обновление UI
function updateUI(): void {
    // Уровень героя и круговая диаграмма XP
    $('#hero-level').textContent = gameState.hero.level.toString();
    const progress = xpProgress(gameState.hero);
    // Круговая диаграмма: stroke-dashoffset = circumference * (1 - progress)
    const circumference = 113.1; // 2 * PI * 18
    const offset = circumference * (1 - progress);
    $('#level-progress-fill').style.strokeDashoffset = offset.toString();

    // Ресурсы
    $('#gold').textContent = gameState.hero.gold.toString();
    $('#lamps').textContent = gameState.hero.lamps.toString();

    // Badge на кнопке лута
    const lampsBadge = $('#lamps-badge');
    lampsBadge.textContent = gameState.hero.lamps.toString();
    lampsBadge.dataset.count = gameState.hero.lamps.toString();

    // Сила героя = effectivePower (та же формула что и для предметов)
    const heroPower = gameState.hero.maxHp + gameState.hero.damage * 4;
    $('#hero-power').textContent = heroPower.toString();

    // Подземелье - теперь показываем только номер главы
    $('#dungeon-title').textContent = `DUNGEON ${gameState.dungeon.chapter}`;

    // Показываем реальную силу врагов (с учётом множителя босса)
    const isBoss = isBossStage(gameState.dungeon.stage);
    const displayPower = isBoss
        ? Math.floor(gameState.dungeon.currentEnemyPower * BOSS_MULTIPLIER)
        : gameState.dungeon.currentEnemyPower;
    $('#enemy-power').textContent = displayPower.toString();

    // Статы героя (над экипировкой) — только максимум HP
    $('#hero-hp-display').textContent = gameState.hero.maxHp.toString();
    $('#hero-damage-display').textContent = gameState.hero.damage.toString();

    // Обновляем точки прогресса (генерируем динамически)
    renderProgressDots();

    // Экипировка
    renderEquipment();

    // Лампа
    const lampConfig = getLampLevelConfig(gameState.lamp.level);
    $('#lamp-level').textContent = gameState.lamp.level.toString();

    // Показываем максимальную доступную редкость (по правильному порядку)
    const rarityOrder: Rarity[] = ['common', 'good', 'rare', 'epic', 'mythic', 'legendary', 'immortal'];
    const availableRarities = Object.keys(lampConfig.weights) as Rarity[];
    // Находим максимальную по порядку
    let maxRarity: Rarity = 'common';
    for (const r of rarityOrder) {
        if (availableRarities.includes(r)) {
            maxRarity = r;
        }
    }
    $('#lamp-rarity').textContent = RARITY_NAMES_RU[maxRarity] || maxRarity;
    $('#lamp-rarity').style.color = RARITY_COLORS[maxRarity];

    const upgradeCost = getUpgradeCost(gameState.lamp.level);
    const upgradeBtn = $('#upgrade-lamp-btn') as HTMLButtonElement;
    if (upgradeCost !== null && gameState.lamp.level < MAX_LAMP_LEVEL) {
        $('#upgrade-cost').textContent = upgradeCost.toString();
        upgradeBtn.disabled = gameState.hero.gold < upgradeCost;
        upgradeBtn.style.display = '';
    } else {
        upgradeBtn.textContent = 'MAX';
        upgradeBtn.disabled = true;
    }

    // Кнопка Loot
    const lootBtn = $('#loot-btn') as HTMLButtonElement;
    lootBtn.disabled = gameState.hero.lamps <= 0;
}

// Рендер экипировки
function renderEquipment(): void {
    const grid = $('#equipment-grid');
    grid.innerHTML = '';

    for (const slotType of SLOT_TYPES) {
        const item = gameState.hero.equipment[slotType];
        const slot = document.createElement('div');
        slot.className = `slot ${item ? `filled ${item.rarity}` : ''}`;

        if (item) {
            const hpText = item.hp > 0 ? `+${item.hp}❤️` : '';
            const dmgText = item.damage > 0 ? `+${item.damage}⚔️` : '';
            slot.innerHTML = `
        <span class="slot-icon">${SLOT_ICONS[slotType]}</span>
        <span class="slot-level">Lv${item.level}</span>
        <span class="slot-stats">${hpText} ${dmgText}</span>
      `;
            slot.title = `${item.name} (Lvl ${item.level}) - HP: +${item.hp}, DMG: +${item.damage}`;
        } else {
            slot.innerHTML = `
        <span class="slot-icon" style="opacity: 0.3">${SLOT_ICONS[slotType]}</span>
        <span style="font-size: 10px">${SLOT_NAMES[slotType].split(' ')[1]}</span>
      `;
        }

        grid.appendChild(slot);
    }
}

// Показать результат боя
function showBattleResult(victory: boolean, details: string): void {
    const result = $('#battle-result');
    result.classList.remove('hidden', 'victory', 'defeat');
    result.classList.add(victory ? 'victory' : 'defeat');

    $('#result-title').textContent = victory ? '🎉 Победа!' : '💀 Поражение';
    $('#result-details').textContent = details;
}

// ===== ПОШАГОВЫЙ БОЙ =====

// Показать арену боя
function showBattleArena(): void {
    $('#battle-arena').classList.remove('hidden');
    $('#battle-result').classList.add('hidden');
}

// Скрыть арену боя
function hideBattleArena(): void {
    $('#battle-arena').classList.add('hidden');
    stopAutoMode();
}

// Отрисовать врагов в арене
function renderEnemiesInArena(): void {
    const container = $('#enemies-container');
    container.innerHTML = '';

    if (!currentBattle) return;

    currentBattle.enemies.forEach((enemy, index) => {
        const isDead = enemy.hp <= 0;
        const hpPercent = Math.max(0, (enemy.hp / enemy.maxHp) * 100);

        const enemyEl = document.createElement('div');
        enemyEl.className = `battle-unit enemy-unit ${isDead ? 'dead' : ''}`;
        enemyEl.id = `enemy-${index}`;
        enemyEl.innerHTML = `
            <div class="unit-sprite">${enemy.name.includes('👑') ? '👑' : '👹'}</div>
            <div class="unit-name">${enemy.name}</div>
            <div class="unit-stats">
                <span class="stat-damage">⚔️ ${enemy.damage}</span>
            </div>
            <div class="unit-hp-bar">
                <div class="hp-fill ${isDead ? 'empty' : ''}" style="width: ${hpPercent}%"></div>
                <span>${enemy.hp}/${enemy.maxHp}</span>
            </div>
        `;
        container.appendChild(enemyEl);
    });
}

// Обновить UI боя
function updateBattleUI(): void {
    if (!currentBattle) return;

    // Обновить раунд
    $('#battle-round').textContent = currentBattle.currentTurn.toString();

    // Обновить HP героя
    const heroHpPercent = Math.max(0, (currentBattle.hero.hp / currentBattle.hero.maxHp) * 100);
    $('#battle-hero-hp-fill').style.width = `${heroHpPercent}%`;
    $('#battle-hero-hp-text').textContent = `${Math.max(0, currentBattle.hero.hp)}/${currentBattle.hero.maxHp}`;
    $('#hero-damage').textContent = currentBattle.hero.damage.toString();

    // Обновить врагов
    renderEnemiesInArena();

    // Обновить лог боя (последние 5 записей)
    const logContainer = $('#battle-log');
    const recentLogs = currentBattle.log.slice(-5);
    logContainer.innerHTML = recentLogs.map(entry => {
        const isHeroAttack = entry.attacker === 'Герой';
        return `<div class="log-entry ${isHeroAttack ? 'hero-attack' : 'enemy-attack'}">
            <span class="attacker">${entry.attacker}</span> →
            <span class="target">${entry.target}</span>:
            <span class="damage">-${entry.damage}</span>
        </div>`;
    }).join('');

    // Прокрутить лог вниз
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Анимация атаки (для будущего использования с пошаговой анимацией)
function _animateAttack(isHeroAttack: boolean): Promise<void> {
    return new Promise(resolve => {
        const element = isHeroAttack ? $('#battle-hero') : document.querySelector(`#enemies-container .enemy-unit:not(.dead)`);
        if (element) {
            element.classList.add('attacking');
            setTimeout(() => {
                element.classList.remove('attacking');
                resolve();
            }, 300);
        } else {
            resolve();
        }
    });
}

// Анимация получения урона (для будущего использования)
function _animateDamage(isHero: boolean): Promise<void> {
    return new Promise(resolve => {
        const element = isHero ? $('#battle-hero') : document.querySelector(`#enemies-container .enemy-unit:not(.dead)`);
        if (element) {
            element.classList.add('damaged');
            setTimeout(() => {
                element.classList.remove('damaged');
                resolve();
            }, 300);
        } else {
            resolve();
        }
    });
}

// Экспорт для потенциального использования
void _animateAttack;
void _animateDamage;

// Выполнить один шаг боя
async function executeBattleStep(): Promise<void> {
    if (!currentBattle || currentBattle.isComplete) return;

    // Выполнить раунд
    currentBattle = executeBattleRound(currentBattle);
    updateBattleUI();

    // Проверить завершение
    if (currentBattle.isComplete) {
        finishBattle();
    }
}

// Завершить бой
function finishBattle(): void {
    stopAutoMode();

    if (!currentBattle) return;

    const result = applyBattleResult(gameState, currentBattle, currentEnemies);

    // Начисляем опыт за прохождение этапа (из таблицы)
    let xpResult: XpGainResult | null = null;
    if (result.victory) {
        // XP берём из таблицы для ПРЕДЫДУЩЕГО этапа (который мы только что прошли)
        // Т.к. dungeon уже продвинулся, нужно вычислить предыдущий этап
        const prevChapter = gameState.dungeon.stage === 1
            ? gameState.dungeon.chapter - 1
            : gameState.dungeon.chapter;
        const prevStage = gameState.dungeon.stage === 1
            ? STAGES_PER_CHAPTER
            : gameState.dungeon.stage - 1;

        const stageXp = getStageXpReward(prevChapter, prevStage);
        xpResult = addXp(gameState.hero, stageXp);
        saveGame(gameState);

        // Показываем анимацию левел-апа если уровень повысился
        if (xpResult.levelsGained > 0) {
            showLevelUpAnimation(xpResult.newLevel);
        }
    }

    // Показать результат
    if (result.victory) {
        const xpText = xpResult ? `+${xpResult.xpGained} XP` : '';
        const levelText = xpResult && xpResult.levelsGained > 0 ? ` 🎉 LVL UP!` : '';
        showBattleResult(true, `${xpText}${levelText}`);
    } else {
        showBattleResult(false, `Вы погибли! Враги были слишком сильны.`);
    }

    // Сбросить состояние боя
    currentBattle = null;
    currentEnemies = [];

    updateUI();
}

// Запустить авто-режим
function startAutoMode(): void {
    if (isAutoMode) return;
    isAutoMode = true;
    $('#battle-auto-btn').textContent = 'Стоп';
    $('#battle-auto-btn').classList.add('active');

    autoIntervalId = window.setInterval(() => {
        if (currentBattle && !currentBattle.isComplete) {
            executeBattleStep();
        } else {
            stopAutoMode();
        }
    }, 500);
}

// Остановить авто-режим
function stopAutoMode(): void {
    isAutoMode = false;
    $('#battle-auto-btn').textContent = 'Авто';
    $('#battle-auto-btn').classList.remove('active');

    if (autoIntervalId !== null) {
        clearInterval(autoIntervalId);
        autoIntervalId = null;
    }
}

// Пропустить бой (выполнить до конца)
function skipBattle(): void {
    if (!currentBattle) return;
    stopAutoMode();

    while (!currentBattle.isComplete && currentBattle.currentTurn < 100) {
        currentBattle = executeBattleRound(currentBattle);
    }

    updateBattleUI();
    finishBattle();
}

// Начать новый бой
function startBattle(): void {
    // Восстанавливаем HP героя перед боем
    gameState.hero.hp = gameState.hero.maxHp;
    saveGame(gameState);

    // Генерируем врагов
    currentEnemies = generateEnemiesForBattle(gameState);

    // Инициализируем бой
    currentBattle = startStepBattle(gameState, currentEnemies);

    // Показываем арену
    showBattleArena();
    updateBattleUI();
}

// Показать попап лута с сравнением
function showLootPopup(newItem: Item): void {
    pendingItem = newItem;

    const popup = $('#loot-popup');
    popup.classList.remove('hidden');

    const equippedItem = gameState.hero.equipment[newItem.slot];

    // Разница в статах (нужна для цветов)
    const hpDiff = (newItem.hp || 0) - (equippedItem?.hp || 0);
    const dmgDiff = (newItem.damage || 0) - (equippedItem?.damage || 0);

    // Форматирование статов предмета (две строки)
    const formatStats = (item: Item | null) => {
        const hp = item?.hp || 0;
        const dmg = item?.damage || 0;
        return `<div>+${hp} ❤️</div><div>+${dmg} ⚔️</div>`;
    };

    // Новый предмет
    const newCard = $('#new-item');
    newCard.className = `item-card new ${newItem.rarity}`;
    $('#new-item-slot').textContent = SLOT_ICONS[newItem.slot];
    $('#new-item-name').textContent = newItem.name;
    $('#new-item-name').style.color = RARITY_COLORS[newItem.rarity];
    $('#new-item-power').innerHTML = formatStats(newItem);
    $('#new-item-meta').textContent = `Lvl ${newItem.level} • ${newItem.rarity}`;

    // Экипированный предмет
    const eqCard = $('#equipped-item');
    if (equippedItem) {
        eqCard.className = `item-card equipped ${equippedItem.rarity}`;
        $('#equipped-item-slot').textContent = SLOT_ICONS[equippedItem.slot];
        $('#equipped-item-name').textContent = equippedItem.name;
        $('#equipped-item-name').style.color = RARITY_COLORS[equippedItem.rarity];
        $('#equipped-item-power').innerHTML = formatStats(equippedItem);
        $('#equipped-item-meta').textContent = `Lvl ${equippedItem.level} • ${equippedItem.rarity}`;
    } else {
        eqCard.className = 'item-card equipped';
        $('#equipped-item-slot').textContent = SLOT_ICONS[newItem.slot];
        $('#equipped-item-name').textContent = 'Пусто';
        $('#equipped-item-name').style.color = 'var(--text-secondary)';
        $('#equipped-item-power').innerHTML = formatStats(null);
        $('#equipped-item-meta').textContent = '—';
    }

    // Разница в статах (для отображения)
    const diffEl = $('#power-diff');
    diffEl.classList.remove('positive', 'negative', 'neutral');

    const diffParts = [];
    if (hpDiff !== 0) diffParts.push(`${hpDiff > 0 ? '+' : ''}${hpDiff} ❤️`);
    if (dmgDiff !== 0) diffParts.push(`${dmgDiff > 0 ? '+' : ''}${dmgDiff} ⚔️`);

    if (hpDiff > 0 || dmgDiff > 0) {
        diffEl.classList.add('positive');
    } else if (hpDiff < 0 || dmgDiff < 0) {
        diffEl.classList.add('negative');
    } else {
        diffEl.classList.add('neutral');
    }
    diffEl.textContent = diffParts.length > 0 ? diffParts.join('  ') : '±0';

    // Цена продажи
    const sellPrice = calculateSellPrice(newItem);
    $('#sell-price').textContent = `+${sellPrice}🪙`;

    // Кнопка надеть — подсветка если апгрейд
    const equipBtn = $('#equip-btn');
    const isDowngrade = hpDiff < 0 && dmgDiff < 0;
    equipBtn.classList.toggle('downgrade', isDowngrade);
}

// Закрыть попап лута
function closeLootPopup(): void {
    $('#loot-popup').classList.add('hidden');
    pendingItem = null;
}

// Показать попап вероятностей редкостей
function showRarityPopup(): void {
    const popup = $('#rarity-popup');
    const list = $('#rarity-list');

    const lampConfig = getLampLevelConfig(gameState.lamp.level);
    const weights = lampConfig.weights;

    // Считаем общий вес
    let totalWeight = 0;
    for (const w of Object.values(weights)) {
        totalWeight += w as number;
    }

    // Порядок редкостей для отображения
    const rarityOrder: Rarity[] = ['common', 'good', 'rare', 'epic', 'mythic', 'legendary', 'immortal'];

    list.innerHTML = '';
    for (const rarity of rarityOrder) {
        const weight = (weights as Record<Rarity, number>)[rarity];
        if (weight && weight > 0) {
            const chance = ((weight / totalWeight) * 100).toFixed(1);
            const row = document.createElement('div');
            row.className = `rarity-row ${rarity}`;
            row.innerHTML = `
                <span class="rarity-name">${RARITY_NAMES_RU[rarity]}</span>
                <span class="rarity-chance">${chance}%</span>
            `;
            list.appendChild(row);
        }
    }

    popup.classList.remove('hidden');
}

// Закрыть попап вероятностей
function closeRarityPopup(): void {
    $('#rarity-popup').classList.add('hidden');
}

// Продать предмет
function sellPendingItem(): void {
    if (!pendingItem) return;

    const sellPrice = calculateSellPrice(pendingItem);
    gameState.hero.gold += sellPrice;

    // Удаляем из инвентаря если там был
    const idx = gameState.inventory.findIndex(i => i.id === pendingItem!.id);
    if (idx !== -1) {
        gameState.inventory.splice(idx, 1);
    }

    saveGame(gameState);
    closeLootPopup();
    updateUI();
}

// Надеть предмет
function equipPendingItem(): void {
    if (!pendingItem) return;

    // Надеваем (старый предмет уходит в никуда — продаём автоматически)
    const oldItem = gameState.hero.equipment[pendingItem.slot];
    if (oldItem) {
        gameState.hero.gold += calculateSellPrice(oldItem);
    }

    equipFromInventory(gameState, pendingItem.id);
    closeLootPopup();
    updateUI();
}

// Обработчики событий
function setupEventListeners(): void {
    // LOOT
    $('#loot-btn').addEventListener('click', () => {
        const item = openLoot(gameState);
        if (item) {
            showLootPopup(item);
            updateUI();
        }
    });

    // FIGHT - теперь запускает пошаговый бой
    $('#fight-btn').addEventListener('click', () => {
        startBattle();
    });

    // Кнопки управления боем
    $('#battle-step-btn').addEventListener('click', () => {
        executeBattleStep();
    });

    $('#battle-auto-btn').addEventListener('click', () => {
        if (isAutoMode) {
            stopAutoMode();
        } else {
            startAutoMode();
        }
    });

    $('#battle-skip-btn').addEventListener('click', () => {
        skipBattle();
    });

    // Закрыть результат боя
    $('#close-result-btn').addEventListener('click', () => {
        $('#battle-result').classList.add('hidden');
        hideBattleArena();
    });

    // Попап лута: продать
    $('#sell-btn').addEventListener('click', sellPendingItem);

    // Попап лута: надеть
    $('#equip-btn').addEventListener('click', equipPendingItem);

    // Закрытие попапа по клику на overlay
    $('.loot-popup-overlay').addEventListener('click', () => {
        // По умолчанию — продаём
        sellPendingItem();
    });

    // Улучшение лампы
    $('#upgrade-lamp-btn').addEventListener('click', () => {
        if (upgradeLamp(gameState)) {
            updateUI();
        }
    });

    // Показать вероятности редкостей (клик по иконке лампы)
    $('#lamp-icon-btn').addEventListener('click', showRarityPopup);

    // Закрыть попап вероятностей
    $('#close-rarity-popup').addEventListener('click', closeRarityPopup);
    $('.rarity-popup-overlay').addEventListener('click', closeRarityPopup);

    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        // Q — открыть лут
        if (e.key === 'q' || e.key === 'Q' || e.key === 'й' || e.key === 'Й') {
            if (gameState.hero.lamps > 0 && !pendingItem) {
                const item = openLoot(gameState);
                if (item) {
                    showLootPopup(item);
                    updateUI();
                }
            }
        }
        // W — начать бой
        if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
            if (!currentBattle && !pendingItem) {
                startBattle();
            }
        }
    });

    // Дебаг: добавить лампы и увеличить счётчик сессии
    $('#add-lamps').addEventListener('click', () => {
        addLamps(gameState, 20);
        sessionCounter++;
        localStorage.setItem(STORAGE_SESSION_KEY, sessionCounter.toString());
        $('#session-counter').textContent = sessionCounter.toString();
        updateUI();
    });

    // Инициализация счётчика сессии в UI
    $('#session-counter').textContent = sessionCounter.toString();

    // Сброс
    $('#reset-btn').addEventListener('click', () => {
        if (confirm('Сбросить весь прогресс?')) {
            gameState = resetGame();
            updateUI();
        }
    });
}

// Запуск
setupEventListeners();
updateUI();
