/**
 * Date helpers. Client-safe: no env, no time zones.
 *
 * Ruling (director, 2026-11-18; supersedes ADR-0007 as written):
 * - There is no company time zone.
 * - Calendar dates (`IsoDate`, `YYYY-MM-DD`: date of birth, leave and project
 *   ranges) are never converted between zones. They travel as `YYYY-MM-DD`,
 *   are compared as strings (lexical order is chronological) and are shown
 *   as-is. They become a `Date` only at the Prisma boundary, where `@db.Date`
 *   is represented as UTC midnight and read with UTC getters.
 * - Instants (createdAt, decidedAt, terminatedAt) are stored in UTC and sent
 *   to the client as ISO-8601 strings ending in `Z`. The client renders them
 *   in the viewer's own zone (Frontend's component); nothing here formats
 *   them for display.
 * - Server-side "today" checks use the UTC date with a one-day tolerance,
 *   and only where contracts.md requires one (date of birth before today).
 */

import type { IsoDate } from "@/contracts/common";

/** Shown wherever a calendar date is missing (unparseable migrated rows). */
export const EMPTY_DATE = "—";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (y: number) =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

// ─── Calendar dates ─────────────────────────────────────────────────────────

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

/** Narrow a string to `IsoDate`, throwing `RangeError` if it is not one. */
export function parseIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new RangeError(
      `Not a valid YYYY-MM-DD date: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Prisma `@db.Date` value (UTC midnight) -> `IsoDate`, read with UTC
 * getters so the server's zone can never shift the day.
 */
export function toIsoDate(date: Date): IsoDate {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid Date");
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}` as IsoDate;
}

/** Nullable variant, for read models built from nullable DB columns. */
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
  date.setUTCFullYear(y); // Date.UTC maps years 0..99 to 1900..1999
  return date;
}

/** Add (or subtract) whole days to a calendar date. */
export function addDaysIso(iso: IsoDate, days: number): IsoDate {
  const date = isoDateToUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/** Today's date in UTC. */
export function utcTodayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

/**
 * Server rule for "before today" (ADR-0007 rule 4): the viewer's zone is
 * unknown, so it accepts `iso <= todayUtc + 1 day`. No valid input is
 * rejected in any zone; an edge-day input the tolerance lets through is
 * harmless. Client forms may add a stricter check with the browser's date.
 */
export function isBeforeTodayLenient(
  iso: IsoDate,
  now: Date = new Date(),
): boolean {
  return iso <= addDaysIso(utcTodayIso(now), 1);
}

/** Display a calendar date as-is, or "—" when missing. */
export function displayIsoDate(iso: IsoDate | null | undefined): string {
  return iso ?? EMPTY_DATE;
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

// ─── Instants ───────────────────────────────────────────────────────────────

/** ISO-8601 UTC timestamp string, e.g. `2026-11-18T09:30:00.000Z`. */
export type UtcTimestamp = string & { readonly __brand: "UtcTimestamp" };

const UTC_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Serialise an instant for the client: ISO-8601 in UTC with `Z`. */
export function toUtcTimestamp(instant: Date): UtcTimestamp {
  if (Number.isNaN(instant.getTime())) throw new RangeError("Invalid Date");
  return instant.toISOString() as UtcTimestamp;
}

/** Nullable variant (migrated rows have no createdAt). */
export function toUtcTimestampOrNull(
  instant: Date | null | undefined,
): UtcTimestamp | null {
  return instant == null ? null : toUtcTimestamp(instant);
}

/** True for an ISO-8601 UTC string with an explicit `Z` that parses. */
export function isUtcTimestamp(value: unknown): value is UtcTimestamp {
  if (typeof value !== "string" || !UTC_TS_RE.test(value)) return false;
  const ms = Date.parse(value);
  // Round-trip rejects values engines roll over, such as 30 February.
  return (
    !Number.isNaN(ms) &&
    new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

/** Parse a UTC timestamp string back into a `Date`. */
export function parseUtcTimestamp(value: string): Date {
  if (!isUtcTimestamp(value)) {
    throw new RangeError(
      `Not an ISO-8601 UTC timestamp: ${JSON.stringify(value)}`,
    );
  }
  return new Date(value);
}
