import { postSignIn } from "../support/auth";
import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";
import { ChangePasswordPage } from "../support/pages/auth";
import { expectFieldError, expectToast } from "../support/pages/common";
import type { EmployeeInput } from "../support/pages/employees";
import { fullName, uid } from "../support/users";

/** Feature map rows 7–14 (legacy /hr/*Employee*, /hr/viewDetails, /hr/viewProfile) + reset password. */

const newHire = (first: string): EmployeeInput => ({
  firstName: first,
  lastName: "Starter",
  dateOfBirth: "1996-11-11",
  maritalStatus: "Single",
  gender: "Female",
  department: "Finance",
  position: "Accountant",
  email: `${first.toLowerCase()}@example.com`,
  contactNo: "555-0199",
  country: "Canada",
  homeTown: "Ottawa",
});

test.describe("Add employee: validation", () => {
  test("submitting an empty form reports every required field", async ({
    hr,
  }) => {
    await hr.page.goto("/dashboard");
    await hr.employees.openAdd();
    const form = hr.employees.form("Add employee");
    await form.getByRole("button", { name: "Add employee" }).click();
    await expectFieldError(
      form.getByLabel("First name"),
      "First name is required",
    );
    await expectFieldError(
      form.getByLabel("Last name"),
      "Last name is required",
    );
    await expectFieldError(
      form.getByLabel("Department"),
      "Select a department",
    );
    await expectFieldError(form.getByLabel("Position"), "Select a position");
    await expectFieldError(form.getByLabel("Email"), "Email is required");
    await expectFieldError(
      form.getByLabel("Home town"),
      "Home town is required",
    );
    await expect(form.getByLabel("First name")).toBeFocused();
  });

  test("a date of birth in the future is rejected", async ({ hr }) => {
    await hr.page.goto("/employees/new");
    const form = hr.employees.form("Add employee");
    await hr.employees.fill(form, {
      ...newHire("Future"),
      dateOfBirth: "2090-01-01",
    });
    await form.getByRole("button", { name: "Add employee" }).click();
    await expectFieldError(
      form.getByLabel("Date of birth"),
      "Date of birth must be in the past",
    );
  });

  test("an invalid email is rejected", async ({ hr }) => {
    await hr.page.goto("/employees/new");
    const form = hr.employees.form("Add employee");
    await hr.employees.fill(form, {
      ...newHire("Bademail"),
      email: "not-an-email",
    });
    await form.getByRole("button", { name: "Add employee" }).click();
    await expectFieldError(
      form.getByLabel("Email"),
      "Enter a valid email address",
    );
  });
});

test.describe("Terminate confirmation", () => {
  test("terminate asks for confirmation, lists the consequences, and Cancel does nothing", async ({
    hr,
  }) => {
    await hr.page.goto("/employees");
    const trigger = hr.page
      .getByRole("button", { name: /^Terminate / })
      .first();
    const label = (await trigger.getAttribute("aria-label")) ?? "";
    await trigger.click();
    const dialog = hr.employees.dialog;
    await dialog.expectOpen(`${label}?`);
    await expect(dialog.root).toContainText("block their sign-in");
    await expect(dialog.root).toContainText(
      "reject their pending leave requests",
    );
    await expect(dialog.root).toContainText("history is kept");
    await dialog.cancel();
    await expect(trigger).toBeFocused();
  });
});

