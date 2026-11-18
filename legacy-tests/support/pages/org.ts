import { expect, type Page } from '@playwright/test';
import { Dialogs, expectMessage, Nav, rowWith, rowAction } from './base';

/** Departments and positions share the same "name + table with Delete" page shape. */
export class LookupPage {
  constructor(
    private readonly page: Page,
    private readonly dialogs: Dialogs,
    private readonly cfg: { menu: string; heading: RegExp; label: RegExp; addButton: RegExp }
  ) {}

  static departments(page: Page, dialogs: Dialogs) {
    return new LookupPage(page, dialogs, {
      menu: 'Manage Department',
      heading: /manage departments/i,
      label: /department name/i,
      addButton: /add department/i,
    });
  }

  static positions(page: Page, dialogs: Dialogs) {
    return new LookupPage(page, dialogs, {
      menu: 'Manage Position',
      heading: /manage positions/i,
      label: /position name/i,
      addButton: /add position/i,
    });
  }

  async open() {
    await new Nav(this.page).click(this.cfg.menu);
    await expect(this.page.getByRole('heading', { name: this.cfg.heading })).toBeVisible();
  }

  row(name: string) {
    return rowWith(this.page, name);
  }

  async add(name: string) {
    await this.page.getByLabel(this.cfg.label).fill(name);
    await this.page.getByRole('button', { name: this.cfg.addButton }).click();
  }

  async expectSaved() {
    await expectMessage(this.page, this.dialogs, /saved successfully/i);
  }

  async expectError(text: RegExp) {
    await expectMessage(this.page, this.dialogs, text);
  }

  async delete(name: string, confirm = true) {
    this.dialogs.acceptConfirms = confirm;
    await rowAction(this.row(name), /delete/i).click();
    await expect(this.page.getByRole('heading', { name: this.cfg.heading })).toBeVisible();
    this.dialogs.acceptConfirms = true;
  }
}
