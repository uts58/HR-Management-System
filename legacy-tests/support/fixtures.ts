import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { users, type TestUser } from './data';
import { ChangePasswordPage, LoginPage } from './pages/auth';
import { Dialogs, Nav } from './pages/base';
import { EmployeePages } from './pages/employees';
import { LeavePages } from './pages/leave';
import { NoticePages } from './pages/notices';
import { LookupPage } from './pages/org';
import { PerformancePages } from './pages/performance';

/** Everything a test needs to drive the app as one user in one browser context. */
export class App {
  readonly dialogs: Dialogs;
  readonly login: LoginPage;
  readonly nav: Nav;
  readonly password: ChangePasswordPage;
  readonly employees: EmployeePages;
  readonly departments: LookupPage;
  readonly positions: LookupPage;
  readonly leave: LeavePages;
  readonly notices: NoticePages;
  readonly performance: PerformancePages;

  constructor(readonly page: Page) {
    this.dialogs = new Dialogs(page);
    this.login = new LoginPage(page, this.dialogs);
    this.nav = new Nav(page);
    this.password = new ChangePasswordPage(page, this.dialogs);
    this.employees = new EmployeePages(page, this.dialogs);
    this.departments = LookupPage.departments(page, this.dialogs);
    this.positions = LookupPage.positions(page, this.dialogs);
    this.leave = new LeavePages(page, this.dialogs);
    this.notices = new NoticePages(page, this.dialogs);
    this.performance = new PerformancePages(page, this.dialogs);
  }
}

/**
 * Only the app under test is reachable. The legacy pages pull jQuery 1.3.1 from
 * ajax.googleapis.com over plain http; blocking it keeps runs fast and offline-safe
 * (the local jQuery 2.0.3 copy is what the pages actually use).
 */
async function isolate(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  await page.route('**/*', (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort()
  );
}

/**
 * Each browser context presents itself as a different client IP (X-Forwarded-For),
 * so the app's login rate limits (per IP, and per username+IP) apply per test
 * instead of across the whole run. Only takes effect when the app trusts one
 * proxy hop (legacy: TRUST_PROXY=1); see docs/qa/test-strategy.md.
 * Uses the 198.18.0.0/15 benchmarking range so it can never be a real client.
 */
let ipCounter = Math.floor(Math.random() * 60_000);
export function nextClientIp(): string {
  ipCounter = (ipCounter + 1) % 131_072;
  return `198.${18 + (ipCounter >> 16)}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}
export function clientHeaders(): Record<string, string> {
  return process.env.VARY_CLIENT_IP === '0' ? {} : { 'X-Forwarded-For': nextClientIp() };
}

/** CSRF token of the current page (patched legacy renders <meta name="csrf-token">). */
export async function csrfToken(page: Page): Promise<string | undefined> {
  const meta = page.locator('meta[name="csrf-token"]');
  if ((await meta.count()) === 0) return undefined;
  return (await meta.getAttribute('content')) ?? undefined;
}

async function newApp(browser: Browser, baseURL: string, user?: TestUser): Promise<{ app: App; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL, extraHTTPHeaders: clientHeaders() });
  const page = await context.newPage();
  await isolate(page, baseURL);
  const app = new App(page);
  if (user) await app.login.loginAs(user);
  return { app, close: () => context.close() };
}

type Fixtures = {
  /** Anonymous app in the default page. */
  app: App;
  /** Logged in as the seeded HR admin, in its own browser context. */
  hr: App;
  /** Logged in as seeded employee John Doe, in its own browser context. */
  employee: App;
  /** Open an extra logged-in session for any user (e.g. for multi-user flows). */
  as: (user: TestUser) => Promise<App>;
  /** A fresh anonymous browser context (its own cookies and client IP). */
  anon: () => Promise<App>;
};

export const test = base.extend<Fixtures>({
  app: async ({ page, baseURL }, use) => {
    await page.context().setExtraHTTPHeaders(clientHeaders());
    await isolate(page, baseURL!);
    await use(new App(page));
  },
  hr: async ({ browser, baseURL }, use) => {
    const s = await newApp(browser, baseURL!, users.hr);
    await use(s.app);
    await s.close();
  },
  employee: async ({ browser, baseURL }, use) => {
    const s = await newApp(browser, baseURL!, users.john);
    await use(s.app);
    await s.close();
  },
  as: async ({ browser, baseURL }, use) => {
    const opened: (() => Promise<void>)[] = [];
    await use(async (user) => {
      const s = await newApp(browser, baseURL!, user);
      opened.push(s.close);
      return s.app;
    });
    for (const close of opened) await close();
  },
  anon: async ({ browser, baseURL }, use) => {
    const opened: (() => Promise<void>)[] = [];
    await use(async () => {
      const s = await newApp(browser, baseURL!);
      opened.push(s.close);
      return s.app;
    });
    for (const close of opened) await close();
  },
});

export { expect, users };
