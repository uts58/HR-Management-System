import { expect, type Page } from '@playwright/test';
import { routes } from '../routes';
import { Dialogs, expectMessage, Nav, rowWith } from './base';

export type NoticeType = 'General' | 'Urgent' | 'Holiday';

export class NoticePages {
  constructor(private readonly page: Page, private readonly dialogs: Dialogs) {}

  async open() {
    await new Nav(this.page).click('Manage Notice');
    await expect(this.page.getByRole('heading', { name: /manage notices/i })).toBeVisible();
  }

  async post(title: string, body: string, type: NoticeType) {
    await this.page.getByLabel(/title/i).fill(title);
    await this.page.getByLabel(/^notice/i).fill(body);
    await this.page.getByLabel(/type/i).selectOption({ label: type });
    await this.page.getByRole('button', { name: /post notice/i }).click();
  }

  async expectPosted() {
    await expectMessage(this.page, this.dialogs, /notice posted successfully/i);
  }

  row(title: string) {
    return rowWith(this.page, title);
  }

  async delete(title: string) {
    this.dialogs.acceptConfirms = true;
    await this.row(title).getByRole('link', { name: /delete/i }).or(this.row(title).getByRole('button', { name: /delete/i })).first().click();
    await expect(this.page.getByRole('heading', { name: /manage notices/i })).toBeVisible();
  }

  /** "Recent Notices" panel on the dashboard or the public login page. */
  recentNotices() {
    return this.page
      .getByRole('heading', { name: /recent notices/i })
      .locator('xpath=ancestor::div[contains(@class,"column") or contains(@class,"noticeinner")][1]');
  }

  async gotoDashboard() {
    await this.page.goto(routes.home);
  }
}
