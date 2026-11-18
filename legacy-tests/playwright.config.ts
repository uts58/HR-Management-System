import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Environment:
 *   BASE_URL       App under test (default http://localhost:3000).
 *   DATABASE_URL   Database the app uses; reset from fixtures/seed.sql before the run.
 *   RESET_DB=0     Skip the reset (non-repeatable; only for read-only smoke runs).
 *   START_LEGACY=1 Let Playwright start the legacy app (node ../app.js) itself,
 *                  using DATABASE_URL and the port taken from BASE_URL.
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const port = new URL(BASE_URL).port || '80';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // The suite shares one database, so run serially for determinism.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.START_LEGACY
    ? {
        command: 'node app.js',
        cwd: path.resolve(__dirname, '..'),
        url: BASE_URL,
        reuseExistingServer: true,
        env: {
          PORT: port,
          DATABASE_URL: process.env.DATABASE_URL || '',
          SESSION_SECRET: process.env.SESSION_SECRET || 'legacy-tests-secret',
        },
      }
    : undefined,
});
