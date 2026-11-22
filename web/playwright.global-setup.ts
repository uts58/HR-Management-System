// Playwright globalSetup. Resets the E2E database once, before any worker
// starts, using tests/support/db/reset.ts: TRUNCATE, then the seed, then the
// QA fixtures. It refuses databases not named *_test or *_it.
//
// It goes through ensureDatabaseReset(), which calls resetDatabase() and
// records a per-run stamp. E2E_RUN_ID is set here, and workers inherit it,
// so the worker fixture in tests/support/fixtures.ts sees the stamp and
// does not reset a second time.
//
// Skipped when E2E_DB_RESET=0, e.g. when PLAYWRIGHT_BASE_URL points at a
// shared deployment.
//
// Against `next dev` it also warms every route up (see warmUpDevServer).
import { randomUUID } from "node:crypto";

import { chromium, type FullConfig } from "@playwright/test";

import { ensureDatabaseReset } from "./tests/support/db/reset";
import { BACKEND } from "./tests/support/env";
import { users, type TestUser } from "./tests/support/users";

const HR_ROUTES = [
  "/dashboard",
  "/employees",
  "/employees/new",
  `/employees/${users.john.employeeId}`,
  `/employees/${users.john.employeeId}/edit`,
  "/leave/requests",
  "/leave/all",
  "/appraisals",
  "/appraisals/new",
  "/notices",
  "/org/departments",
  "/org/positions",
  "/profile",
  "/change-password",
  "/forbidden",
];
const EMPLOYEE_ROUTES = [
  "/dashboard",
  "/leave/apply",
  "/leave/history",
  "/notices",
  "/profile",
  "/change-password",
  "/employees", // redirects to /forbidden
];

/**
 * `next dev` compiles each route on first request, and a compile that lands
 * while a page is loading makes the dev client reload it. With parallel
 * workers that aborted navigations and wiped half-typed login forms, so the
 * first specs to touch a route (callbackUrl redirect, login form) failed
 * only on a cold dev server. Visiting every route once, signed in, before
 * the workers start gets all of that compilation out of the way.
 */
async function warmUpDevServer(baseURL: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    for (const [user, routes] of [
      [users.admin, HR_ROUTES],
      [users.john, EMPLOYEE_ROUTES],
    ] as Array<[TestUser, string[]]>) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      await page.goto("/login", { waitUntil: "networkidle" });
      await page.getByLabel("Username").fill(user.username);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: /^Sign in/ }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"));
      for (const route of routes) {
        await page.goto(route, { waitUntil: "networkidle" });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  process.env.E2E_RUN_ID ??= `global-${randomUUID()}`;
  await ensureDatabaseReset();

  const isDevServer =
    !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL && BACKEND;
  if (isDevServer) {
    await warmUpDevServer(config.projects[0]!.use.baseURL!);
  }
}
