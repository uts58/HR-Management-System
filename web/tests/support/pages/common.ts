import { expect, type Locator, type Page } from "@playwright/test";

/** Every selector here is a role, label or visible text (ADR-0008 rule 5). */

export function heading(page: Page, name: string | RegExp): Locator {
  return page.getByRole("heading", { level: 1, name });
}

export async function expectHeading(page: Page, name: string | RegExp) {
  await expect(heading(page, name)).toBeVisible();
}

/** Row of any table, matched by visible text. */
export function row(page: Page, text: string | RegExp): Locator {
  return page.getByRole("row").filter({ hasText: text });
}

/** Success toast (sonner, ADR-0006 rule 4). */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(
    page.locator("[data-sonner-toaster]").getByText(text).last(),
  ).toBeVisible();
}

/**
 * Inline field error: the input is aria-invalid and its accessible
 * description (aria-describedby -> the error element) contains the message.
 */
export async function expectFieldError(
  field: Locator,
  message: string | RegExp,
) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(
    typeof message === "string" ? new RegExp(escapeRegExp(message)) : message,
  );
}

export async function expectNoFieldError(field: Locator) {
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Read-only "label: value" record (DescriptionList: <dt>/<dd>). */
export function detailValue(page: Page, label: string): Locator {
  return page
    .locator("dt", { hasText: new RegExp(`^${escapeRegExp(label)}$`, "i") })
    .locator("xpath=following-sibling::dd[1]");
}

/** Confirmation dialog for destructive actions (ConfirmActionDialog). */
export class ConfirmDialog {
  readonly root: Locator;
  constructor(private readonly page: Page) {
    this.root = page.getByRole("alertdialog");
  }
  async expectOpen(title: string | RegExp) {
    await expect(this.root).toBeVisible();
    await expect(this.root.getByRole("heading", { name: title })).toBeVisible();
  }
  async confirm(label: string | RegExp) {
    await this.root.getByRole("button", { name: label }).click();
  }
  async cancel() {
    await this.root.getByRole("button", { name: "Cancel" }).click();
    await expect(this.root).toBeHidden();
  }
  async expectError(text: string | RegExp) {
    await expect(
      this.root.getByRole("alert").filter({ hasText: text }),
    ).toBeVisible();
  }
}

/** App shell: role-based sidebar ("Main" navigation) and the user menu. */
export class Shell {
  readonly nav: Locator;
  constructor(private readonly page: Page) {
    this.nav = page.getByRole("navigation", { name: "Main" });
  }

  navLink(name: string): Locator {
    return this.nav.getByRole("link", { name, exact: true });
  }

  async go(name: string) {
    await this.navLink(name).click();
  }

  /** Visible labels of every main-navigation link, in order. */
  async navLabels(): Promise<string[]> {
    return (await this.nav.getByRole("link").allInnerTexts()).map((s) =>
      s.trim(),
    );
  }

  userMenuButton(): Locator {
    return this.page.getByRole("button", { name: /^Account menu for / });
  }

  async openUserMenu() {
    await this.userMenuButton().click();
    await expect(this.page.getByRole("menu")).toBeVisible();
  }

  async userMenuItems(): Promise<string[]> {
    await this.openUserMenu();
    const items = await this.page
      .getByRole("menu")
      .getByRole("menuitem")
      .allInnerTexts();
    await this.page.keyboard.press("Escape");
    return items.map((s) => s.trim());
  }

  async chooseFromUserMenu(item: string | RegExp) {
    await this.openUserMenu();
    await this.page.getByRole("menuitem", { name: item }).click();
  }

  async signOut() {
    await this.chooseFromUserMenu(/^Sign out$/);
  }
}
