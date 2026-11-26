import { describe, expect, it } from "vitest";

import { formatCalendarDate, formatInstant } from "./date-format";

describe("formatCalendarDate", () => {
  it.each([
    ["2026-12-22", "22 Dec 2026"],
    ["1990-01-01", "1 Jan 1990"],
    ["2026-09-05", "5 Sep 2026"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatCalendarDate(iso)).toBe(expected);
  });

  it("returns null for anything that isn't YYYY-MM-DD", () => {
    expect(formatCalendarDate("01 Jan 1990")).toBeNull();
  });
});

describe("formatInstant", () => {
  const instant = new Date("2026-11-21T20:04:00.000Z");

  it("uses the calendar-date style plus 24-hour HH:mm", () => {
    expect(formatInstant(instant, { timeZone: "UTC" })).toBe(
      "21 Nov 2026, 20:04",
    );
  });

  it("converts to the given time zone", () => {
    expect(formatInstant(instant, { timeZone: "Asia/Dhaka" })).toBe(
      "22 Nov 2026, 02:04",
    );
    expect(formatInstant(instant, { timeZone: "Pacific/Pago_Pago" })).toBe(
      "21 Nov 2026, 09:04",
    );
  });

  it("drops the time with dateOnly", () => {
    expect(
      formatInstant(instant, { timeZone: "Asia/Dhaka", dateOnly: true }),
    ).toBe("22 Nov 2026");
  });

  it("pads midnight and uses Sep, not Sept", () => {
    expect(
      formatInstant(new Date("2026-09-03T00:05:00.000Z"), { timeZone: "UTC" }),
    ).toBe("3 Sep 2026, 00:05");
  });
});
