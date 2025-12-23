import { EconomyTester } from './EconomyTester';
import { TestSummary, ChapterMetrics } from './TestMetrics';
import * as fs from 'fs';
import * as path from 'path';

// Форматирование таблицы для консоли
function printTable(summary: TestSummary): void {
    console.log('\n=== ECONOMY TEST RESULTS ===\n');

    // Заголовок таблицы
    const header = 'Ch | Loots | Battles | Defeats | Lamp | HeroLvl | Power   | Enemy   | Gold Net';
    const separator = '---|-------|---------|---------|------|---------|---------|---------|----------';

    console.log(header);
    console.log(separator);

    // Строки таблицы
    for (const ch of summary.chapters) {
        const goldNet = ch.goldEarned - ch.goldSpent;
        const goldStr = goldNet >= 0 ? `+${goldNet}` : `${goldNet}`;

        console.log(
            `${ch.chapter.toString().padStart(2)} | ` +
            `${ch.loots.toString().padStart(5)} | ` +
            `${ch.battles.toString().padStart(7)} | ` +
            `${ch.defeats.toString().padStart(7)} | ` +
            `${ch.lampLevel.toString().padStart(4)} | ` +
            `${ch.heroLevel.toString().padStart(7)} | ` +
            `${ch.heroPower.toString().padStart(7)} | ` +
            `${ch.maxEnemyPower.toString().padStart(7)} | ` +
            `${goldStr.padStart(8)}`
        );
    }

    console.log(separator);

    // Итого
    console.log(`\nTotal: ${summary.totalLoots} loots, ${summary.totalBattles} battles, ${summary.totalDefeats} defeats`);
    console.log(`Final: Lamp Lvl ${summary.finalLampLevel}, Power ${summary.finalHeroPower}, Hero Lvl ${summary.finalHeroLevel}`);
    console.log(`Gold: +${summary.totalGoldEarned} earned, -${summary.totalGoldSpent} spent, net ${summary.totalGoldEarned - summary.totalGoldSpent}`);
}

// Сохранение в CSV
function saveCSV(summary: TestSummary, filePath: string): void {
    const headers = 'chapter,loots,battles,defeats,lamp_level,hero_power,max_enemy_power,hero_level,gold_earned,gold_spent,gold_net';
    const rows = summary.chapters.map((ch: ChapterMetrics) =>
        `${ch.chapter},${ch.loots},${ch.battles},${ch.defeats},${ch.lampLevel},${ch.heroPower},${ch.maxEnemyPower},${ch.heroLevel},${ch.goldEarned},${ch.goldSpent},${ch.goldEarned - ch.goldSpent}`
    );

    const csv = [headers, ...rows].join('\n');

    // Создаём директорию если не существует
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, csv);
    console.log(`\nCSV saved to: ${filePath}`);
}

// Основной запуск
function main(): void {
    // Парсинг аргументов командной строки
    const args = process.argv.slice(2);
    let maxChapters = 10;
    let verbose = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--chapters' && args[i + 1]) {
            maxChapters = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '-v' || args[i] === '--verbose') {
            verbose = true;
        }
    }

    console.log(`Running economy test for ${maxChapters} chapters...`);

    const tester = new EconomyTester({
        maxChapters,
        verbose
    });

    const summary = tester.run();

    // Вывод таблицы
    printTable(summary);

    // Сохранение CSV
    const csvPath = path.join(process.cwd(), 'output', 'economy_test.csv');
    saveCSV(summary, csvPath);
}

main();
