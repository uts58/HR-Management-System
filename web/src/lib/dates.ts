import type { IsoDate, UtcTimestamp } from "@/contracts/common";

export const EMPTY_DATE = "—";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (y: number) =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

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

export function parseIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new RangeError(
      `Not a valid YYYY-MM-DD date: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

export function toIsoDate(date: Date): IsoDate {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid Date");
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}` as IsoDate;
}

export function toIsoDateOrNull(date: Date | null | undefined): IsoDate | null {
  return date == null ? null : toIsoDate(date);
}

export function isoDateToUtcDate(iso: IsoDate): Date {
  const [y, m, d] = parseIsoDate(iso).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCFullYear(y);
  return date;
}

export function addDaysIso(iso: IsoDate, days: number): IsoDate {
  const date = isoDateToUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function utcTodayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

export function isBeforeTodayLenient(
  iso: IsoDate,
  now: Date = new Date(),
): boolean {
  return iso <= addDaysIso(utcTodayIso(now), 1);
}

export function displayIsoDate(iso: IsoDate | null | undefined): string {
  return iso ?? EMPTY_DATE;
}

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

const UTC_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function toIsoInstant(instant: Date): UtcTimestamp {
  if (Number.isNaN(instant.getTime())) throw new RangeError("Invalid Date");
  return instant.toISOString() as UtcTimestamp;
}

export function toIsoInstantOrNull(
  instant: Date | null | undefined,
): UtcTimestamp | null {
  return instant == null ? null : toIsoInstant(instant);
}

export function isUtcTimestamp(value: unknown): value is UtcTimestamp {
  if (typeof value !== "string" || !UTC_TS_RE.test(value)) return false;
  const ms = Date.parse(value);
  return (
    !Number.isNaN(ms) &&
    new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

export function parseUtcTimestamp(value: string): Date {
  if (!isUtcTimestamp(value)) {
    throw new RangeError(
      `Not an ISO-8601 UTC timestamp: ${JSON.stringify(value)}`,
    );
  }
  return new Date(value);
}
