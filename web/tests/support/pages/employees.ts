import { expect, type Locator, type Page } from "@playwright/test";

import {
  ConfirmDialog,
  detailValue,
  expectHeading,
  expectToast,
  row,
  Shell,
} from "./common";

export interface EmployeeInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  maritalStatus: "Single" | "Married" | "Divorced";
  gender: "Male" | "Female";
  department: string;
  position: string;
  email: string;
  contactNo: string;
  country: string;
  homeTown: string;
  username?: string;
}

export interface IssuedCredentials {
  username: string;
  temporaryPassword: string;
}

export class EmployeesPage {
  readonly dialog: ConfirmDialog;
  constructor(private readonly page: Page) {
    this.dialog = new ConfirmDialog(page);
  }

  // ---- List (/employees) ----
  async openList() {
    await new Shell(this.page).go("Manage employees");
    await expectHeading(this.page, "Employees");
  }

  statusFilter(name: "Active" | "Terminated" | "All"): Locator {
    return this.page
      .getByRole("navigation", { name: "Filter by status" })
      .getByRole("link", { name, exact: true });
  }

  async filter(name: "Active" | "Terminated" | "All") {
    await this.statusFilter(name).click();
    await expect(this.statusFilter(name)).toHaveAttribute(
      "aria-current",
      "page",
    );
  }

  row(name: string | RegExp): Locator {
    return row(this.page, name);
  }

  async openDetails(fullName: string) {
    await this.row(fullName).getByRole("link", { name: fullName }).click();
    await expectHeading(this.page, fullName);
  }

  // ---- Create (/employees/new) ----
  form = (name: "Add employee" | "Edit employee"): Locator =>
    this.page.getByRole("form", { name });

  async openAdd() {
    await new Shell(this.page).go("Add employee");
    await expectHeading(this.page, "Add employee");
  }

  async fill(form: Locator, e: Partial<EmployeeInput>) {
    if (e.firstName !== undefined)
      await form.getByLabel("First name").fill(e.firstName);
    if (e.middleName !== undefined)
      await form.getByLabel("Middle name").fill(e.middleName);
    if (e.lastName !== undefined)
      await form.getByLabel("Last name").fill(e.lastName);
    if (e.dateOfBirth !== undefined)
      await form.getByLabel("Date of birth").fill(e.dateOfBirth);
    if (e.maritalStatus)
      await form
        .getByLabel("Marital status")
        .selectOption({ label: e.maritalStatus });
    if (e.gender)
      await form.getByRole("radio", { name: e.gender, exact: true }).check();
    if (e.department)
      await form.getByLabel("Department").selectOption({ label: e.department });
    if (e.position)
      await form.getByLabel("Position").selectOption({ label: e.position });
    if (e.email !== undefined) await form.getByLabel("Email").fill(e.email);
    if (e.contactNo !== undefined)
      await form.getByLabel("Contact number").fill(e.contactNo);
    if (e.country)
      await form.getByLabel("Country").selectOption({ label: e.country });
    if (e.homeTown !== undefined)
      await form.getByLabel("Home town").fill(e.homeTown);
    if (e.username !== undefined)
      await form.getByLabel("Username").fill(e.username);
  }

  async add(e: EmployeeInput) {
    await this.openAdd();
    const form = this.form("Add employee");
    await this.fill(form, e);
    await form.getByRole("button", { name: "Add employee" }).click();
  }

  /** One-time credentials panel after create / reset (CredentialsPanel). */
  async readCredentials(
    panelName: "Temporary login" | "New temporary password" = "Temporary login",
  ): Promise<IssuedCredentials> {
    const panel = this.page.getByRole("region", { name: panelName });
    await expect(panel).toBeVisible();
    const value = (label: string) =>
      panel
        .locator("dt", { hasText: new RegExp(`^${label}$`, "i") })
        .locator("xpath=following-sibling::dd[1]//code")
        .innerText();
    return {
      username: (await value("Username")).trim(),
      temporaryPassword: (await value("Temporary password")).trim(),
    };
  }

  // ---- Edit (/employees/[id]/edit) ----
  async openEdit(fullName: string) {
    await this.row(fullName)
      .getByRole("link", { name: `Edit ${fullName}` })
      .click();
    await expectHeading(this.page, /edit/i);
  }

  async saveEdit() {
    await this.form("Edit employee")
      .getByRole("button", { name: "Save changes" })
      .click();
    await expectToast(this.page, "Employee details saved.");
  }

  // ---- Account actions ----
  async terminate(fullName: string) {
    await this.page
      .getByRole("button", { name: `Terminate ${fullName}` })
      .click();
    await this.dialog.expectOpen(`Terminate ${fullName}?`);
    await this.dialog.confirm("Terminate employee");
  }

  async resetPassword(fullName: string): Promise<IssuedCredentials> {
    await this.page.getByRole("button", { name: "Reset password" }).click();
    await this.dialog.expectOpen(`Reset password for ${fullName}?`);
    await this.dialog.confirm("Reset password");
    return this.readCredentials("New temporary password");
  }

  detail(label: string): Locator {
    return detailValue(this.page, label);
  }
}
