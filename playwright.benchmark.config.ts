import { defineConfig } from '@playwright/test';
import common from './playwright.config';

// Same production build as correctness CI. Timing is informational on shared
// software-rendered runners; allocation and preservation expectations are gates.
export default defineConfig({ ...common,
  testDir: './tests/benchmarks', testMatch: '**/*.bench.ts',
  outputDir: 'benchmark-results', globalTimeout: 10 * 60_000,
  timeout: 180_000, retries: 0,
  expect: { timeout: 60_000 },
  reporter: [['list']],
  projects: [
    { name: 'desktop', use: { ...common.projects![0].use, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'phone-viewport', use: { ...common.projects![0].use, viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 } },
  ],
});
