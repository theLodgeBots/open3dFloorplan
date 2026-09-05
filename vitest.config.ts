import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { catalogAssets } from './tooling/catalog-assets.mjs';

export default defineConfig({
  plugins: [catalogAssets()],
  resolve: {
    alias: {
      '$lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '$app/paths': fileURLToPath(new URL('./tests/fixtures/app-paths.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
