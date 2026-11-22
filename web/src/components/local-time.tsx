"use client";

import { useSyncExternalStore } from "react";

import type { UtcTimestamp } from "@/contracts";

const noopSubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const pad = (n: number) => String(n).padStart(2, "0");

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

export function LocalTime({
  value,
  dateOnly = false,
}: {
  value: UtcTimestamp | null;
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
