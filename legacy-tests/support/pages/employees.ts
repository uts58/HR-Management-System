import { expect, type Page } from '@playwright/test';
import { routes } from '../routes';
import { Dialogs, field, Nav, rowWith, rowAction } from './base';

export interface EmployeeForm {
  firstName: string;
  middleName?: string;
  lastName: string;
  department: string;
  position: string;
  country: string;
  homeTown: string;
  contact: string;
  email: string;
  gender: 'Male' | 'Female';
  maritalStatus: 'Single' | 'Married' | 'Divorced';
  dateOfBirth: string;
}

export class EmployeePages {
  constructor(private readonly page: Page, private readonly dialogs: Dialogs) {}

  private nav = () => new Nav(this.page);

  async openList() {
    await this.nav().click('Manage Employee');
    await expect(this.page.getByRole('heading', { name: /employees listing/i })).toBeVisible();
  }

  async openAdd() {
    await this.nav().click('Add new employee');
    await expect(this.page.getByRole('heading', { name: /add employee/i })).toBeVisible();
  }

  row(text: string | RegExp) {
    return rowWith(this.page, text);
  }

  /** Fills every field of the add/edit form. */
  async fill(data: EmployeeForm) {
    const p = this.page;
    await field(p, /first name/i, 'input[name="txtFirst"]').fill(data.firstName);
    await field(p, /middle name/i, 'input[name="txtMiddle"]').fill(data.middleName ?? '');
    await field(p, /last name/i, 'input[name="txtLast"]').fill(data.lastName);
    await field(p, /department/i, 'select[name="department"]').selectOption({ label: data.department });
    await field(p, /position/i, 'select[name="position"]').selectOption({ label: data.position });
    await field(p, /country/i, 'select[name="country"]').selectOption({ label: data.country });
    await field(p, /home town/i, 'input[name="txtHomeTown"]').fill(data.homeTown);
    await field(p, /contact/i, 'input[name="txtContact"]').fill(data.contact);
    await field(p, /e-?mail/i, 'input[name="txtEmail"]').fill(data.email);
    await p.getByRole('radio', { name: data.gender }).or(p.locator(`input[name="sex"][value="${data.gender === 'Male' ? 1 : 0}"]`)).first().check();
    await field(p, /marit/i, 'select[name="maritalStatus"]').selectOption({ label: data.maritalStatus });
    await field(p, /date of birth/i, 'input[name="date"]').fill(data.dateOfBirth);
  }

  async submit() {
    await this.page.getByRole('button', { name: /submit|save/i }).first().click();
  }

  async add(data: EmployeeForm) {
    await this.openAdd();
    await this.fill(data);
    await this.submit();
  }

  async expectSaved() {
    await expect(this.page.getByText(/saved succ?u?essfully/i)).toBeVisible();
  }

  /**
   * After adding an employee, HR is shown the new login once
   * (legacy: "Login for the new employee: username X, temporary password Y.").
   */
  async readInitialCredentials(): Promise<{ username: string; password: string }> {
    const msg = this.page.getByText(/temporary password/i).first();
    await expect(msg).toBeVisible();
    const text = (await msg.innerText()).replace(/\s+/g, ' ');
    const m = text.match(/username:?\s*(\S+?)[,;]?\s+temporary password:?\s*([A-Za-z0-9_\-+/=!@#$%^&*]+)/i);
    if (!m) throw new Error(`could not read credentials from: ${text}`);
    return { username: m[1], password: m[2] };
  }

  async openDetails(name: string | RegExp) {
    await this.row(name).getByRole('link', { name: /view details/i }).click();
    await expect(this.page.getByRole('heading', { name: /employee details/i })).toBeVisible();
  }

  async openEdit(name: string | RegExp) {
    await this.row(name).getByRole('link', { name: /edit/i }).click();
    await expect(this.page.getByRole('heading', { name: /edit employee/i })).toBeVisible();
  }

  async delete(name: string | RegExp) {
    this.dialogs.acceptConfirms = true;
    await rowAction(this.row(name), /delete/i).click();
    await expect(this.page.getByRole('heading', { name: /employees listing/i })).toBeVisible();
    this.dialogs.acceptConfirms = true;
  }

  /** Asserts the details/profile page shows each value (label/value pairs). */
  async expectDetails(values: string[]) {
    const main = this.page.locator('#main, main').first();
    for (const v of values) await expect(main).toContainText(v);
  }

  async gotoDetailsById(id: number) {
    await this.page.goto(routes.employeeDetails(id));
  }
}
