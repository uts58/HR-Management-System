"use client";

import { useSyncExternalStore } from "react";

import type { UtcTimestamp } from "@/contracts";

const noopSubscribe = () => () => {};

/** false during SSR and the hydration render, true afterwards. */
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Stable fallback, identical on the server and the first client render
 * (ADR-0007 rule 3): "18 Nov 2026, 09:30 UTC". Built from UTC getters, so
 * it does not depend on the server's or browser's locale or zone.
 */
function utcFallback(date: Date, dateOnly: boolean) {
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return dateOnly
    ? `${day} UTC`
    : `${day}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

function NotRecorded() {
  return (
    <span>
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not recorded</span>
    </span>
  );
}

/**
 * The only UI formatter for instants (ADR-0007 rule 3): createdAt,
 * decidedAt, terminatedAt, notice dates…
 *
 * Takes a `UtcTimestamp` (ISO-8601 string ending in Z) and shows it in the
 * VIEWER'S browser time zone and locale. The server render and the
 * hydration render output the UTC fallback, then the text switches to local
 * time after mount, so there is no hydration mismatch. The element is a
 * semantic <time>; its `title` holds the full timestamp with the zone name.
 * Null renders "—".
 *
 * Never use this for calendar dates (DOB, leave and project dates): those
 * are `YYYY-MM-DD` values with no zone. Use <CalendarDate>.
 */
export function LocalTime({
  value,
  dateOnly = false,
}: {
  value: UtcTimestamp | null;
  /** Show only the date part (still the viewer's local date). */
  dateOnly?: boolean;
}) {
  const isClient = useIsClient();

  if (value === null) return <NotRecorded />;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <NotRecorded />;

  if (!isClient) {
    return (
      <time dateTime={value} title={`${utcFallback(date, false)}`}>
        {utcFallback(date, dateOnly)}
      </time>
    );
  }

  const text = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
  }).format(date);
  const full = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <time dateTime={value} title={`${full} (${zone})`}>
      {text}
    </time>
  );
}
