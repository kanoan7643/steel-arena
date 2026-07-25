import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/steel-arena/
  base: '/steel-arena/',
  server: {
    host: true,
    port: 5173,
  },
});
