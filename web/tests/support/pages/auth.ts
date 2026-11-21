import { expect, type Locator, type Page } from "@playwright/test";

import { expectFieldError, expectHeading, expectToast } from "./common";

export class LoginPage {
  constructor(private readonly page: Page) {}

  username = (): Locator => this.page.getByLabel("Username");
  password = (): Locator => this.page.getByLabel("Password");
  submit = (): Locator =>
    this.page.getByRole("button", { name: /^Sign(ing)? in/ });

  async goto(path = "/login") {
    await this.page.goto(path);
    await this.expectOnPage();
  }

  async expectOnPage() {
    await expect(this.page).toHaveURL(/\/login(\?|$)/);
    await expectHeading(this.page, "Sign in");
  }

  async signIn(username: string, password: string) {
    await this.username().fill(username);
    await this.password().fill(password);
    await this.submit().click();
  }

  /** Form-level error after a refused sign-in (always generic, ADR-0004). */
  async expectError(text: string | RegExp) {
    await expect(
      this.page.getByRole("form", { name: "Sign in" }).getByRole("alert"),
    ).toContainText(text);
  }
}

export class ChangePasswordPage {
  constructor(private readonly page: Page) {}

  form = (): Locator =>
    this.page.getByRole("form", { name: "Change password" });
  /** "Current password", or "Temporary or current password" on the forced page. */
  current = (): Locator => this.form().getByLabel(/current password/i);
  next = (): Locator => this.form().getByLabel("New password", { exact: true });
  confirm = (): Locator => this.form().getByLabel("Confirm new password");

  async goto() {
    await this.page.goto("/change-password");
  }

  async expectNormal() {
    await expectHeading(this.page, "Change password");
  }

  async expectForced() {
    await expect(this.page).toHaveURL(/\/change-password$/);
    await expectHeading(this.page, "Choose a new password");
    await expect(
      this.page.getByText("You need to change your password to continue"),
    ).toBeVisible();
  }

  async change(current: string, next: string, confirm = next) {
    await this.current().fill(current);
    await this.next().fill(next);
    await this.confirm().fill(confirm);
    await this.form().getByRole("button", { name: "Change password" }).click();
  }

  async expectChanged() {
    await expectToast(this.page, "Password changed");
  }

  async expectError(
    field: "current" | "next" | "confirm",
    message: string | RegExp,
  ) {
    const locator = {
      current: this.current,
      next: this.next,
      confirm: this.confirm,
    }[field]();
    await expectFieldError(locator, message);
  }
}
