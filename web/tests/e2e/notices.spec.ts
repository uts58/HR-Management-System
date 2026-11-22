import { BACKEND_TAG } from "../support/env";
import { expect, test } from "../support/fixtures";
import { expectFieldError, expectToast } from "../support/pages/common";
import { uid } from "../support/users";

/** Feature map rows 21–23 (legacy /addNotice, saveNotice, deleteNotice) and dashboard notices (row 4). */

test.describe("Notices: validation", () => {
  test("title and notice text are required", async ({ hr }) => {
    await hr.page.goto("/dashboard");
    await hr.notices.open();
    await hr.notices
      .form()
      .getByRole("button", { name: "Post notice" })
      .click();
    await expectFieldError(
      hr.notices.form().getByLabel("Title"),
      "Title is required",
    );
    await expectFieldError(
      hr.notices.form().getByLabel("Notice", { exact: true }),
      "Notice text is required",
    );
  });

  test("delete asks for confirmation and Cancel keeps the notice", async ({
    hr,
  }) => {
    await hr.page.goto("/notices");
    const trigger = hr.page
      .getByRole("button", { name: /^Delete notice "/ })
      .first();
    await trigger.click();
    await hr.notices.dialog.expectOpen("Delete this notice?");
    await hr.notices.dialog.cancel();
    await expect(trigger).toBeVisible();
  });
});

test.describe("Notices: journeys", { tag: BACKEND_TAG }, () => {
  test("HR posts an urgent notice; everyone sees it on the dashboard", async ({
    hr,
    employee,
  }) => {
    const title = uid("Urgent: fire drill");
    const body = "Fire drill at 3pm, assemble in the car park.";
    await hr.page.goto("/dashboard");
    await hr.notices.open();
    await hr.notices.post(title, body, "Urgent");
    await expectToast(hr.page, "Notice posted.");
    await expect(hr.notices.row(title)).toContainText("Urgent");

    await hr.dashboard.goto();
    await expect(hr.dashboard.noticeSummary(title)).toBeVisible();

    await employee.dashboard.goto();
    const summary = employee.dashboard.noticeSummary(title);
    await expect(summary).toContainText("Urgent");
    await summary.click();
    await expect(employee.dashboard.notices().getByText(body)).toBeVisible();
  });

  test("the dashboard lists the five newest notices, newest first", async ({
    hr,
    employee,
  }) => {
    const titles = Array.from({ length: 6 }, (_, i) => uid(`Batch ${i}`));
    await hr.page.goto("/notices");
    for (const t of titles) {
      await hr.notices.post(t, "Batch notice.", "General");
      await expectToast(hr.page, "Notice posted.");
    }
    await employee.dashboard.goto();
    const shown = await employee.dashboard
      .notices()
      .locator("summary")
      .allInnerTexts();
    expect(shown).toHaveLength(5);
    expect(shown[0]).toContain(titles[5]);
    expect(shown.join("\n")).not.toContain(titles[0]);
  });

  test("HR deletes a notice and it leaves every dashboard", async ({
    hr,
    employee,
  }) => {
    const title = uid("Delete me");
    await hr.page.goto("/notices");
    await hr.notices.post(title, "Temporary.", "Holiday");
    await expectToast(hr.page, "Notice posted.");
    await hr.notices.delete(title);
    await expect(hr.notices.row(title)).toHaveCount(0);

    await employee.dashboard.goto();
    await expect(employee.dashboard.noticeSummary(title)).toHaveCount(0);
  });
});
