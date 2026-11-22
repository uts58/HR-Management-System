import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";
import { ChangePasswordPage } from "../support/pages/auth";

const HR_NAV = [
  "Dashboard",
  "Manage employees",
  "Add employee",
  "Departments",
  "Positions",
  "Manage notices",
  "Pending requests",
  "All leave",
  "Manage appraisals",
  "Add appraisal",
];
const EMPLOYEE_NAV = ["Dashboard", "Apply for leave", "Leave history"];

test.describe("Navigation by role", () => {
  test("HR admin sees the HR navigation", async ({ hr }) => {
    await hr.page.goto("/dashboard");
    expect(await hr.shell.navLabels()).toEqual(HR_NAV);
  });

  test("employee sees only the employee navigation", async ({ employee }) => {
    await employee.page.goto("/dashboard");
    expect(await employee.shell.navLabels()).toEqual(EMPLOYEE_NAV);
  });

  test("user menu offers Profile, Change password and Sign out", async ({
    employee,
  }) => {
    await employee.page.goto("/dashboard");
    const items = await employee.shell.userMenuItems();
    for (const item of ["Profile", "Change password", "Sign out"]) {
      expect(items).toContain(item);
    }
  });

  test("the current page is marked in the navigation", async ({ hr }) => {
    await hr.page.goto("/dashboard");
    await hr.shell.go("Departments");
    await expect(hr.shell.navLink("Departments")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(hr.shell.navLink("Dashboard")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("every HR navigation link opens a page with a heading", async ({
    hr,
  }) => {
    await hr.page.goto("/dashboard");
    for (const label of HR_NAV) {
      await hr.shell.go(label);
      await expect(
        hr.page.getByRole("heading", { level: 1 }),
        `${label} page`,
      ).toBeVisible();
    }
  });

  test("every employee navigation link opens a page with a heading", async ({
    employee,
  }) => {
    await employee.page.goto("/dashboard");
    for (const label of EMPLOYEE_NAV) {
      await employee.shell.go(label);
      await expect(
        employee.page.getByRole("heading", { level: 1 }),
        `${label} page`,
      ).toBeVisible();
    }
  });
});

test.describe("Forced password change shell", () => {
  test("a user who must change their password is sent to the forced page, with no navigation", async ({
    as,
  }) => {
    const jane = await as(users.jane);
    await jane.page.goto("/dashboard");
    await new ChangePasswordPage(jane.page).expectForced();
    await expect(jane.shell.nav).toHaveCount(0);
    expect(await jane.shell.userMenuItems()).toEqual(
      expect.arrayContaining(["Sign out"]),
    );
    expect(await jane.shell.userMenuItems()).not.toContain("Profile");
  });

  test("every page redirects to the forced change while it is pending", async ({
    as,
  }) => {
    const jane = await as(users.jane);
    for (const path of ["/profile", "/leave/apply", "/leave/history"]) {
      await jane.page.goto(path);
      await expect(jane.page, path).toHaveURL("/change-password");
    }
  });
});

test.describe("Navigation guards", { tag: BACKEND_TAG }, () => {
  test("`/` sends signed-in users to the dashboard and anonymous users to /login", async ({
    hr,
    app,
  }) => {
    await hr.page.goto("/");
    await expect(hr.page).toHaveURL("/dashboard");
    await app.page.goto("/");
    await app.login.expectOnPage();
  });
});
