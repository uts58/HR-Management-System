import { defineConfig, devices } from "@playwright/test";

// E2E tests live in tests/e2e.
// Locally Playwright starts `npm run dev`. In CI it runs the standalone
// production server (`node .next/standalone/server.js`, the same entrypoint
// as the Docker image). Run `npm run build` first. scripts/prepare-standalone.mjs
// copies public/ and .next/static into the standalone folder.
//
// ONE canonical origin. Better Auth only trusts BETTER_AUTH_URL
// (trustedOrigins in src/auth/config.ts) and answers 403 on an Origin
// mismatch, so the browser's baseURL, the server's BETTER_AUTH_URL and the
// address the server binds to must all agree. Everything here comes from a
// single value:
//   PLAYWRIGHT_BASE_URL  (an already-running deployment), else
//   BETTER_AUTH_URL      (CI sets http://127.0.0.1:3000), else
//   http://127.0.0.1:$PORT
const isCI = !!process.env.CI;
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
  // Resets the E2E database once per run (tests/support/db/reset.ts).
  globalSetup: "./playwright.global-setup.ts",
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
          PORT: port,
          // server.js binds to $HOSTNAME. CI runners set HOSTNAME to the
          // machine name, so pin it to the canonical origin's host.
          HOSTNAME: origin.hostname,
          // Overrides web/.env, so the app trusts exactly the origin the
          // browser uses.
          BETTER_AUTH_URL: baseURL,
        },
      },
});
