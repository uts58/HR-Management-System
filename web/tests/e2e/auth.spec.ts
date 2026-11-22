import { postSignIn, SIGN_IN_PATH } from "../support/auth";
import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";

/**
 * The API block talks to Better Auth's real endpoint; the form block drives the login form.
 */

test.describe("Sign-in API (Better Auth)", () => {
  test("valid credentials sign in and set a session cookie", async ({
    context,
    baseURL,
  }) => {
    const res = await postSignIn(
      context,
      baseURL!,
      users.admin.username,
      users.admin.password,
    );
    expect(res.status()).toBe(200);
    const cookies = await context.cookies();
    expect(cookies.some((c) => /session_token/.test(c.name))).toBe(true);
  });

  test("username is case-insensitive (legacy parity)", async ({
    context,
    baseURL,
  }) => {
    const res = await postSignIn(
      context,
      baseURL!,
      "ADMIN",
      users.admin.password,
    );
    expect(res.status()).toBe(200);
  });

  test("password is case-sensitive", async ({ context, baseURL }) => {
    const res = await postSignIn(
      context,
      baseURL!,
      users.admin.username,
      users.admin.password.toUpperCase(),
    );
    expect(res.status()).toBe(401);
  });

  test("wrong password, unknown user and terminated user get the same refusal", async ({
    context,
    baseURL,
  }) => {
    const wrong = await postSignIn(
      context,
      baseURL!,
      users.john.username,
      "not-the-password",
    );
    const unknown = await postSignIn(
      context,
      baseURL!,
      "nobody.here",
      "whatever-123",
    );
    const terminated = await postSignIn(
      context,
      baseURL!,
      users.mary.username,
      users.mary.password,
    );
    for (const res of [wrong, unknown, terminated]) {
      expect(res.status()).toBe(401);
    }
    // No user enumeration: identical bodies.
    const [a, b, c] = await Promise.all([
      wrong.text(),
      unknown.text(),
      terminated.text(),
    ]);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(await context.cookies()).not.toContainEqual(
      expect.objectContaining({ name: expect.stringMatching(/session_token/) }),
    );
  });

  test("repeated failures lock that username from that client only (10 per 60 s, legacy parity)", async ({
    context,
    baseURL,
    playwright,
  }) => {
    let limited = false;
    let attempts = 0;
    while (attempts < 15 && !limited) {
      const res = await postSignIn(
        context,
        baseURL!,
        users.raj.username,
        `wrong-${attempts}`,
      );
      attempts += 1;
      limited = res.status() === 429;
    }
    expect(limited, "no HTTP 429 after 15 failed sign-ins").toBe(true);
    expect(attempts, "locked before the 10th failure").toBeGreaterThan(10);

    // While locked, even the right password from this client is refused.
    const locked = await postSignIn(
      context,
      baseURL!,
      users.raj.username,
      users.raj.password,
    );
    expect(locked.status()).toBe(429);

    // A different username from the same client is not locked (no office-NAT lockout).
    const colleague = await postSignIn(
      context,
      baseURL!,
      users.john.username,
      users.john.password,
    );
    expect(colleague.status()).toBe(200);

    // The same username from another client is not locked (no remote lockout of a named account).
    const other = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { "x-forwarded-for": "198.19.255.254" },
    });
    const ok = await other.post(SIGN_IN_PATH, {
      data: { username: users.raj.username, password: users.raj.password },
      headers: { origin: new URL(baseURL!).origin },
    });
    expect(ok.status()).toBe(200);
    await other.dispose();
  });
});

test.describe("Access without a session", () => {
  test("protected pages send anonymous visitors to /login with a callbackUrl", async ({
    app,
  }) => {
    for (const path of [
      "/dashboard",
      "/employees",
      "/leave/history",
      "/profile",
      "/change-password",
    ]) {
      await app.page.goto(path);
      await expect(app.page, `${path} should redirect`).toHaveURL(
        `/login?callbackUrl=${encodeURIComponent(path)}`,
      );
      await app.login.expectOnPage();
    }
  });

  test("the login page shows no notices ([CHANGE]: notices moved behind login)", async ({
    app,
  }) => {
    await app.login.goto();
    await expect(
      app.page.getByRole("heading", { name: /notices/i }),
    ).toHaveCount(0);
  });
});

test.describe("Login form", { tag: BACKEND_TAG }, () => {
  test("HR admin signs in with the form and lands on the dashboard", async ({
    app,
  }) => {
    await app.login.goto();
    await app.login.signIn(users.admin.username, users.admin.password);
    await expect(app.page).toHaveURL("/dashboard");
    await expect(app.page.getByRole("heading", { level: 1 })).toHaveText(
      /^Welcome, Admin User$/,
    );
  });

  test("employee signs in with the form", async ({ app }) => {
    await app.login.goto();
    await app.login.signIn(users.john.username, users.john.password);
    await expect(app.page).toHaveURL("/dashboard");
    await expect(app.shell.navLink("Apply for leave")).toBeVisible();
  });

  test("a refused sign-in shows a generic error and stays on the form", async ({
    app,
  }) => {
    await app.login.goto();
    await app.login.signIn(users.john.username, "wrong-password");
    await app.login.expectError("Invalid username or password");
    await app.login.expectOnPage();
  });

  test("a terminated employee cannot sign in", async ({ app }) => {
    await app.login.goto();
    await app.login.signIn(users.mary.username, users.mary.password);
    await app.login.expectError("Invalid username or password");
  });

  test("after sign-in the user returns to the page they asked for", async ({
    app,
  }) => {
    await app.page.goto("/employees");
    await app.login.expectOnPage();
    await app.login.signIn(users.admin.username, users.admin.password);
    await expect(app.page).toHaveURL("/employees");
  });

  test("a signed-in user opening /login goes to the dashboard", async ({
    hr,
  }) => {
    await hr.page.goto("/login");
    await expect(hr.page).toHaveURL("/dashboard");
  });

  test("sign out ends the session", async ({ employee }) => {
    await employee.page.goto("/dashboard");
    await employee.shell.signOut();
    await employee.login.expectOnPage();
    await employee.page.goto("/dashboard");
    await employee.login.expectOnPage();
  });
});
