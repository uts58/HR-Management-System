import { describe, expect, it } from "vitest";
import type { IsoDate } from "@/contracts/common";
import {
  EMPTY_DATE,
  addDaysIso,
  compareIsoDatesNullsLast,
  displayIsoDate,
  isBeforeTodayLenient,
  isIsoDate,
  isUtcTimestamp,
  isoDateToUtcDate,
  parseIsoDate,
  parseUtcTimestamp,
  toIsoDate,
  toIsoDateOrNull,
  toUtcTimestamp,
  toUtcTimestampOrNull,
  utcTodayIso,
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

describe("calendar arithmetic and today", () => {
  it("addDaysIso crosses month, year and leap-day boundaries", () => {
    expect(addDaysIso(iso("2026-01-31"), 1)).toBe("2026-02-01");
    expect(addDaysIso(iso("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDaysIso(iso("2024-02-28"), 1)).toBe("2024-02-29");
    expect(addDaysIso(iso("2026-03-01"), -1)).toBe("2026-02-28");
  });

  it("utcTodayIso is the UTC calendar date", () => {
    expect(utcTodayIso(new Date("2026-11-17T23:59:59Z"))).toBe("2026-11-17");
    expect(utcTodayIso(new Date("2026-11-18T00:00:00Z"))).toBe("2026-11-18");
    expect(isIsoDate(utcTodayIso())).toBe(true);
  });

  describe("isBeforeTodayLenient (UTC date, one-day tolerance)", () => {
    const now = new Date("2026-11-18T03:00:00Z");

    it("accepts past dates", () => {
      expect(isBeforeTodayLenient(iso("1990-05-01"), now)).toBe(true);
      expect(isBeforeTodayLenient(iso("2026-11-17"), now)).toBe(true);
    });

    it("accepts today's UTC date (already yesterday for users ahead of UTC)", () => {
      expect(isBeforeTodayLenient(iso("2026-11-18"), now)).toBe(true);
    });

    it("rejects tomorrow and later", () => {
      expect(isBeforeTodayLenient(iso("2026-11-19"), now)).toBe(false);
      expect(isBeforeTodayLenient(iso("2030-01-01"), now)).toBe(false);
    });
  });
});

describe("displayIsoDate", () => {
  it("shows the calendar date as-is", () => {
    expect(displayIsoDate(iso("1990-01-01"))).toBe("1990-01-01");
  });

  it("shows a dash for missing (unparseable migrated) dates", () => {
    expect(displayIsoDate(null)).toBe(EMPTY_DATE);
    expect(displayIsoDate(undefined)).toBe("—");
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

describe("UTC timestamps", () => {
  it("serialises an instant as ISO-8601 with Z", () => {
    const d = new Date(Date.UTC(2026, 10, 18, 9, 30, 5, 123));
    expect(toUtcTimestamp(d)).toBe("2026-11-18T09:30:05.123Z");
  });

  it("nullable variant and invalid Date", () => {
    expect(toUtcTimestampOrNull(null)).toBeNull();
    expect(toUtcTimestampOrNull(undefined)).toBeNull();
    expect(() => toUtcTimestamp(new Date("x"))).toThrow(RangeError);
  });

  it("round-trips through parseUtcTimestamp", () => {
    const d = new Date("2026-01-02T03:04:05.006Z");
    expect(parseUtcTimestamp(toUtcTimestamp(d)).getTime()).toBe(d.getTime());
    expect(parseUtcTimestamp("2026-01-02T03:04:05Z").toISOString()).toBe(
      "2026-01-02T03:04:05.000Z",
    );
  });

  it.each([
    "2026-01-02T03:04:05+06:00", // offset, not Z
    "2026-01-02T03:04:05", // no zone
    "2026-01-02",
    "2026-02-30T00:00:00Z",
    "not a date",
  ])("rejects %j", (v) => {
    expect(isUtcTimestamp(v)).toBe(false);
    expect(() => parseUtcTimestamp(v)).toThrow(RangeError);
  });
});
