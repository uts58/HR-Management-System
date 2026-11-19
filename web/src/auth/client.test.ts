import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INVALID_LOGIN_MESSAGE,
  RATE_LIMITED_MESSAGE,
  signInWithUsername,
} from "./client";

function mockFetch(status: number, body: unknown = {}) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("signInWithUsername", () => {
  it("posts JSON to the Better Auth endpoint", async () => {
    const fetchFn = mockFetch(200, { user: { mustChangePassword: false } });
    await signInWithUsername({ username: " Jane ", password: "pw" });
    expect(fetchFn).toHaveBeenCalledWith(
      "/api/auth/sign-in/username",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "Jane", password: "pw" }),
      }),
    );
  });

  it("redirects to the dashboard, a safe callbackUrl, or /change-password", async () => {
    mockFetch(200, { user: { mustChangePassword: false } });
    expect(await signInWithUsername({ username: "a", password: "b" })).toEqual({
      ok: true,
      data: { redirectTo: "/dashboard" },
    });
    expect(
      await signInWithUsername({ username: "a", password: "b" }, "/employees"),
    ).toEqual({
      ok: true,
      data: { redirectTo: "/employees" },
    });
    expect(
      await signInWithUsername(
        { username: "a", password: "b" },
        "//evil.example",
      ),
    ).toEqual({
      ok: true,
      data: { redirectTo: "/dashboard" },
    });
    mockFetch(200, { user: { mustChangePassword: true } });
    expect(
      await signInWithUsername({ username: "a", password: "b" }, "/employees"),
    ).toEqual({
      ok: true,
      data: { redirectTo: "/change-password" },
    });
  });

  it.each([401, 403, 404, 422])(
    "maps HTTP %i to the generic message",
    async (status) => {
      mockFetch(status, { message: "Username is invalid" });
      expect(
        await signInWithUsername({ username: "a", password: "b" }),
      ).toEqual({
        ok: false,
        error: { code: "VALIDATION", message: INVALID_LOGIN_MESSAGE },
      });
    },
  );

  it("maps 429 to the rate-limit message", async () => {
    mockFetch(429);
    const r = await signInWithUsername({ username: "a", password: "b" });
    expect(r).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: RATE_LIMITED_MESSAGE },
    });
  });

  it("does not call the server for empty input", async () => {
    const fetchFn = mockFetch(200);
    const r = await signInWithUsername({ username: "  ", password: "" });
    expect(r.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
