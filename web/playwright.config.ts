import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const isDevServer = !isCI && !process.env.PLAYWRIGHT_BASE_URL;
const origin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    `http://127.0.0.1:${process.env.PORT ?? 3000}`,
);
const baseURL = origin.origin;
const port = origin.port || (origin.protocol === "https:" ? "443" : "80");

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  globalSetup: "./playwright.global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  ...(isDevServer ? { timeout: 90_000 } : {}),
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...(isDevServer ? { navigationTimeout: 60_000 } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: isCI
          ? "node scripts/prepare-standalone.mjs && node .next/standalone/server.js"
          : "npm run dev",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: {
          PORT: port,
          HOSTNAME: origin.hostname,
          BETTER_AUTH_URL: baseURL,
        },
      },
});
