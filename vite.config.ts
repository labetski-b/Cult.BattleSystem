import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Base path для GitHub Pages - название репозитория
    base: '/Cult.BattleSystem/',
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
});
