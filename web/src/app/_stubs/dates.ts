/**
 * STUB helpers for building fixture values with the contract types.
 * Display formatting does NOT live here: instants use <LocalTime>
 * (viewer's zone) and calendar dates use <CalendarDate> (never converted).
 */

import type { IsoDate, UtcTimestamp } from "@/contracts";

/** Brand a `YYYY-MM-DD` literal as a calendar date. */
export const iso = (value: string) => value as IsoDate;

/** A UtcTimestamp (ISO-8601, ms precision, ending in Z) from a literal. */
export const at = (value: string): UtcTimestamp =>
  new Date(value).toISOString() as UtcTimestamp;
