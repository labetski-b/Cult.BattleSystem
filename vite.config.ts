import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command }) => ({
    // Base path: / для dev, /Cult.BattleSystem/ для build (GitHub Pages)
    base: command === 'serve' ? '/' : '/Cult.BattleSystem/',
    server: {
        host: true, // Доступ с телефона в локальной сети
        port: 5173
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                balanceTuner: resolve(__dirname, 'public/balance-tuner.html'),
                featureComparison: resolve(__dirname, 'public/feature-comparison.html')
            }
        }
    }
}));
