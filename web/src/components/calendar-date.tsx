import type { IsoDate } from "@/contracts";

import { formatCalendarDate } from "./date-format";

function NotRecorded() {
  return (
    <span>
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not recorded</span>
    </span>
  );
}

export function CalendarDate({ value }: { value: IsoDate | string | null }) {
  if (!value) return <NotRecorded />;
  const text = formatCalendarDate(value);
  if (text === null) return <span>{value}</span>;
  return <time dateTime={value}>{text}</time>;
}

export function CalendarDateRange({
  start,
  end,
}: {
  start: IsoDate | null;
  end: IsoDate | null;
}) {
  if (start && start === end) return <CalendarDate value={start} />;
  return (
    <span className="whitespace-normal">
      <span className="whitespace-nowrap">
        <CalendarDate value={start} /> –
      </span>{" "}
      <span className="whitespace-nowrap">
        <CalendarDate value={end} />
      </span>
    </span>
  );
}
