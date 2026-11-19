import { describe, expect, it } from "vitest";
import { handleAuthRequest } from "./route-handler";

const base = "http://localhost:3000/api/auth";

describe("auth route allowlist", () => {
  it.each([
    "/sign-in/email",
    "/sign-up/email",
    "/update-user",
    "/change-password",
    "/request-password-reset",
    "/reset-password/abc",
    "/callback/google",
    "/list-sessions",
    "/admin/ban-user",
    "/some-future-endpoint",
  ])("POST %s is 404", async (path) => {
    const res = await handleAuthRequest(
      new Request(`${base}${path}`, { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(404);
  });

  it("404s requests outside /api/auth", async () => {
    const res = await handleAuthRequest(
      new Request("http://localhost:3000/elsewhere/sign-out"),
    );
    expect(res.status).toBe(404);
  });
});
