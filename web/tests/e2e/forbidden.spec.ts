import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";

/**
 * Authorization through the UI (legacy SEC-01/SEC-02: legacy only checked
 * "logged in"). Page guards redirect a wrong role to /forbidden (ADR-0004).
 * Server actions are covered by the authorization matrix (web/tests/authz).
 */

const FORBIDDEN_HEADING = "You don't have access to this page";

const HR_ONLY_PAGES = [
  "/employees",
  "/employees/new",
  `/employees/${users.raj.employeeId}`,
  `/employees/${users.raj.employeeId}/edit`,
  "/org/departments",
  "/org/positions",
  "/notices",
  "/leave/requests",
  "/leave/all",
  "/appraisals",
  "/appraisals/new",
];

const EMPLOYEE_ONLY_PAGES = ["/leave/apply", "/leave/history"];

test("the /forbidden page explains the refusal and links back to the dashboard", async ({
  employee,
}) => {
  await employee.page.goto("/forbidden");
  await expect(employee.page.getByRole("heading", { level: 1 })).toHaveText(
    FORBIDDEN_HEADING,
  );
  await employee.page
    .getByRole("main")
    .getByRole("link", { name: "Go to dashboard" })
    .click();
  await expect(employee.page).toHaveURL("/dashboard");
});

test.describe("Role enforcement on pages", { tag: BACKEND_TAG }, () => {
  for (const path of HR_ONLY_PAGES) {
    test(`employee opening ${path} is sent to /forbidden`, async ({
      employee,
    }) => {
      await employee.page.goto(path);
      await expect(employee.page).toHaveURL("/forbidden");
      await expect(employee.page.getByRole("heading", { level: 1 })).toHaveText(
        FORBIDDEN_HEADING,
      );
    });
  }

  for (const path of EMPLOYEE_ONLY_PAGES) {
    test(`HR admin opening ${path} is sent to /forbidden`, async ({ hr }) => {
      await hr.page.goto(path);
      await expect(hr.page).toHaveURL("/forbidden");
    });
  }

  test("employee cannot open another employee's profile (legacy IDOR)", async ({
    employee,
  }) => {
    await employee.page.goto(`/employees/${users.raj.employeeId}`);
    await expect(employee.page).toHaveURL("/forbidden");
    await expect(employee.page.getByText("Raj Patel")).toHaveCount(0);
  });
});
