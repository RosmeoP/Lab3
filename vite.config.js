import { defineConfig } from 'vite';

// base: './' asegura rutas relativas válidas tanto en GitHub Pages
// (https://<usuario>.github.io/<repo>/) como en el protocolo file:// de Electron.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

