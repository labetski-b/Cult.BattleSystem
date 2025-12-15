import { defineConfig } from 'vite';

export default defineConfig({
    // Base path для GitHub Pages - название репозитория
    base: '/Cult.BattleSystem/',
    server: {
        host: true, // Доступ с телефона в локальной сети
        port: 5173
    },
    build: {
        outDir: 'dist'
    }
});
