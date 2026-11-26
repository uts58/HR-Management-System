const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

const dayMonthYear = (day: number, month: number, year: number | string) =>
  `${day} ${MONTHS[month - 1] ?? month} ${year}`;

export function formatCalendarDate(iso: string): string | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [, year, month, day] = match;
  return dayMonthYear(Number(day), Number(month), year as string);
}

export function formatInstant(
  date: Date,
  {
    timeZone,
    dateOnly = false,
  }: { timeZone?: string; dateOnly?: boolean } = {},
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const day = dayMonthYear(get("day"), get("month"), get("year"));
  return dateOnly ? day : `${day}, ${pad(get("hour"))}:${pad(get("minute"))}`;
}
