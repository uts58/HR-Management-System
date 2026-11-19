"use client";

import { useSyncExternalStore } from "react";

import type { Timestamp } from "@/contracts";

const noopSubscribe = () => () => {};

/** false during SSR and the hydration render, true afterwards. */
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Deterministic fallback, identical on server and first client render. */
function utcFallback(date: Date, withTime: boolean) {
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return withTime
    ? `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
    : day;
}

/**
 * A point in time (createdAt, decidedAt, notice dates…) shown in the
 * VIEWER'S browser time zone and locale.
 *
 * Timestamps arrive as UTC ISO-8601 strings (a Date is accepted too). The
 * server and the hydration render output a stable UTC fallback, so there is
 * no hydration mismatch; after mount the text switches to the local format.
 * The element is a semantic <time> whose `title` holds the full timestamp
 * with the zone name. Null (migrated rows) renders "—".
 *
 * Never use this for calendar dates (DOB, leave and project dates): those
 * are `YYYY-MM-DD` values with no zone. Use <CalendarDate> instead.
 */
export function LocalTime({
  value,
  dateOnly = false,
}: {
  value: Timestamp | string | null;
  /** Show only the local date part (still converted to the local zone). */
  dateOnly?: boolean;
}) {
  const isClient = useIsClient();

  if (value === null) {
    return (
      <span>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not recorded</span>
      </span>
    );
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return <span>—</span>;
  const iso = date.toISOString();

  if (!isClient) {
    return (
      <time dateTime={iso} title={iso}>
        {utcFallback(date, !dateOnly)}
      </time>
    );
  }

  const text = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(dateOnly ? {} : { timeStyle: "short" }),
  }).format(date);
  const full = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <time dateTime={iso} title={`${full} (${zone})`}>
      {text}
    </time>
  );
}