test.describe("Employees: journeys", { tag: BACKEND_TAG }, () => {
  test("the list shows active employees, the HR admin included with a role badge", async ({
    hr,
  }) => {
    await hr.page.goto("/dashboard");
    await hr.employees.openList();
    const admin = hr.employees.row(fullName(users.admin));
    await expect(admin).toContainText("HR admin"); // legacy hid employee id 1
    const john = hr.employees.row("John A Doe");
    await expect(john).toContainText("Software Engineer");
    await expect(john).toContainText("Engineering");
    await expect(john).toContainText("john.doe@example.com");
    await expect(john).toContainText("Active");
    await expect(hr.employees.row(fullName(users.mary))).toHaveCount(0);
  });

  test("terminated employees are hidden by default and shown on request", async ({
    hr,
  }) => {
    await hr.page.goto("/employees");
    await hr.employees.filter("Terminated");
    await expect(hr.employees.row(fullName(users.mary))).toContainText(
      "Terminated",
    );
    await expect(hr.employees.row("John A Doe")).toHaveCount(0);
    await hr.employees.filter("All");
    await expect(hr.employees.row(fullName(users.mary))).toBeVisible();
    await expect(hr.employees.row("John A Doe")).toBeVisible();
  });

  test("HR views an employee's details", async ({ hr }) => {
    await hr.page.goto("/employees");
    await hr.employees.openDetails("John A Doe", "John Doe");
    const d = (label: string) => hr.employees.detail(label);
    await expect(d("Full name")).toHaveText("John A Doe");
    await expect(d("Employee ID")).toHaveText(String(users.john.employeeId));
    await expect(d("Username")).toHaveText(users.john.username);
    await expect(d("Department")).toHaveText("Engineering");
    await expect(d("Position")).toHaveText("Software Engineer");
    await expect(d("Email")).toHaveText("john.doe@example.com");
    await expect(d("Contact number")).toHaveText("555-0101");
    await expect(d("Country")).toHaveText("USA");
    await expect(d("Home town")).toHaveText("New York");
    await expect(d("Gender")).toHaveText("Male");
    await expect(d("Marital status")).toHaveText("Single");
    await expect(d("Date of birth")).toHaveText("1 Jan 1990");
  });

  test("an unknown employee id shows the not-found page, not a server error (legacy BUG-09)", async ({
    hr,
  }) => {
    const res = await hr.page.goto("/employees/999999");
    expect(res?.status()).toBeLessThan(500);
    await expect(hr.page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
  });

  test("HR adds an employee; the new hire signs in with the one-time password and must change it (legacy BUG-01/03)", async ({
    hr,
    as,
  }) => {
    const first = `Quinn${Date.now().toString(36)}`;
    await hr.page.goto("/dashboard");
    await hr.employees.add(newHire(first));
    await expect(hr.page.getByRole("status")).toContainText(
      `Employee ${first} Starter was added.`,
    );
    const creds = await hr.employees.readCredentials();
    expect(creds.username).toBe(`${first.toLowerCase()}.starter`);
    expect(creds.temporaryPassword.length).toBeGreaterThanOrEqual(12);

    await hr.page.getByRole("link", { name: "View employee" }).click();
    await expect(hr.page.getByRole("heading", { level: 1 })).toHaveText(
      `${first} Starter`,
    );
    await hr.employees.openList();
    await expect(hr.employees.row(`${first} Starter`)).toContainText(
      "Accountant",
    );

    const hire = await as();
    await hire.login.goto();
    await hire.login.signIn(creds.username, creds.temporaryPassword);
    const page = new ChangePasswordPage(hire.page);
    await page.expectForced();
    await page.change(creds.temporaryPassword, "Quinn-own-pass-2026");
    await expect(hire.page).toHaveURL("/dashboard");
  });

  test("a taken username is rejected on the username field", async ({ hr }) => {
    await hr.page.goto("/employees/new");
    const form = hr.employees.form("Add employee");
    await hr.employees.fill(form, {
      ...newHire("Dup"),
      username: users.john.username,
    });
    await form.getByRole("button", { name: "Add employee" }).click();
    await expectFieldError(form.getByLabel("Username"), /taken|already/i);
  });

  test("HR edits an employee; a rename does not change their login (legacy BUG-02/04)", async ({
    hr,
    as,
    baseURL,
  }) => {
    const town = uid("Town");
    await hr.page.goto("/employees");
    await hr.employees.openEdit(fullName(users.eric));
    const form = hr.employees.form("Edit employee");
    await hr.employees.fill(form, { firstName: "Erik", homeTown: town });
    await hr.employees.saveEdit();

    await hr.page.goto("/employees");
    await hr.employees.openDetails("Erik Edit");
    await expect(hr.employees.detail("Home town")).toHaveText(town);
    await expect(hr.employees.detail("Username")).toHaveText(
      users.eric.username,
    );

    const probe = await as();
    expect(
      (
        await postSignIn(
          probe.page.context(),
          baseURL!,
          users.eric.username,
          users.eric.password,
        )
      ).status(),
    ).toBe(200);

    // The display name follows the rename (AccountAdminApi.updateDisplayName); the username doesn't.
    const eric = await as(users.eric);
    await eric.page.goto("/dashboard");
    await expect(eric.shell.userMenuButton()).toHaveAccessibleName(
      "Account menu for Erik Edit",
    );
  });

  test("HR terminates an employee: login blocked, open sessions ended, pending leave rejected, history kept", async ({
    hr,
    as,
    baseURL,
  }) => {
    const reason = uid("Before termination");
    const terry = await as(users.terry);
    await terry.leave.apply({
      type: "Casual Leave",
      from: "2027-04-01",
      to: "2027-04-02",
      reason,
    });

    await hr.page.goto("/employees");
    await hr.employees.terminate(fullName(users.terry));
    await expectToast(hr.page, `${fullName(users.terry)} was terminated.`);
    await expect(hr.employees.row(fullName(users.terry))).toHaveCount(0);
    await hr.employees.filter("Terminated");
    await expect(hr.employees.row(fullName(users.terry))).toContainText(
      "Terminated",
    );

    // Their open session is gone and they can't sign in again.
    await terry.page.goto("/dashboard");
    await terry.login.expectOnPage();
    const probe = await as();
    expect(
      (
        await postSignIn(
          probe.page.context(),
          baseURL!,
          users.terry.username,
          users.terry.password,
        )
      ).status(),
    ).toBe(401);

    // Pending leave was rejected; the history stays visible with a marker.
    await hr.page.goto("/leave/all");
    const leave = hr.leave.row(reason);
    await expect(leave).toContainText("Rejected");
    await expect(leave).toContainText("Terminated");

    // A terminated record can't be edited or terminated again.
    await hr.page.goto(`/employees/${users.terry.employeeId}`);
    await expect(hr.page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(
      hr.page.getByRole("button", { name: /^Terminate/ }),
    ).toHaveCount(0);
  });

  test("HR cannot terminate themselves", async ({ hr }) => {
    await hr.page.goto("/employees");
    await expect(
      hr.page.getByRole("button", {
        name: `Terminate ${fullName(users.admin)}`,
      }),
    ).toHaveCount(0);
    await hr.page.goto(`/employees/${users.admin.employeeId}`);
    await expect(
      hr.page.getByRole("button", { name: /^Terminate/ }),
    ).toHaveCount(0);
  });

  test("HR resets a password: shown once, old password stops working, the user must change it", async ({
    hr,
    as,
    baseURL,
  }) => {
    await hr.page.goto(`/employees/${users.rita.employeeId}`);
    const creds = await hr.employees.resetPassword(fullName(users.rita));
    expect(creds.username).toBe(users.rita.username);
    await hr.page.getByRole("button", { name: "Done, hide password" }).click();
    await expect(
      hr.page.getByRole("region", { name: "New temporary password" }),
    ).toHaveCount(0);

    const probe = await as();
    expect(
      (
        await postSignIn(
          probe.page.context(),
          baseURL!,
          users.rita.username,
          users.rita.password,
        )
      ).status(),
    ).toBe(401);

    const rita = await as();
    await rita.login.goto();
    await rita.login.signIn(creds.username, creds.temporaryPassword);
    await new ChangePasswordPage(rita.page).expectForced();
  });
});

test.describe("Profile and email display", { tag: BACKEND_TAG }, () => {
  test("employee views their own profile from the user menu", async ({
    employee,
  }) => {
    await employee.page.goto("/dashboard");
    await employee.shell.chooseFromUserMenu("Profile");
    await expect(employee.page.getByRole("heading", { level: 1 })).toHaveText(
      "My profile",
    );
    await expect(employee.employees.detail("Full name")).toHaveText(
      "John A Doe",
    );
    await expect(employee.employees.detail("Department")).toHaveText(
      "Engineering",
    );
    await expect(
      employee.page.getByRole("button", { name: /edit/i }),
    ).toHaveCount(0);
  });

  test("HR views their own profile from the user menu", async ({ hr }) => {
    await hr.page.goto("/dashboard");
    await hr.shell.chooseFromUserMenu("Profile");
    await expect(hr.employees.detail("Full name")).toHaveText(
      fullName(users.admin),
    );
    await expect(hr.employees.detail("Position")).toHaveText("HR Manager");
  });

  test('"No email on file" when there is no contact email; never the placeholder address', async ({
    as,
    hr,
  }) => {
    const nora = await as(users.nora);
    await nora.page.goto("/profile");
    await expect(nora.employees.detail("Email")).toHaveText("No email on file");
    await expect(nora.page.getByText("@users.invalid")).toHaveCount(0);

    await hr.page.goto(`/employees/${users.nora.employeeId}`);
    await expect(hr.employees.detail("Email")).toHaveText("No email on file");
    await hr.page.goto("/employees");
    await expect(hr.page.getByText("@users.invalid")).toHaveCount(0);
  });

  test("the contact email is shown even when the login email is a placeholder", async ({
    hr,
  }) => {
    await hr.page.goto(`/employees/${users.carl.employeeId}`);
    await expect(hr.employees.detail("Email")).toHaveText(
      "carl.contact@example.com",
    );
    await expect(hr.page.getByText("@users.invalid")).toHaveCount(0);
  });
});
