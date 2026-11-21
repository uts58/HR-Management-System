import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const SESSION = "better-auth.session_token=abc.def";

function req(path: string, opts: { cookie?: string; method?: string } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: opts.method ?? "GET",
    headers: opts.cookie ? { cookie: opts.cookie } : {},
  });
}

function location(res: Response): string | null {
  const l = res.headers.get("location");
  return l ? new URL(l).pathname + new URL(l).search : null;
}

describe("proxy", () => {
  it("sends anonymous page requests to /login with a callbackUrl", () => {
    expect(location(proxy(req("/employees?page=2")))).toBe(
      "/login?callbackUrl=%2Femployees%3Fpage%3D2",
    );
  });

  it("lets public paths and API routes through without a session", () => {
    for (const p of [
      "/login",
      "/api/auth/sign-in/username",
      "/api/health",
      "/api/anything",
    ]) {
      expect(location(proxy(req(p)))).toBeNull();
    }
  });

  it("does not redirect non-GET requests (server actions enforce auth themselves)", () => {
    expect(location(proxy(req("/employees", { method: "POST" })))).toBeNull();
  });

  it("lets signed-in users through", () => {
    expect(location(proxy(req("/dashboard", { cookie: SESSION })))).toBeNull();
  });

  it("forces /change-password while the hint cookie is set", () => {
    const cookie = `${SESSION}; hr.must_change_password=1`;
    expect(location(proxy(req("/dashboard", { cookie })))).toBe(
      "/change-password",
    );
    expect(location(proxy(req("/change-password", { cookie })))).toBeNull();
  });

  it("overwrites a client-supplied x-hr-pathname", () => {
    const r = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: SESSION, "x-hr-pathname": "/evil" },
    });
    const res = proxy(r);
    expect(res.headers.get("x-middleware-request-x-hr-pathname")).toBe(
      "/dashboard",
    );
  });

  it("adds a fresh nonce CSP to the response and forwards it (and x-nonce) to Next", () => {
    const r = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: SESSION,
        "x-nonce": "attacker",
        "content-security-policy": "script-src *",
      },
    });
    const res = proxy(r);
    const csp = res.headers.get("content-security-policy")!;
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(nonce).not.toBe("attacker");
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(
      res.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(csp);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");

    const other = proxy(req("/dashboard", { cookie: SESSION }));
    expect(other.headers.get("content-security-policy")).not.toBe(csp);
  });

  it("puts the security headers on redirects too", () => {
    const res = proxy(req("/employees"));
    expect(res.headers.get("location")).toBeTruthy();
    expect(res.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(res.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});
