import { postSignIn } from "../support/auth";
import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";
import { ChangePasswordPage } from "../support/pages/auth";

/** Feature map rows 5–6 (legacy /changePassword, /savePassword) and the forced change. */

test.describe("Change password: validation", () => {
  test.beforeEach(async ({ employee }) => {
    await employee.page.goto("/dashboard");
    await employee.shell.chooseFromUserMenu("Change password");
    await employee.password.expectNormal();
  });

  test("an empty new password is rejected (legacy BUG-05)", async ({
    employee,
  }) => {
    await employee.password.change(users.john.password, "", "");
    await employee.password.expectError("next", "New password is required");
  });

  test("a mismatched confirmation is rejected", async ({ employee }) => {
    await employee.password.change(
      users.john.password,
      "Brand-new-pass1",
      "Different-pass1",
    );
    await employee.password.expectError("confirm", "Passwords do not match");
  });

  test("a password shorter than 8 characters is rejected", async ({
    employee,
  }) => {
    await employee.password.change(users.john.password, "short1", "short1");
    await employee.password.expectError(
      "next",
      "New password must be at least 8 characters",
    );
  });

  test("the new password must differ from the current one", async ({
    employee,
  }) => {
    await employee.password.change(users.john.password, users.john.password);
    await employee.password.expectError(
      "next",
      "New password must be different from the current password",
    );
  });

  test("the current password is required", async ({ employee }) => {
    await employee.password.change("", "Brand-new-pass1");
    await employee.password.expectError(
      "current",
      "Current password is required",
    );
  });
});

test.describe("Change password: journeys", { tag: BACKEND_TAG }, () => {
  test("user changes password: toast, other sessions end, old password stops working", async ({
    as,
    baseURL,
  }) => {
    const next = "Chad-new-pass-2026";
    const chad = await as(users.chad);
    const otherDevice = await as(users.chad);

    await chad.page.goto("/change-password");
    await chad.password.change(users.chad.password, next);
    await chad.password.expectChanged();

    // Other sessions are revoked; this one stays.
    await otherDevice.page.goto("/dashboard");
    await otherDevice.login.expectOnPage();
    await chad.page.goto("/dashboard");
    await expect(chad.page).toHaveURL("/dashboard");

    const probe = await as();
    expect(
      (
        await postSignIn(
          probe.page.context(),
          baseURL!,
          users.chad.username,
          users.chad.password,
        )
      ).status(),
    ).toBe(401);
    expect(
      (
        await postSignIn(
          probe.page.context(),
          baseURL!,
          users.chad.username,
          next,
        )
      ).status(),
    ).toBe(200);
  });

  test("a wrong current password is reported on that field", async ({
    employee,
  }) => {
    await employee.page.goto("/change-password");
    await employee.password.change("not-my-password", "Brand-new-pass1");
    await employee.password.expectError(
      "current",
      /current password is incorrect/i,
    );
  });

  test("a forced change unlocks the app", async ({ as }) => {
    const fran = await as(users.fran);
    await fran.page.goto("/dashboard");
    const page = new ChangePasswordPage(fran.page);
    await page.expectForced();
    await page.change(users.fran.password, "Fran-own-pass-2026");
    await expect(fran.page).toHaveURL("/dashboard");
    await expect(fran.shell.navLink("Apply for leave")).toBeVisible();
    await fran.page.goto("/profile");
    await expect(fran.page).toHaveURL("/profile");
  });
});
