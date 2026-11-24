import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pokémon Champions Roulette',
        short_name: 'Champions Roulette',
        description: 'Pokémon Champions 総合ルーレット・大会運営アプリ',
        theme_color: '#f7f6f2',
        background_color: '#f7f6f2',
        display: 'standalone',
      },
    }),
  ],
});
