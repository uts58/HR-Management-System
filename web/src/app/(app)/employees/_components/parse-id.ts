/** Parses a route id; anything but a positive integer means 404. */
export function parseId(raw: string): number | null {
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}
