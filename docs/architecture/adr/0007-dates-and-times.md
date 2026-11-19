# ADR-0007: Date and time handling

- Status: Accepted (revised 2026-11-18)
- Date: 2026-11-17

> **Revision, 2026-11-18. User decision, reversing the earlier one.** The previous version of this ADR (director ruling of 2026-11-17) had a company time zone, `APP_TIME_ZONE`: timestamps were formatted on the server in that zone, and it defined the business day. The user overruled that. **There is no company time zone, and `APP_TIME_ZONE` is removed.** Timestamps are shown in each viewer's browser time zone. The rules below replace the earlier ones completely.

## Context

Legacy stores every date as a free-text `String`: leave dates typed as "YYYY-MM-DD" (unchecked), DOB from a date picker as "01 Jan 1990", notice dates from `new Date().toLocaleDateString()` (format depends on the server locale). None of them can be sorted or compared reliably.

## Decision

Two kinds of temporal value, never mixed:

| Kind | Examples | Postgres | Domain type | Wire | UI |
|---|---|---|---|---|---|
| **Calendar date** (no time, no zone) | date of birth, leave start/end, project start/end | `date` (`@db.Date`) | `IsoDate` (branded `YYYY-MM-DD` string) | `YYYY-MM-DD`, never converted | `<input type="date">` or the shadcn date picker, shown as written |
| **Instant** | notice createdAt, leave createdAt/decidedAt, employee createdAt/terminatedAt | `timestamptz`, stored in UTC | `UtcTimestamp`: an ISO-8601 UTC string ending in `Z`. Services convert Prisma's `Date` at the boundary; read models never carry `Date`. | Same string, e.g. `2026-11-18T09:30:00.000Z` | The viewer's browser time zone, via a client component (rule 3) |

Rules:

1. **Calendar dates are never converted.** `IsoDate` values never pass through a JS `Date` for display, comparison or arithmetic. Compare them as strings (lexical order = chronological order for `YYYY-MM-DD`). The only conversion is at the Prisma boundary, inside services: Prisma returns `@db.Date` as a UTC-midnight `Date`, which is read with the UTC getters. A leave from `2026-12-01` to `2026-12-03` reads the same for every viewer in every time zone.
2. **Instants are stored as UTC** (`timestamptz`; the DB session and the Node process also run in UTC). In every contract read model they are `UtcTimestamp` strings ending in `Z` (Backend ruling, 2026-11-18), produced by `toIsoInstant(date)` inside services. Using strings keeps read models JSON-safe across the server/client boundary.
3. **Instants are rendered in the viewer's browser time zone** by one client component (Frontend owns it, e.g. `components/local-time.tsx`):
   - It renders `<time dateTime="<ISO Z>">` and formats the value with `Intl.DateTimeFormat` using the browser's zone.
   - To avoid hydration mismatches, the server render and the first client render output the same **stable fallback**: the UTC value with an explicit "UTC" label (e.g. `18 Nov 2026, 09:30 UTC`). The component switches to local time after mount (`useEffect`), so the brief change is expected and there's no mismatch warning.
   - Nothing else formats instants for the UI. Server components pass the ISO string down.
   - Consequence the user accepted: two staff in different zones see different clock times for the same record. The `<time>` element carries the exact instant, and the UTC fallback/tooltip makes the conversion explicit.
4. **"Today" on the server**, where a rule needs it (DOB must be in the past; any future rule about leave dates), uses the **UTC calendar date with ±1 day tolerance**. Because the viewer's zone is unknown on the server:
   - "DOB must be before today" accepts `dateOfBirth <= todayUtc + 1 day`;
   - a "date must not be in the past" rule would accept `date >= todayUtc - 1 day`.

   That way no valid input is rejected in any zone, and an edge-day input accepted by the tolerance is harmless. Client-side form validation may use the browser's local date for a stricter, friendlier check. The server rule is authoritative.
5. Backend provides `web/src/lib/dates.ts`: `isIsoDate`, `toIsoDate(date)` (UTC getters, Prisma boundary only), `todayUtcIso()`, `addDaysIso(iso, n)`, `formatIsoDate(iso, locale)` (formats a calendar date without converting it), `toIsoInstant(date)` (always `Z`). The client time component lives in `components/` (Frontend) and is the only formatter for instants.
6. Display format for calendar dates: `d MMM yyyy` (e.g. `1 Jan 1990`), close to the legacy look, locale `en-GB` (configurable later). For instants: the same date format plus `HH:mm` in the viewer's locale settings.
7. **Logs and exports stay in UTC**, written as ISO-8601 with `Z`.
8. Leave ranges are inclusive. We do not compute business days or check overlaps (the legacy app does neither).
9. **Migration** (Data): parse legacy strings with an explicit list of formats (`YYYY-MM-DD`, `DD Mon YYYY`, `M/D/YYYY`, `D/M/YYYY`, with ambiguity reported). Unparseable values become `NULL` and go into a migration report for HR to fix. Contract read models allow `null` for that reason.

## Consequences

- There's no org-wide zone to configure. Platform removes `APP_TIME_ZONE` from `web/src/env.ts`, `.env.example`, compose files and CI.
- Timezone off-by-one bugs on birthdays and leave dates can't happen by construction, because calendar dates never touch a zone.
- Instant display depends on the client. Pages render a stable UTC fallback first, then local time, so there's no hydration error.
- Legacy rows with bad dates show up as "—" until HR corrects them.
