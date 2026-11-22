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
  "/employees",
];

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
