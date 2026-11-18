import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/contracts/common";
import {
  EMPTY_DATE,
  compareIsoDatesNullsLast,
  formatInstant,
  formatIsoDate,
  instantToIsoDate,
  isIsoDate,
  isoDateToUtcDate,
  latestTodayIso,
  parseIsoDate,
  toIsoDate,
  toIsoDateOrNull,
  todayIso,
} from "./dates";

const iso = (s: string) => s as IsoDate;

describe("isIsoDate", () => {
  it.each(["2026-01-01", "2024-02-29", "2000-02-29", "1900-12-31"])(
    "accepts %s",
    (v) => expect(isIsoDate(v)).toBe(true),
  );

  it.each([
    "",
    "2026-1-01",
    "2026-01-1",
    "01 Jan 1990",
    "1/2/2026",
    "2026-13-01",
    "2026-00-10",
    "2026-02-29", // not a leap year
    "1900-02-29", // century, not leap
    "2026-04-31",
    "2026-01-01T00:00:00Z",
    " 2026-01-01",
    "0000-01-01",
  ])("rejects %j", (v) => expect(isIsoDate(v)).toBe(false));

  it("rejects non-strings", () => {
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(20260101)).toBe(false);
    expect(isIsoDate(new Date())).toBe(false);
  });

  it("parseIsoDate throws on invalid input", () => {
    expect(parseIsoDate("2026-03-04")).toBe("2026-03-04");
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
  });
});

describe("Prisma @db.Date boundary", () => {
  it("toIsoDate reads UTC fields of a UTC-midnight Date", () => {
    expect(toIsoDate(new Date("1990-01-01T00:00:00.000Z"))).toBe("1990-01-01");
  });

  it("toIsoDate ignores the time of day and the process zone", () => {
    // 23:30 UTC is already the next day east of UTC, but @db.Date is UTC.
    expect(toIsoDate(new Date("2026-06-30T23:30:00.000Z"))).toBe("2026-06-30");
  });

  it("toIsoDate rejects an invalid Date", () => {
    expect(() => toIsoDate(new Date("nope"))).toThrow(RangeError);
  });

  it("toIsoDateOrNull passes null through", () => {
    expect(toIsoDateOrNull(null)).toBeNull();
    expect(toIsoDateOrNull(undefined)).toBeNull();
    expect(toIsoDateOrNull(new Date("2026-02-03T00:00:00Z"))).toBe(
      "2026-02-03",
    );
  });

  it("isoDateToUtcDate gives UTC midnight and round-trips", () => {
    const d = isoDateToUtcDate(iso("2024-02-29"));
    expect(d.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(toIsoDate(d)).toBe("2024-02-29");
  });

  it("isoDateToUtcDate handles two-digit years without the 19xx shift", () => {
    expect(toIsoDate(isoDateToUtcDate(iso("0050-06-01")))).toBe("0050-06-01");
  });

  it("isoDateToUtcDate rejects a non-date", () => {
    expect(() => isoDateToUtcDate(iso("2026-02-30"))).toThrow(RangeError);
  });
});

describe("business day", () => {
  // 2026-11-17 20:30 UTC: already 18 Nov in Dhaka (UTC+6), still 17 Nov in
  // New York (UTC-5).
  const instant = new Date("2026-11-17T20:30:00.000Z");

  it("instantToIsoDate uses the given zone", () => {
    expect(instantToIsoDate(instant, "Asia/Dhaka")).toBe("2026-11-18");
    expect(instantToIsoDate(instant, "America/New_York")).toBe("2026-11-17");
    expect(instantToIsoDate(instant, "UTC")).toBe("2026-11-17");
  });

  it("todayIso uses the company zone, not the process zone", () => {
    expect(todayIso("Asia/Dhaka", instant)).toBe("2026-11-18");
    expect(todayIso("America/Los_Angeles", instant)).toBe("2026-11-17");
  });

  it("todayIso defaults to now and returns an IsoDate", () => {
    expect(isIsoDate(todayIso("UTC"))).toBe(true);
  });

  it("todayIso handles DST transitions", () => {
    // 2026-03-08 07:59 UTC = 2026-03-07 23:59 PST (before the switch).
    expect(
      todayIso("America/Los_Angeles", new Date("2026-03-08T07:59:00Z")),
    ).toBe("2026-03-07");
    // 2026-03-09 08:00 UTC = 01:00 PDT on 9 Mar (after the switch).
    expect(
      todayIso("America/Los_Angeles", new Date("2026-03-09T08:00:00Z")),
    ).toBe("2026-03-09");
  });

  it("latestTodayIso is the UTC+14 date", () => {
    expect(latestTodayIso(new Date("2026-11-17T10:00:00Z"))).toBe("2026-11-18");
    expect(latestTodayIso(new Date("2026-11-17T09:59:00Z"))).toBe("2026-11-17");
  });
});

describe("formatIsoDate", () => {
  it("formats as d MMM yyyy in en-GB", () => {
    expect(formatIsoDate(iso("1990-01-01"))).toBe("1 Jan 1990");
    expect(formatIsoDate(iso("2026-12-31"))).toBe("31 Dec 2026");
  });

  it("shows a dash for null (unparseable migrated dates)", () => {
    expect(formatIsoDate(null)).toBe(EMPTY_DATE);
    expect(formatIsoDate(undefined)).toBe("—");
  });

  it("accepts another locale", () => {
    expect(formatIsoDate(iso("2026-07-04"), "en-US")).toBe("Jul 4, 2026");
  });
});

describe("formatInstant", () => {
  const instant = new Date("2026-11-17T20:30:00.000Z");

  it("formats in the given zone with time by default", () => {
    expect(formatInstant(instant, "Asia/Dhaka")).toBe("18 Nov 2026, 02:30");
    expect(formatInstant(instant, "UTC")).toBe("17 Nov 2026, 20:30");
  });

  it("can omit the time", () => {
    expect(formatInstant(instant, "Asia/Dhaka", { time: false })).toBe(
      "18 Nov 2026",
    );
  });

  it("shows a dash for null or an invalid Date", () => {
    expect(formatInstant(null, "UTC")).toBe(EMPTY_DATE);
    expect(formatInstant(new Date("x"), "UTC")).toBe(EMPTY_DATE);
  });
});

describe("compareIsoDatesNullsLast", () => {
  const values = [
    null,
    iso("2026-03-01"),
    iso("2025-12-31"),
    null,
    iso("2026-01-15"),
  ];

  it("sorts ascending with nulls last", () => {
    expect([...values].sort((a, b) => compareIsoDatesNullsLast(a, b))).toEqual([
      "2025-12-31",
      "2026-01-15",
      "2026-03-01",
      null,
      null,
    ]);
  });

  it("sorts descending with nulls still last", () => {
    expect(
      [...values].sort((a, b) => compareIsoDatesNullsLast(a, b, "desc")),
    ).toEqual(["2026-03-01", "2026-01-15", "2025-12-31", null, null]);
  });

  it("treats equal values as equal", () => {
    expect(compareIsoDatesNullsLast(iso("2026-01-01"), iso("2026-01-01"))).toBe(
      0,
    );
    expect(compareIsoDatesNullsLast(null, undefined)).toBe(0);
  });
});
