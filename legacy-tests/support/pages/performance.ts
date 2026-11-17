import { expect, type Page } from '@playwright/test';
import { Dialogs, expectMessage, Nav, rowWith } from './base';

export interface AppraisalForm {
  employee?: string; // visible employee name; omit to leave unselected
  project: string;
  start: string;
  end: string;
  rating: 1 | 2 | 3 | 4 | 5;
}

export class PerformancePages {
  constructor(private readonly page: Page, private readonly dialogs: Dialogs) {}

  async openAdd() {
    await new Nav(this.page).click('Add Appraisal');
    await expect(this.page.getByRole('heading', { name: /add performance appraisal/i })).toBeVisible();
  }

  async openList() {
    await new Nav(this.page).click('Manage Appraisal');
    await expect(this.page.getByRole('heading', { name: /performance appraisals/i })).toBeVisible();
  }

  async add(a: AppraisalForm) {
    await this.openAdd();
    if (a.employee) await this.page.getByLabel(/employee/i).selectOption({ label: a.employee });
    await this.page.getByLabel(/project name/i).fill(a.project);
    await this.page.getByLabel(/start date/i).fill(a.start);
    await this.page.getByLabel(/end date/i).fill(a.end);
    await this.page.getByLabel(/rating/i).selectOption({ value: String(a.rating) });
    await this.page.getByRole('button', { name: /save appraisal/i }).click();
  }

  async expectSaved() {
    await expectMessage(this.page, this.dialogs, /appraisal saved successfully/i);
  }

  row(project: string) {
    return rowWith(this.page, project);
  }

  async delete(project: string) {
    this.dialogs.acceptConfirms = true;
    await this.row(project).getByRole('link', { name: /delete/i }).or(this.row(project).getByRole('button', { name: /delete/i })).first().click();
    await expect(this.page.getByRole('heading', { name: /performance appraisals/i })).toBeVisible();
  }
}
