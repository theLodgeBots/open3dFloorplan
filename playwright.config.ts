import { defineConfig, devices } from '@playwright/test';

// Use the real Node production build. Each test gets an empty browser profile;
// no credentials or Firebase services are needed.
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4188',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
  ],
  webServer: {
    command: 'node build/index.js',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '4188',
      ORIGIN: 'http://127.0.0.1:4188', PUBLIC_ENABLE_ANALYTICS: 'false',
    },
  },
});
