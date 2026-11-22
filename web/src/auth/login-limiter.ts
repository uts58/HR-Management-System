import "server-only";

export const FAILURE_LIMIT = 10;
export const FAILURE_WINDOW_MS = 60_000;
const SWEEP_THRESHOLD = 10_000;

interface Entry {
  failures: number;
  resetAt: number;
}

export class LoginFailureLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly limit = FAILURE_LIMIT,
    private readonly windowMs = FAILURE_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  static key(ip: string | null, username: string): string {
    return `${ip ?? "unknown"}|${username.trim().toLowerCase()}`;
  }

  private current(key: string): Entry | undefined {
    const e = this.entries.get(key);
    if (e && e.resetAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return e;
  }

  retryAfterSeconds(key: string): number {
    const e = this.current(key);
    if (!e || e.failures < this.limit) return 0;
    return Math.max(1, Math.ceil((e.resetAt - this.now()) / 1000));
  }

  recordFailure(key: string): void {
    const e = this.current(key);
    if (e) {
      e.failures += 1;
    } else {
      this.entries.set(key, {
        failures: 1,
        resetAt: this.now() + this.windowMs,
      });
    }
    if (this.entries.size > SWEEP_THRESHOLD) this.sweep();
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }

  private sweep(): void {
    const t = this.now();
    for (const [k, e] of this.entries)
      if (e.resetAt <= t) this.entries.delete(k);
  }

  reset(): void {
    this.entries.clear();
  }
}

export const loginFailureLimiter = new LoginFailureLimiter();
