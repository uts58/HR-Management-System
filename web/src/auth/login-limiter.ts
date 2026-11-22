import "server-only";

export const FAILURE_LIMIT = 10;
export const FAILURE_WINDOW_MS = 60_000;
export const USERNAME_FAILURE_THRESHOLD = 20;
export const USERNAME_IDLE_RESET_MS = 15 * 60_000;
export const USERNAME_BASE_DELAY_MS = 30_000;
export const USERNAME_MAX_DELAY_MS = 15 * 60_000;
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

interface BackoffEntry {
  failures: number;
  lockedUntil: number;
  expiresAt: number;
}

export class UsernameBackoffLimiter {
  private readonly entries = new Map<string, BackoffEntry>();

  constructor(
    private readonly threshold = USERNAME_FAILURE_THRESHOLD,
    private readonly idleResetMs = USERNAME_IDLE_RESET_MS,
    private readonly baseDelayMs = USERNAME_BASE_DELAY_MS,
    private readonly maxDelayMs = USERNAME_MAX_DELAY_MS,
    private readonly now: () => number = Date.now,
  ) {}

  static key(username: string): string {
    return username.trim().toLowerCase();
  }

  private current(key: string): BackoffEntry | undefined {
    const e = this.entries.get(key);
    if (e && e.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return e;
  }

  retryAfterSeconds(key: string): number {
    const e = this.current(key);
    if (!e) return 0;
    const wait = e.lockedUntil - this.now();
    return wait > 0 ? Math.ceil(wait / 1000) : 0;
  }

  recordFailure(key: string): void {
    const t = this.now();
    const e = this.current(key) ?? {
      failures: 0,
      lockedUntil: 0,
      expiresAt: 0,
    };
    e.failures += 1;
    if (e.failures >= this.threshold) {
      const steps = Math.min(e.failures - this.threshold, 30);
      e.lockedUntil =
        t + Math.min(this.baseDelayMs * 2 ** steps, this.maxDelayMs);
    }
    e.expiresAt = Math.max(e.lockedUntil, t) + this.idleResetMs;
    this.entries.set(key, e);
    if (this.entries.size > SWEEP_THRESHOLD) this.sweep();
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }

  private sweep(): void {
    const t = this.now();
    for (const [k, e] of this.entries)
      if (e.expiresAt <= t) this.entries.delete(k);
  }

  reset(): void {
    this.entries.clear();
  }
}

export const loginFailureLimiter = new LoginFailureLimiter();
export const usernameBackoffLimiter = new UsernameBackoffLimiter();
export const changePasswordLimiter = new LoginFailureLimiter();
