import { EconomyTester } from './EconomyTester';
import { TestSummary, ChapterMetrics, StageMetrics } from './TestMetrics';
import * as fs from 'fs';
import * as path from 'path';

// Форматирование детальной таблицы по этапам
function printStagesTable(summary: TestSummary): void {
    console.log('\n=== DETAILED STAGES ===\n');

    const header = 'Ch.St | Loots | Battles | Defeats | HLvl | Slots | HP     | Dmg   | Power   | Enemy';
    const separator = '------|-------|---------|---------|------|-------|--------|-------|---------|--------';

    console.log(header);
    console.log(separator);

    for (const st of summary.stages) {
        console.log(
            `${st.chapter.toString().padStart(2)}.${st.stage.toString().padStart(2)} | ` +
            `${st.loots.toString().padStart(5)} | ` +
            `${st.battles.toString().padStart(7)} | ` +
            `${st.defeats.toString().padStart(7)} | ` +
            `${st.heroLevel.toString().padStart(4)} | ` +
            `${st.slots.toString().padStart(5)} | ` +
            `${st.heroHp.toString().padStart(6)} | ` +
            `${st.heroDamage.toString().padStart(5)} | ` +
            `${st.heroPower.toString().padStart(7)} | ` +
            `${st.enemyPower.toString().padStart(6)}`
        );
    }

    console.log(separator);
}

// Форматирование сводной таблицы по главам
function printChaptersTable(summary: TestSummary): void {
    console.log('\n=== CHAPTERS SUMMARY ===\n');

    const header = 'Ch | Loots | Battles | Defeats | Lamp | HeroLvl | Power   | Enemy   | Gold Net';
    const separator = '---|-------|---------|---------|------|---------|---------|---------|----------';

    console.log(header);
    console.log(separator);

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

// Сохранение этапов в CSV
function saveStagesCSV(summary: TestSummary, filePath: string): void {
    const headers = 'chapter,stage,loots,battles,defeats,hero_level,slots,hero_hp,hero_damage,hero_power,enemy_power';
    const rows = summary.stages.map((st: StageMetrics) =>
        `${st.chapter},${st.stage},${st.loots},${st.battles},${st.defeats},${st.heroLevel},${st.slots},${st.heroHp},${st.heroDamage},${st.heroPower},${st.enemyPower}`
    );

    const csv = [headers, ...rows].join('\n');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, csv);
    console.log(`Stages CSV saved to: ${filePath}`);
}

// Сохранение глав в CSV
function saveChaptersCSV(summary: TestSummary, filePath: string): void {
    const headers = 'chapter,loots,battles,defeats,lamp_level,hero_power,max_enemy_power,hero_level,gold_earned,gold_spent,gold_net';
    const rows = summary.chapters.map((ch: ChapterMetrics) =>
        `${ch.chapter},${ch.loots},${ch.battles},${ch.defeats},${ch.lampLevel},${ch.heroPower},${ch.maxEnemyPower},${ch.heroLevel},${ch.goldEarned},${ch.goldSpent},${ch.goldEarned - ch.goldSpent}`
    );

    const csv = [headers, ...rows].join('\n');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, csv);
    console.log(`Chapters CSV saved to: ${filePath}`);
}

// Основной запуск
function main(): void {
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

    // Вывод детальной таблицы по этапам
    printStagesTable(summary);

    // Вывод сводной таблицы по главам
    printChaptersTable(summary);

    // Сохранение CSV в output/ и public/ (для GitHub Pages)
    const outputDir = path.join(process.cwd(), 'output');
    const publicDir = path.join(process.cwd(), 'public');

    saveStagesCSV(summary, path.join(outputDir, 'economy_stages.csv'));
    saveChaptersCSV(summary, path.join(outputDir, 'economy_chapters.csv'));

    // Копируем в public для веб-отчёта
    saveStagesCSV(summary, path.join(publicDir, 'economy_stages.csv'));
    saveChaptersCSV(summary, path.join(publicDir, 'economy_chapters.csv'));

    console.log(`\nWeb report: https://labetski-b.github.io/Cult.BattleSystem/economy-report.html`);
}

main();
