import {
  test as base,
  expect,
  type Browser,
  type Page,
} from "@playwright/test";

import { nextClientIp, signInViaApi } from "./auth";
import { ensureDatabaseReset } from "./db/reset";
import { BACKEND, BACKEND_TAG } from "./env";
import { ChangePasswordPage, LoginPage } from "./pages/auth";
import { Shell } from "./pages/common";
import { EmployeesPage } from "./pages/employees";
import {
  AppraisalsPage,
  DashboardPage,
  LeavePages,
  NoticesPage,
  OrgUnitPage,
} from "./pages/hr";
import { users, type TestUser } from "./users";

/** Page objects for one browser context. */
export class App {
  readonly shell: Shell;
  readonly login: LoginPage;
  readonly password: ChangePasswordPage;
  readonly dashboard: DashboardPage;
  readonly employees: EmployeesPage;
  readonly departments: OrgUnitPage;
  readonly positions: OrgUnitPage;
  readonly notices: NoticesPage;
  readonly leave: LeavePages;
  readonly appraisals: AppraisalsPage;

  constructor(readonly page: Page) {
    this.shell = new Shell(page);
    this.login = new LoginPage(page);
    this.password = new ChangePasswordPage(page);
    this.dashboard = new DashboardPage(page);
    this.employees = new EmployeesPage(page);
    this.departments = new OrgUnitPage(page, "Department");
    this.positions = new OrgUnitPage(page, "Position");
    this.notices = new NoticesPage(page);
    this.leave = new LeavePages(page);
    this.appraisals = new AppraisalsPage(page);
  }
}

async function openApp(
  browser: Browser,
  baseURL: string,
  user?: TestUser,
  options: { timezoneId?: string } = {},
) {
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": nextClientIp() },
    ...options,
  });
  if (user) await signInViaApi(context, baseURL, user);
  const page = await context.newPage();
  return { app: new App(page), close: () => context.close() };
}

type TestFixtures = {
  /** Skips @backend specs unless E2E_BACKEND=1 (auto). */
  backendGate: void;
  /** Anonymous app on the default page (own client IP). */
  app: App;
  /** Signed in as the seeded HR admin, own context. */
  hr: App;
  /** Signed in as seeded employee John A Doe, own context. */
  employee: App;
  /** Open another signed-in (or anonymous) context, e.g. for two-user journeys. */
  as: (user?: TestUser, options?: { timezoneId?: string }) => Promise<App>;
};

type WorkerFixtures = {
  /** Truncate + seed + QA fixtures, once per run (auto). */
  database: void;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  database: [
    async ({}, provide) => {
      await ensureDatabaseReset();
      await provide();
    },
    { scope: "worker", auto: true, timeout: 120_000 },
  ],

  backendGate: [
    async ({}, provide, testInfo) => {
      testInfo.skip(
        testInfo.tags.includes(BACKEND_TAG) && !BACKEND,
        "Needs the real services and UI wiring: run with E2E_BACKEND=1.",
      );
      await provide();
    },
    { auto: true },
  ],

  // Every default context gets its own client IP (see support/auth.ts).
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": nextClientIp() });
  },

  app: async ({ page }, provide) => {
    await provide(new App(page));
  },

  hr: async ({ browser, baseURL }, provide) => {
    const s = await openApp(browser, baseURL!, users.admin);
    await provide(s.app);
    await s.close();
  },

  employee: async ({ browser, baseURL }, provide) => {
    const s = await openApp(browser, baseURL!, users.john);
    await provide(s.app);
    await s.close();
  },

  as: async ({ browser, baseURL }, provide) => {
    const closers: (() => Promise<void>)[] = [];
    await provide(async (user, options) => {
      const s = await openApp(browser, baseURL!, user, options);
      // A fresh page is about:blank; land on the app so journeys can use it.
      await s.app.page.goto("/");
      closers.push(s.close);
      return s.app;
    });
    for (const close of closers) await close();
  },
});

export { expect, users };
