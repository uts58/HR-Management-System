import { describe, expect, it } from "vitest";
import { LoginFailureLimiter, UsernameBackoffLimiter } from "./login-limiter";

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
    expect(l.retryAfterSeconds(key)).toBe(0);
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

describe("UsernameBackoffLimiter", () => {
  function make(c = clock()) {
    return {
      c,
      l: new UsernameBackoffLimiter(3, 900_000, 30_000, 120_000, c.now),
    };
  }

  it("locks a username across IPs once failures reach the threshold", () => {
    const { l } = make();
    const k = UsernameBackoffLimiter.key(" Jane ");
    l.recordFailure(k);
    l.recordFailure(UsernameBackoffLimiter.key("JANE"));
    expect(l.retryAfterSeconds(k)).toBe(0);
    l.recordFailure(k);
    expect(l.retryAfterSeconds(k)).toBe(30);
    expect(l.retryAfterSeconds(UsernameBackoffLimiter.key("bob"))).toBe(0);
  });

  it("doubles the delay on each further failure, up to the cap", () => {
    const { c, l } = make();
    const k = UsernameBackoffLimiter.key("jane");
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      l.recordFailure(k);
      const d = l.retryAfterSeconds(k);
      delays.push(d);
      c.advance(d * 1000);
    }
    expect(delays).toEqual([0, 0, 30, 60, 120, 120, 120]);
  });

  it("releases the lock when the delay passes", () => {
    const { c, l } = make();
    const k = UsernameBackoffLimiter.key("jane");
    for (let i = 0; i < 3; i++) l.recordFailure(k);
    c.advance(29_500);
    expect(l.retryAfterSeconds(k)).toBe(1);
    c.advance(500);
    expect(l.retryAfterSeconds(k)).toBe(0);
  });

  it("forgets failures after an idle period", () => {
    const { c, l } = make();
    const k = UsernameBackoffLimiter.key("jane");
    l.recordFailure(k);
    l.recordFailure(k);
    c.advance(900_000);
    l.recordFailure(k);
    expect(l.retryAfterSeconds(k)).toBe(0);
  });

  it("a success clears the counter", () => {
    const { l } = make();
    const k = UsernameBackoffLimiter.key("jane");
    l.recordFailure(k);
    l.recordFailure(k);
    l.recordSuccess(k);
    l.recordFailure(k);
    l.recordFailure(k);
    expect(l.retryAfterSeconds(k)).toBe(0);
  });
});
