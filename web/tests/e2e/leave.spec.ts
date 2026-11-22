import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";
import { expectFieldError } from "../support/pages/common";
import { fullName, uid } from "../support/users";

/** Feature map rows 24–29 (legacy /addLeave, saveLeave, viewLeave, displayLeave, assignLeave, viewLeavebyAdmin). */

test.describe("Apply for leave: validation", () => {
  test.beforeEach(async ({ employee }) => {
    await employee.page.goto("/dashboard");
    await employee.leave.openApply();
  });

  test("an end date before the start date is rejected", async ({
    employee,
  }) => {
    await employee.leave.fillApply({
      from: "2027-05-10",
      to: "2027-05-01",
      reason: "Backwards",
    });
    await employee.leave.submitApply();
    await expectFieldError(
      employee.leave.applyForm().getByLabel("To", { exact: true }),
      "End date cannot be before the start date",
    );
  });

  test("both dates are required", async ({ employee }) => {
    await employee.leave.submitApply();
    const f = employee.leave.applyForm();
    await expectFieldError(
      f.getByLabel("From", { exact: true }),
      "Start date is required",
    );
    await expectFieldError(
      f.getByLabel("To", { exact: true }),
      "End date is required",
    );
  });

  test("leave types match the legacy form", async ({ employee }) => {
    const options = await employee.leave
      .applyForm()
      .getByLabel("Leave type")
      .locator("option")
      .allInnerTexts();
    expect(options.map((o) => o.trim())).toEqual([
      "Sick Leave",
      "Annual Leave",
      "Casual Leave",
      "Maternity Leave",
      "Unpaid Leave",
    ]);
  });
});

test.describe("Leave: journeys", { tag: BACKEND_TAG }, () => {
  const lenaName = fullName(users.lena);

  test("employee applies; HR approves; employee is notified and sees Approved", async ({
    as,
    hr,
  }) => {
    const reason = uid("Family trip");
    const lena = await as(users.lena);
    await lena.leave.apply({
      type: "Annual Leave",
      from: "2027-06-14",
      to: "2027-06-18",
      reason,
    });
    await lena.leave.openHistory();
    await lena.leave.expectStatus(reason, "Pending");
    await expect(lena.leave.row(reason)).toContainText("Annual Leave");
    await expect(lena.leave.row(reason)).toContainText(
      "14 Jun 2027 – 18 Jun 2027",
    );

    await hr.page.goto("/dashboard");
    await hr.leave.openPending();
    await expect(hr.leave.row(reason)).toContainText(lenaName);
    await hr.leave.decide(reason, lenaName, "Approve");
    await expect(hr.leave.row(reason)).toHaveCount(0);
    await hr.leave.openAll();
    await hr.leave.expectStatus(reason, "Approved");

    // Dashboard notification, then "New" in history; seen once viewed.
    await lena.dashboard.goto();
    await expect(lena.dashboard.leaveNotification()).toHaveText(
      /Your leave request has been reviewed \(1\)/,
    );
    await lena.dashboard.leaveNotification().click();
    await expect(lena.page).toHaveURL("/leave/history");
    await lena.leave.expectStatus(reason, "Approved");
    await expect(lena.leave.row(reason)).toContainText("New");
    await expect
      .poll(async () => {
        await lena.dashboard.goto();
        return lena.dashboard.leaveNotification().count();
      })
      .toBe(0);
  });

  test("employee applies; HR rejects; employee sees Rejected", async ({
    as,
    hr,
  }) => {
    const reason = uid("Long weekend");
    const lena = await as(users.lena);
    await lena.leave.apply({
      type: "Casual Leave",
      from: "2027-07-02",
      to: "2027-07-03",
      reason,
    });

    await hr.page.goto("/leave/requests");
    await hr.leave.decide(reason, lenaName, "Reject");
    await hr.page.goto("/leave/all");
    await hr.leave.expectStatus(reason, "Rejected");

    await lena.page.goto("/leave/history");
    await lena.leave.expectStatus(reason, "Rejected");
  });

  test("HR dashboard shows the pending count and links to the queue", async ({
    as,
    hr,
  }) => {
    const lena = await as(users.lena);
    await lena.leave.apply({
      type: "Sick Leave",
      from: "2027-08-02",
      to: "2027-08-02",
      reason: uid("Flu"),
    });
    await hr.dashboard.goto();
    const link = hr.dashboard.leaveNotification();
    await expect(link).toHaveText(/Pending leave requests \(\d+\)/);
    await link.click();
    await expect(hr.page).toHaveURL("/leave/requests");
    await expect(hr.page.getByRole("heading", { level: 1 })).toHaveText(
      "Pending leave requests",
    );
  });

  test("the pending queue is oldest first", async ({ as, hr }) => {
    const first = uid("Queue first");
    const second = uid("Queue second");
    const lena = await as(users.lena);
    await lena.leave.apply({
      type: "Sick Leave",
      from: "2027-09-01",
      to: "2027-09-01",
      reason: first,
    });
    await lena.leave.apply({
      type: "Sick Leave",
      from: "2027-09-02",
      to: "2027-09-02",
      reason: second,
    });
    let rows: string[] = [];
    await expect
      .poll(async () => {
        await hr.page.goto("/leave/requests");
        rows = await hr.page.getByRole("row").allInnerTexts();
        return [first, second].every((r) => rows.some((t) => t.includes(r)));
      })
      .toBe(true);
    const i1 = rows.findIndex((r) => r.includes(first));
    const i2 = rows.findIndex((r) => r.includes(second));
    expect(i1).toBeLessThan(i2);
  });
});
