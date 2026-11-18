import { defineConfig, devices } from "@playwright/test";

// E2E tests live in tests/e2e (owned by QA).
// Locally Playwright starts `npm run dev`. In CI it runs the standalone
// production server (`node .next/standalone/server.js`, the same entrypoint
// as the Docker image). Run `npm run build` first. scripts/prepare-standalone.mjs
// copies public/ and .next/static into the standalone folder.
const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Set PLAYWRIGHT_BASE_URL to test an already-running deployment.
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
          PORT: String(PORT),
          // server.js binds to $HOSTNAME. CI runners set HOSTNAME to the
          // machine name, so pin it to loopback.
          HOSTNAME: "127.0.0.1",
        },
      },
});
