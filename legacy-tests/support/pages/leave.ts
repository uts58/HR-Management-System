import { expect, type Page } from '@playwright/test';
import { Dialogs, expectMessage, Nav, rowWith, rowAction } from './base';

export interface LeaveForm {
  type: 'Sick Leave' | 'Annual Leave' | 'Casual Leave' | 'Maternity Leave' | 'Unpaid Leave';
  from: string;
  to: string;
  reason: string;
}

export class LeavePages {
  constructor(private readonly page: Page, private readonly dialogs: Dialogs) {}

  private nav = () => new Nav(this.page);

  // ── Employee ──
  async openRequestForm() {
    await this.nav().click('Leave Request');
    await expect(this.page.getByRole('heading', { name: /leave request/i })).toBeVisible();
  }

  async apply(leave: LeaveForm) {
    await this.openRequestForm();
    await this.page.getByLabel(/leave type/i).selectOption({ label: leave.type });
    await this.page.getByLabel(/from/i).fill(leave.from);
    await this.page.getByLabel(/to date|^to/i).fill(leave.to);
    await this.page.getByLabel(/reason/i).fill(leave.reason);
    await this.page.getByRole('button', { name: /submit request|submit|apply/i }).click();
  }

  async expectSubmitted() {
    await expectMessage(this.page, this.dialogs, /leave request submitted successfully/i);
  }

  async openMyHistory() {
    await this.nav().click('View Leave History');
    await expect(this.page.getByRole('heading', { name: /my leave history/i })).toBeVisible();
  }

  // ── HR ──
  async openPending() {
    await this.nav().click('Assign');
    await expect(this.page.getByRole('heading', { name: /pending leave requests/i })).toBeVisible();
  }

  async openAll() {
    await this.nav().click('View Leave Dates');
    await expect(this.page.getByRole('heading', { name: /all leave requests/i })).toBeVisible();
  }

  row(text: string | RegExp) {
    return rowWith(this.page, text);
  }

  async decide(reason: string, decision: 'Approve' | 'Reject') {
    this.dialogs.acceptConfirms = true;
    await rowAction(this.row(reason), decision).click();
    await expect(this.page.getByRole('heading', { name: /pending leave requests/i })).toBeVisible();
  }

  async expectStatus(reason: string, status: 'Pending' | 'Approved' | 'Rejected') {
    await expect(this.row(reason)).toContainText(status);
  }
}
