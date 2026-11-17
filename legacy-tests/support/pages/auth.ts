import { expect, type Page } from '@playwright/test';
import { routes } from '../routes';
import type { TestUser } from '../data';
import { Dialogs, expectMessage, field, Nav } from './base';

export class LoginPage {
  constructor(private readonly page: Page, private readonly dialogs: Dialogs) {}

  username = () => field(this.page, /username/i, 'input[name="txtUsername"]');
  password = () => field(this.page, /password/i, 'input[name="txtPassword"]');
  submit = () => this.page.getByRole('button', { name: /submit|log ?in|sign in/i }).first();

  async goto() {
    await this.page.goto(routes.login);
  }

  async attempt(username: string, password: string) {
    await this.goto();
    await this.username().fill(username);
    await this.password().fill(password);
    await this.submit().click();
  }

  async loginAs(user: Pick<TestUser, 'username' | 'password'>) {
    await this.attempt(user.username, user.password);
    await this.expectLoggedIn(user.username);
  }

  async expectLoggedIn(username: string) {
    await expect(this.page).toHaveURL(new RegExp(`${routes.home}$`));
    await expect(this.page.getByText(new RegExp(`welcome\\s+${username}`, 'i'))).toBeVisible();
  }

  async expectOnLoginPage() {
    await expect(this.page.getByRole('heading', { name: /user login|log ?in|sign in/i })).toBeVisible();
    await expect(this.username()).toBeVisible();
  }

  /** Login was refused: an error is shown and the user is still on the login form. */
  async expectRejected(text: RegExp = /invalid/i) {
    await expectMessage(this.page, this.dialogs, text);
    await expect(this.page).not.toHaveURL(new RegExp(`${routes.home}$`));
    await this.expectOnLoginPage();
  }
}

export class ChangePasswordPage {
  constructor(private readonly page: Page, private readonly dialogs: Dialogs) {}

  async open() {
    await new Nav(this.page).click('Change Password');
    await expect(this.page.getByRole('heading', { name: 'Change Password' })).toBeVisible();
  }

  async change(current: string, next: string, confirm = next) {
    await this.page.getByLabel(/current password/i).fill(current);
    await this.page.getByLabel(/^new password/i).fill(next);
    await this.page.getByLabel(/confirm/i).fill(confirm);
    await this.page.getByRole('button', { name: /change password/i }).click();
  }

  async expectSuccess() {
    await expectMessage(this.page, this.dialogs, /password changed successfully/i);
  }

  async expectError(text: RegExp) {
    await expectMessage(this.page, this.dialogs, text);
    await expect(this.page.getByText(/password changed successfully/i)).toHaveCount(0);
  }
}
