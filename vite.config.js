import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/Meu_Nexus_projeto/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'), // ou seu login.html principal
        login: resolve(__dirname, 'login.html'),
      },
    },
  },
});