import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLegacyDate } from "../src/dates.js";

const ok = (raw: unknown, value: string, opts = {}) => {
  const r = parseLegacyDate(raw, opts);
  assert.equal(r.kind, "ok", `${String(raw)} -> ${JSON.stringify(r)}`);
  if (r.kind === "ok") assert.equal(r.value, value, String(raw));
  return r;
};
const bad = (raw: unknown) => assert.equal(parseLegacyDate(raw).kind, "invalid", String(raw));

test("legacy formats", () => {
  ok("01 Jan 1990", "1990-01-01"); // date-picker / seed format
  ok("1 jan 2019", "2019-01-01");
  ok("15-Mar-2020", "2020-03-15");
  ok("2024-02-29", "2024-02-29"); // placeholder YYYY-MM-DD
  ok("2024-2-9", "2024-02-09");
  ok("2024/02/09", "2024-02-09");
  ok("11/17/2026", "2026-11-17"); // en-US toLocaleDateString
  ok("January 5, 2021", "2021-01-05");
  ok("Tue Jan 05 2021", "2021-01-05"); // Date.toDateString
  ok("20210105", "2021-01-05");
  ok("  2021-01-05  ", "2021-01-05");
});

test("empty values", () => {
  for (const v of [null, undefined, "", "   ", "0", "null", "N/A", "-"]) assert.equal(parseLegacyDate(v).kind, "empty", String(v));
});

test("ambiguity and inference", () => {
  assert.equal(ok("03/04/2020", "2020-03-04").note, "ambiguous-day-month");
  assert.equal(ok("03/04/2020", "2020-04-03", { slashOrder: "DMY" }).note, "ambiguous-day-month");
  assert.equal(ok("17/11/2026", "2026-11-17").note, "day-month-order-inferred"); // en-GB under MDY
  assert.equal(ok("05/05/2020", "2020-05-05").note, undefined); // same either way
  ok("17.11.2026", "2026-11-17"); // dot = day first
  assert.equal(ok("2020-01-01T23:00:00Z", "2020-01-01").note, "time-component-dropped");
  ok("11/17/2026, 10:00:00 AM", "2026-11-17");
});

test("rejects invalid values without throwing", () => {
  bad("2023-02-29"); // not a leap year
  bad("31/31/2020");
  bad("13/13/2020");
  bad("1/2/20"); // two-digit year
  bad("next tuesday");
  bad("01 Foo 2020");
  bad("1850-01-01"); // out of range
  bad("2020-13-01");
});
