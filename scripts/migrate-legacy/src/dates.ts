/**
 * Robust parser for the free-text date strings stored by the legacy app.
 *
 * Formats known to have been written by legacy code:
 *   - "01 Jan 1990"   employee.dateofBirth (date-picker default "01 Jan 2019")
 *   - "1990-01-31"    empleave.leaveStart/End, performance.project_begin/end (placeholder YYYY-MM-DD, free text)
 *   - "11/17/2026"    notice.date = new Date().toLocaleDateString() on the server (en-US by default)
 * Anything else the user typed by hand is handled on a best-effort basis. If a
 * value cannot be parsed, the function returns a rejection with a reason and
 * never throws.
 *
 * The result is a calendar date as "YYYY-MM-DD" with no time zone, so it can be
 * inserted into a Postgres DATE column without UTC shifting.
 */

export type SlashOrder = "MDY" | "DMY";

export type DateParseResult =
  | { kind: "empty" }
  | { kind: "ok"; value: string; note?: DateNote }
  | { kind: "invalid"; reason: string };

/** Non-fatal observations about how the value was interpreted. */
export type DateNote =
  | "ambiguous-day-month" // e.g. 03/04/2020, interpreted with the configured order
  | "day-month-order-inferred" // e.g. 17/11/2026 with order MDY: must be DMY
  | "time-component-dropped"; // e.g. 2020-01-01T10:00:00Z

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const WEEKDAY_PREFIX = /^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+/i;

export interface DateParseOptions {
  /** How to read N/N/YYYY when both parts are <= 12. Default "MDY" (Node's default en-US toLocaleDateString). */
  slashOrder?: SlashOrder;
  minYear?: number;
  maxYear?: number;
}

export function parseLegacyDate(raw: unknown, opts: DateParseOptions = {}): DateParseResult {
  const slashOrder = opts.slashOrder ?? "MDY";
  const minYear = opts.minYear ?? 1900;
  const maxYear = opts.maxYear ?? 2100;

  if (raw === null || raw === undefined) return { kind: "empty" };
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return { kind: "invalid", reason: "invalid Date object" };
    return build(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }
  let s = String(raw).trim();
  if (s === "" || s === "0" || /^(null|undefined|n\/a|-+)$/i.test(s)) return { kind: "empty" };

  s = s.replace(/\s+/g, " ").replace(WEEKDAY_PREFIX, "");

  // 1. ISO-like, year first: 2020-01-31, 2020/1/31, 2020.01.31, optionally with a time part.
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:([T ]).*)?$/.exec(s);
  if (m) {
    const res = build(+m[1], +m[2], +m[3]);
    if (res.kind === "ok" && m[4]) res.note = "time-component-dropped";
    return res;
  }

  // 2. Compact YYYYMMDD.
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return build(+m[1], +m[2], +m[3]);

  // 3. Day, month name, year: "01 Jan 1990", "1-Jan-1990", "1st January, 1990".
  m = /^(\d{1,2})(?:st|nd|rd|th)?[ \-/.]+([A-Za-z]{3,9})\.?,?[ \-/.]+(\d{4})$/.exec(s);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (!mon) return { kind: "invalid", reason: `unknown month name "${m[2]}"` };
    return build(+m[3], mon, +m[1]);
  }

  // 4. Month name, day, year: "Jan 01 1990", "January 1, 1990" (also Date.toDateString with the weekday stripped).
  m = /^([A-Za-z]{3,9})\.?[ \-/.]+(\d{1,2})(?:st|nd|rd|th)?,?[ \-/.]+(\d{4})(?: .*)?$/.exec(s);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    if (!mon) return { kind: "invalid", reason: `unknown month name "${m[1]}"` };
    return build(+m[3], mon, +m[2]);
  }

  // 5. Numeric with the year last: 11/17/2026, 17.11.2026, 17-11-2026, optionally with ", 10:00:00 AM".
  m = /^(\d{1,2})([/.\-])(\d{1,2})\2(\d{2}|\d{4})(?:,? .*)?$/.exec(s);
  if (m) {
    if (m[4].length === 2) return { kind: "invalid", reason: "two-digit year" };
    const a = +m[1];
    const b = +m[3];
    const y = +m[4];
    // '/' follows the configured order. '.' and '-' with the year last are day-first by convention.
    const defaultOrder: SlashOrder = m[2] === "/" ? slashOrder : "DMY";
    if (a > 12 && b > 12) return { kind: "invalid", reason: "neither part can be a month" };
    if (a > 12 || b > 12) {
      const order: SlashOrder = a > 12 ? "DMY" : "MDY";
      const res = order === "DMY" ? build(y, b, a) : build(y, a, b);
      if (res.kind === "ok" && order !== defaultOrder) res.note = "day-month-order-inferred";
      return res;
    }
    const res = defaultOrder === "DMY" ? build(y, b, a) : build(y, a, b);
    if (res.kind === "ok" && a !== b) res.note = "ambiguous-day-month";
    return res;
  }

  return { kind: "invalid", reason: "unrecognised format" };

  function build(y: number, mo: number, d: number): DateParseResult {
    if (y < minYear || y > maxYear) return { kind: "invalid", reason: `year ${y} outside ${minYear}-${maxYear}` };
    if (mo < 1 || mo > 12) return { kind: "invalid", reason: `month ${mo} out of range` };
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > dim) return { kind: "invalid", reason: `day ${d} out of range for ${y}-${pad(mo)}` };
    return { kind: "ok", value: `${y}-${pad(mo)}-${pad(d)}` };
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
