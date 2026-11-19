import { describe, expect, it } from "vitest";
import { LoginFailureLimiter } from "./login-limiter";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("LoginFailureLimiter", () => {
  it("blocks a (ip, username) pair after 10 failures in 60 s", () => {
    const c = clock();
    const l = new LoginFailureLimiter(10, 60_000, c.now);
    const key = LoginFailureLimiter.key("10.0.0.1", "Jane");
    for (let i = 0; i < 9; i++) l.recordFailure(key);
    expect(l.retryAfterSeconds(key)).toBe(0);
    l.recordFailure(key);
    expect(l.retryAfterSeconds(key)).toBe(60);
    c.advance(59_500);
    expect(l.retryAfterSeconds(key)).toBe(1);
    c.advance(500);
    expect(l.retryAfterSeconds(key)).toBe(0); // window over
  });

  it("keys on both IP and (case-insensitive) username", () => {
    const l = new LoginFailureLimiter(2, 60_000, clock().now);
    const k = LoginFailureLimiter.key("10.0.0.1", "jane");
    l.recordFailure(k);
    l.recordFailure(k);
    expect(
      l.retryAfterSeconds(LoginFailureLimiter.key("10.0.0.1", " JANE ")),
    ).toBeGreaterThan(0);
    expect(
      l.retryAfterSeconds(LoginFailureLimiter.key("10.0.0.1", "bob")),
    ).toBe(0);
    expect(
      l.retryAfterSeconds(LoginFailureLimiter.key("10.0.0.2", "jane")),
    ).toBe(0);
  });

  it("a success clears the counter", () => {
    const l = new LoginFailureLimiter(3, 60_000, clock().now);
    const k = LoginFailureLimiter.key("10.0.0.1", "jane");
    l.recordFailure(k);
    l.recordFailure(k);
    l.recordSuccess(k);
    l.recordFailure(k);
    l.recordFailure(k);
    expect(l.retryAfterSeconds(k)).toBe(0);
  });
});
