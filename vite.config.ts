import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/pokemon-champions-roulette/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pokémon Champions Roulette',
        short_name: 'ChampionsRoulette',
        start_url: '/pokemon-champions-roulette/',
        scope: '/pokemon-champions-roulette/',
        display: 'standalone',
        background_color: '#F6F5F0',
        theme_color: '#315FA9',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
});