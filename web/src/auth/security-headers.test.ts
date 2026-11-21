import { describe, expect, it } from "vitest";
import {
  buildCsp,
  buildSecurityHeaders,
  generateNonce,
} from "./security-headers";

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split(";").map((d) => {
      const [name, ...rest] = d.trim().split(/\s+/);
      return [name!, rest.join(" ")];
    }),
  );
}

const prod = { nonce: "abc123==", isDev: false, upgradeInsecureRequests: true };

describe("generateNonce", () => {
  it("is base64 of 16 random bytes and unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const n = generateNonce();
      expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      seen.add(n);
    }
    expect(seen.size).toBe(100);
  });
});

describe("buildCsp", () => {
  it("production: nonce + strict-dynamic, no eval, locked-down directives", () => {
    const d = directives(buildCsp(prod));
    expect(d.get("script-src")).toBe(
      "'self' 'nonce-abc123==' 'strict-dynamic'",
    );
    expect(d.get("default-src")).toBe("'self'");
    expect(d.get("object-src")).toBe("'none'");
    expect(d.get("base-uri")).toBe("'self'");
    expect(d.get("form-action")).toBe("'self'");
    expect(d.get("frame-ancestors")).toBe("'none'");
    expect(d.has("upgrade-insecure-requests")).toBe(true);
    expect(buildCsp(prod)).not.toContain("unsafe-eval");
    // No 'unsafe-inline' for scripts.
    expect(d.get("script-src")).not.toContain("unsafe-inline");
  });

  it("styles allow inline (sonner <style>, style attributes) without a nonce", () => {
    const style = directives(buildCsp(prod)).get("style-src")!;
    expect(style).toBe("'self' 'unsafe-inline'");
    // A nonce here would make browsers ignore 'unsafe-inline'.
    expect(style).not.toContain("nonce-");
  });

  it("development adds 'unsafe-eval' only to script-src", () => {
    const d = directives(
      buildCsp({ ...prod, isDev: true, upgradeInsecureRequests: false }),
    );
    expect(d.get("script-src")).toContain("'unsafe-eval'");
    expect(d.has("upgrade-insecure-requests")).toBe(false);
  });
});

describe("buildSecurityHeaders", () => {
  it("sets the hardening headers", () => {
    const h = buildSecurityHeaders({ ...prod, hsts: true });
    expect(h).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });
    expect(h["Content-Security-Policy"]).toContain("'nonce-abc123=='");
  });

  it("omits HSTS unless asked (production over https only)", () => {
    expect(buildSecurityHeaders({ ...prod, hsts: false })).not.toHaveProperty(
      "Strict-Transport-Security",
    );
  });
});
