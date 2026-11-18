/**
 * Date and time helpers (ADR-0007). The only place that formats dates.
 *
 * Two kinds of value, never mixed:
 * - Calendar dates (`IsoDate`, `YYYY-MM-DD`): date of birth, leave and
 *   project ranges. Compared as strings (lexical order is chronological).
 *   Converted to/from `Date` only at the Prisma boundary, where Prisma
 *   represents `@db.Date` as UTC midnight.
 * - Instants (`Date`): createdAt, decidedAt, terminatedAt. Stored as UTC,
 *   displayed in the company zone (`APP_TIME_ZONE`).
 *
 * This module is safe to import from client code: it never reads `env`.
 * Server code that needs the company zone uses `@/server/time`, which passes
 * `env.APP_TIME_ZONE` into these functions.
 */

import type { IsoDate } from "@/contracts/common";

/** Shown wherever a date is missing (unparseable migrated legacy values). */
export const EMPTY_DATE = "—";

/** Default display locale (ADR-0007: `d MMM yyyy`, e.g. "1 Jan 1990"). */
export const DEFAULT_LOCALE = "en-GB";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 && leap ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
}

/** True for a real calendar date written exactly as `YYYY-MM-DD`. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** Narrow a string to `IsoDate`, throwing if it is not one. */
export function parseIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new RangeError(
      `Not a valid YYYY-MM-DD date: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * Prisma `@db.Date` value (UTC midnight) -> `IsoDate`, read with UTC
 * getters so the server's zone can never shift the day.
 */
export function toIsoDate(date: Date): IsoDate {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid Date");
  }
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}` as IsoDate;
}

/** Nullable variant for read models built from nullable DB columns. */
export function toIsoDateOrNull(date: Date | null | undefined): IsoDate | null {
  return date == null ? null : toIsoDate(date);
}

/** `IsoDate` -> UTC-midnight `Date`, for writing a `@db.Date` column. */
export function isoDateToUtcDate(iso: IsoDate): Date {
  const [y, m, d] = parseIsoDate(iso).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC maps years 0..99 to 1900..1999; undo that.
  date.setUTCFullYear(y);
  return date;
}

// Intl formatters are relatively expensive to build; cache by key.
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function formatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, f);
  }
  return f;
}

/**
 * The calendar date of `instant` in time zone `timeZone`. This is the
 * boundary where an instant becomes a business day.
 */
export function instantToIsoDate(instant: Date, timeZone: string): IsoDate {
  const parts = formatter("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return `${pad(get("year"), 4)}-${pad(get("month"))}-${pad(get("day"))}` as IsoDate;
}

/**
 * "Today" as a business day in `timeZone`. Server code always passes
 * `env.APP_TIME_ZONE` (or uses `businessTodayIso()` from `@/server/time`);
 * never use `new Date()` with local getters.
 */
export function todayIso(timeZone: string, now: Date = new Date()): IsoDate {
  return instantToIsoDate(now, timeZone);
}

/**
 * The latest calendar date that is "today" anywhere on Earth (UTC+14).
 * Client-side schemas use it for "must be in the past" checks, because the
 * browser does not know the company zone: a date on or after this is in the
 * future in every zone. The service re-checks against the company zone.
 */
export function latestTodayIso(now: Date = new Date()): IsoDate {
  return instantToIsoDate(now, "Pacific/Kiritimati");
}

/**
 * Display a calendar date, e.g. "1 Jan 1990". `null` gives "—".
 * Formatting goes through a UTC-midnight `Date` with `timeZone: "UTC"`, so
 * no zone can shift the day.
 */
export function formatIsoDate(
  iso: IsoDate | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  if (iso == null) return EMPTY_DATE;
  return formatter(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(isoDateToUtcDate(iso));
}

export interface FormatInstantOptions {
  locale?: string;
  /** Include the time of day (default true): "1 Jan 2026, 14:05". */
  time?: boolean;
}

/**
 * Display an instant in `timeZone`, e.g. "1 Jan 2026, 14:05".
 * Always called on the server with `env.APP_TIME_ZONE` (see
 * `formatTimestamp` in `@/server/time`), so every user sees the same text
 * and there is no hydration mismatch. `null` gives "—".
 */
export function formatInstant(
  instant: Date | null | undefined,
  timeZone: string,
  { locale = DEFAULT_LOCALE, time = true }: FormatInstantOptions = {},
): string {
  if (instant == null || Number.isNaN(instant.getTime())) return EMPTY_DATE;
  return formatter(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  }).format(instant);
}

/**
 * Comparator for nullable calendar dates. Nulls always sort last, in both
 * directions (contract: Leave rule 9).
 */
export function compareIsoDatesNullsLast(
  a: IsoDate | null | undefined,
  b: IsoDate | null | undefined,
  direction: "asc" | "desc" = "asc",
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a === b) return 0;
  const cmp = a < b ? -1 : 1;
  return direction === "asc" ? cmp : -cmp;
}
