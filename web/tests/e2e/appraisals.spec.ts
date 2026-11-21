import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";
import { expectFieldError, expectToast } from "../support/pages/common";
import { fullName, placeholderEmployee, uid } from "../support/users";

/** Feature map rows 30–33 (legacy /addPerformance, savePerformance, viewPerformance, deletePerformance). */

test.describe("Add appraisal: validation", () => {
  test.beforeEach(async ({ hr }) => {
    await hr.page.goto("/dashboard");
    await hr.appraisals.openAdd();
  });

  test("saving without an employee is rejected with a message (legacy BUG-11)", async ({
    hr,
  }) => {
    await hr.appraisals.fill({
      project: "No owner",
      start: "2026-01-01",
      end: "2026-02-01",
    });
    await hr.appraisals.save();
    await expectFieldError(
      hr.appraisals.form().getByLabel("Employee"),
      "Select an employee",
    );
  });

  test("an end date before the start date is rejected", async ({ hr }) => {
    // The date-order rule is cross-field: it only runs once every other field
    // is valid, so pick an employee (the first real option) first.
    await hr.appraisals
      .form()
      .getByLabel("Employee")
      .selectOption({ index: 1 });
    await hr.appraisals.fill({
      project: "Backwards",
      start: "2026-06-01",
      end: "2026-01-01",
    });
    await hr.appraisals.save();
    await expectFieldError(
      hr.appraisals.form().getByLabel("End date"),
      "End date cannot be before the start date",
    );
  });

  test("project name and dates are required", async ({ hr }) => {
    await hr.appraisals.save();
    const f = hr.appraisals.form();
    await expectFieldError(
      f.getByLabel("Project name"),
      "Project name is required",
    );
    await expectFieldError(
      f.getByLabel("Start date"),
      "Start date is required",
    );
    await expectFieldError(f.getByLabel("End date"), "End date is required");
  });

  test("the rating scale is 1 to 5 with the legacy labels", async ({ hr }) => {
    const options = await hr.appraisals
      .form()
      .getByLabel("Rating")
      .locator("option")
      .allInnerTexts();
    expect(options.map((o) => o.trim())).toEqual([
      "1 – Poor",
      "2 – Below Average",
      "3 – Average",
      "4 – Good",
      "5 – Excellent",
    ]);
  });
});

test.describe("Appraisals: journeys", { tag: BACKEND_TAG }, () => {
  test("HR adds an appraisal and sees it in the list", async ({ hr }) => {
    const project = uid("Project Apollo");
    await hr.page.goto("/dashboard");
    await hr.appraisals.openAdd();
    await hr.appraisals.fill({
      employee: "John Doe",
      project,
      start: "2026-01-01",
      end: "2026-06-30",
      rating: 4,
    });
    await hr.appraisals.save();
    await expectToast(hr.page, "Appraisal saved.");

    await hr.appraisals.openList();
    const row = hr.appraisals.row(project);
    await expect(row).toContainText("John Doe");
    await expect(row).toContainText("1 Jan 2026 – 30 Jun 2026");
    await expect(row).toContainText("4/5");
    await expect(row).toContainText("Good");
  });

  test("HR deletes an appraisal after confirming", async ({ hr }) => {
    const project = uid("Project Delete");
    await hr.page.goto("/appraisals/new");
    await hr.appraisals.fill({
      employee: "John Doe",
      project,
      start: "2026-02-01",
      end: "2026-03-01",
      rating: 2,
    });
    await hr.appraisals.save();
    await expectToast(hr.page, "Appraisal saved.");
    await hr.page.goto("/appraisals");
    await hr.appraisals.delete("John Doe", project);
    await expect(hr.appraisals.row(project)).toHaveCount(0);
  });

  test("the employee picker lists active employees only (no terminated, no placeholders)", async ({
    hr,
  }) => {
    await hr.page.goto("/appraisals/new");
    const options = (
      await hr.appraisals
        .form()
        .getByLabel("Employee")
        .locator("option")
        .allInnerTexts()
    ).map((o) => o.trim());
    expect(options).toContain("John Doe");
    expect(options).not.toContain(fullName(users.mary));
    expect(options.join("\n")).not.toContain("Unknown employee");
  });

  test("appraisals of terminated and orphaned employees stay in the list", async ({
    hr,
  }) => {
    await hr.page.goto("/appraisals");
    await expect(hr.appraisals.row("Legacy API retirement")).toContainText(
      "Terminated",
    );
    await expect(hr.appraisals.row("QA placeholder project")).toContainText(
      placeholderEmployee.name,
    );
  });
});
