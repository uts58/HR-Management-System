import { expect, type Locator, type Page } from "@playwright/test";

import {
  ConfirmDialog,
  expectHeading,
  expectToast,
  row,
  Shell,
} from "./common";

export class OrgUnitPage {
  readonly dialog: ConfirmDialog;
  constructor(
    private readonly page: Page,
    readonly kind: "Department" | "Position",
  ) {
    this.dialog = new ConfirmDialog(page);
  }

  private get plural() {
    return this.kind === "Department" ? "Departments" : "Positions";
  }

  form = (): Locator =>
    this.page.getByRole("form", { name: `Add ${this.kind.toLowerCase()}` });
  nameInput = (): Locator => this.form().getByLabel(`${this.kind} name`);

  async open() {
    await new Shell(this.page).go(this.plural);
    await expectHeading(this.page, this.plural);
  }

  async add(name: string) {
    await this.nameInput().fill(name);
    await this.form()
      .getByRole("button", { name: `Add ${this.kind.toLowerCase()}` })
      .click();
  }

  async expectAdded() {
    await expectToast(this.page, `${this.kind} added.`);
  }

  row(name: string): Locator {
    return row(this.page, name);
  }

  deleteButton(name: string): Locator {
    return this.page.getByRole("button", {
      name: `Delete ${name}`,
      exact: true,
    });
  }

  async delete(name: string) {
    await this.deleteButton(name).click();
    await this.dialog.expectOpen(
      `Delete ${this.kind.toLowerCase()} "${name}"?`,
    );
    await this.dialog.confirm(/^Delete$/);
  }
}

export class NoticesPage {
  readonly dialog: ConfirmDialog;
  constructor(private readonly page: Page) {
    this.dialog = new ConfirmDialog(page);
  }

  form = (): Locator => this.page.getByRole("form", { name: "Post a notice" });

  async open() {
    await new Shell(this.page).go("Manage notices");
    await expectHeading(this.page, "Notices");
  }

  async post(
    title: string,
    body: string,
    type: "General" | "Urgent" | "Holiday",
  ) {
    await this.form().getByLabel("Title").fill(title);
    await this.form().getByLabel("Type").selectOption({ label: type });
    await this.form().getByLabel("Notice", { exact: true }).fill(body);
    await this.form().getByRole("button", { name: "Post notice" }).click();
  }

  row(title: string): Locator {
    return row(this.page, title);
  }

  async delete(title: string) {
    await this.page
      .getByRole("button", { name: `Delete notice "${title}"` })
      .click();
    await this.dialog.expectOpen("Delete this notice?");
    await this.dialog.confirm("Delete notice");
    await expectToast(this.page, "Notice deleted.");
  }
}

export class LeavePages {
  readonly dialog: ConfirmDialog;
  constructor(private readonly page: Page) {
    this.dialog = new ConfirmDialog(page);
  }

  applyForm = (): Locator =>
    this.page.getByRole("form", { name: "Apply for leave" });

  async openApply() {
    await new Shell(this.page).go("Apply for leave");
    await expectHeading(this.page, "Apply for leave");
  }

  async fillApply(l: {
    type?: string;
    from?: string;
    to?: string;
    reason?: string;
  }) {
    const f = this.applyForm();
    if (l.type)
      await f.getByLabel("Leave type").selectOption({ label: l.type });
    if (l.from !== undefined)
      await f.getByLabel("From", { exact: true }).fill(l.from);
    if (l.to !== undefined)
      await f.getByLabel("To", { exact: true }).fill(l.to);
    if (l.reason !== undefined) await f.getByLabel("Reason").fill(l.reason);
  }

  async submitApply() {
    await this.applyForm()
      .getByRole("button", { name: "Submit request" })
      .click();
  }

  async apply(l: { type: string; from: string; to: string; reason: string }) {
    await this.openApply();
    await this.fillApply(l);
    await this.submitApply();
    await expectToast(this.page, "Leave request submitted. HR will review it.");
  }

  async openHistory() {
    await new Shell(this.page).go("Leave history");
    await expectHeading(this.page, "My leave history");
  }

  async openPending() {
    await new Shell(this.page).go("Pending requests");
    await expectHeading(this.page, "Pending leave requests");
  }

  async openAll() {
    await new Shell(this.page).go("All leave");
    await expectHeading(this.page, "All leave requests");
  }

  row(text: string | RegExp): Locator {
    return row(this.page, text);
  }

  async decide(
    reason: string,
    employeeName: string,
    decision: "Approve" | "Reject",
  ) {
    await this.row(reason)
      .getByRole("button", { name: `${decision} leave for ${employeeName}` })
      .click();
    await this.dialog.expectOpen(`${decision} this leave?`);
    await this.dialog.confirm(new RegExp(`^${decision}$`));
    await expectToast(
      this.page,
      decision === "Approve" ? "Leave approved." : "Leave rejected.",
    );
  }

  async expectStatus(
    reason: string,
    status: "Pending" | "Approved" | "Rejected",
  ) {
    await expect(this.row(reason)).toContainText(status);
  }
}

export class AppraisalsPage {
  readonly dialog: ConfirmDialog;
  constructor(private readonly page: Page) {
    this.dialog = new ConfirmDialog(page);
  }

  form = (): Locator => this.page.getByRole("form", { name: "Add appraisal" });

  async openAdd() {
    await new Shell(this.page).go("Add appraisal");
    await expectHeading(this.page, "Add appraisal");
  }

  async openList() {
    await new Shell(this.page).go("Manage appraisals");
    await expectHeading(this.page, "Performance appraisals");
  }

  async fill(a: {
    employee?: string;
    project?: string;
    start?: string;
    end?: string;
    rating?: 1 | 2 | 3 | 4 | 5;
  }) {
    const f = this.form();
    if (a.employee)
      await f.getByLabel("Employee").selectOption({ label: a.employee });
    if (a.project !== undefined)
      await f.getByLabel("Project name").fill(a.project);
    if (a.start !== undefined) await f.getByLabel("Start date").fill(a.start);
    if (a.end !== undefined) await f.getByLabel("End date").fill(a.end);
    if (a.rating)
      await f.getByLabel("Rating").selectOption({ value: String(a.rating) });
  }

  async save() {
    await this.form().getByRole("button", { name: "Save appraisal" }).click();
  }

  row(project: string): Locator {
    return row(this.page, project);
  }

  async delete(employeeName: string, project: string) {
    await this.page
      .getByRole("button", {
        name: `Delete appraisal: ${employeeName}, ${project}`,
      })
      .click();
    await this.dialog.expectOpen("Delete this appraisal?");
    await this.dialog.confirm("Delete appraisal");
    await expectToast(this.page, "Appraisal deleted.");
  }
}

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/dashboard");
    await expectHeading(this.page, /^Welcome, /);
  }

  notices(): Locator {
    return this.page
      .getByRole("heading", { name: "Recent notices" })
      .locator("xpath=ancestor::*[@data-slot='card'][1]");
  }

  noticeSummary(title: string): Locator {
    return this.notices().locator("summary", { hasText: title });
  }

  leaveNotification(): Locator {
    return this.page.getByRole("main").getByRole("link", {
      name: /Pending leave requests \(\d+\)|Your leave request has been reviewed \(\d+\)/,
    });
  }
}
