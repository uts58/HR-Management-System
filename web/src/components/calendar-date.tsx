import type { IsoDate } from "@/contracts";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function NotRecorded() {
  return (
    <span>
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not recorded</span>
    </span>
  );
}

/**
 * A calendar date (`YYYY-MM-DD`: date of birth, leave and project dates).
 * It has no time zone, so it is NEVER converted: the label is built from
 * the string itself ("2026-12-22" → "22 Dec 2026") without creating a Date,
 * and renders identically on server and client. Null shows "—".
 */
export function CalendarDate({ value }: { value: IsoDate | string | null }) {
  if (!value) return <NotRecorded />;
  const match = ISO_DATE.exec(value);
  if (!match) return <span>{value}</span>;
  const [, year, month, day] = match;
  return (
    <time dateTime={value}>
      {Number(day)} {MONTHS[Number(month) - 1] ?? month} {year}
    </time>
  );
}

/** Inclusive range ("22 Dec 2026 – 31 Dec 2026"); a single day shows once. */
export function CalendarDateRange({
  start,
  end,
}: {
  start: IsoDate | null;
  end: IsoDate | null;
}) {
  if (start && start === end) return <CalendarDate value={start} />;
  return (
    <span className="whitespace-nowrap">
      <CalendarDate value={start} /> – <CalendarDate value={end} />
    </span>
  );
}
