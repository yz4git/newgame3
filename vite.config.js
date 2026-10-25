import { resolve } from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'app',
  base: './',
  publicDir: '../public',
  build: {
    outDir: '../dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1800,
    rollupOptions: { input: { main: resolve('app/index.html'), flight3d: resolve('app/flight3d.html') } }
  },
});
