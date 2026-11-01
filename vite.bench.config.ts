// Separate multi-page build for the on-device benchmark.
// The main vite.config.ts is intentionally unchanged.
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: { 'device-bench': fileURLToPath(new URL('./tools/device-bench.html', import.meta.url)) },
    },
  },
});
