"use client";

import { useSyncExternalStore } from "react";

import type { UtcTimestamp } from "@/contracts";

import { formatInstant } from "./date-format";

const noopSubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function utcFallback(date: Date, dateOnly: boolean) {
  return `${formatInstant(date, { timeZone: "UTC", dateOnly })} UTC`;
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
      <time dateTime={value} title={utcFallback(date, false)}>
        {utcFallback(date, dateOnly)}
      </time>
    );
  }

  const text = formatInstant(date, { dateOnly });
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
