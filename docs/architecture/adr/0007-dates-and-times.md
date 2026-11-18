# ADR-0007: Date and time handling

- Status: Accepted
- Date: 2026-11-17

## Context

Legacy stores every date as a free-text `String`: leave dates typed as "YYYY-MM-DD" (unchecked), DOB from a date picker as "01 Jan 1990", notice dates from `new Date().toLocaleDateString()` (format depends on the server locale). None of them can be sorted or compared reliably.

## Decision

Two kinds of temporal value, never mixed:

| Kind | Examples | Postgres | Domain type | Wire/UI |
|---|---|---|---|---|
| **Calendar date** (no time, no zone) | date of birth, leave start/end, project start/end | `date` (`@db.Date`) | `IsoDate` (branded `YYYY-MM-DD` string) | `<input type="date">` or the shadcn date picker, sent as `YYYY-MM-DD` |
| **Instant** | notice createdAt, leave createdAt/decidedAt, employee createdAt | `timestamptz` (UTC) | `Date` | Formatted on the server in `APP_TIME_ZONE` (the company zone) |

Rules:

1. `IsoDate` values are never turned into a JS `Date` for display or comparison. Compare them as strings (lexical order = chronological order for `YYYY-MM-DD`). Convert at the Prisma boundary only, inside services (Prisma returns `@db.Date` as a UTC-midnight `Date`; read it with the UTC getters).
2. Backend provides `web/src/lib/dates.ts`: `isIsoDate`, `toIsoDate(date)`, `todayIso(tz)`, `formatIsoDate(iso, locale)`, `formatInstant(date, tz, locale)` (always called with `env.APP_TIME_ZONE`, on the server). Nothing else formats dates.
3. **The database stores UTC** (`timestamptz`; the DB session and Node process also run in UTC).
   - **`APP_TIME_ZONE` is required, with no default** (director ruling). It must be a valid IANA zone, and `env.ts` refuses to boot without it. It is the **company zone**, used for two things:
     - **The business day:** "today" (DOB must be before today; any rule about past or future leave) and the boundary when an instant becomes a calendar date. Always use `todayIso(env.APP_TIME_ZONE)`, never `new Date()` plus local getters.
     - **Displaying every timestamp in the UI** (createdAt, decidedAt, terminatedAt, …). Formatting happens on the server in `APP_TIME_ZONE`, so every staff member sees the same time on the same record, and there's no client-side conversion or hydration mismatch.
   - Logs and exports stay in UTC, written as ISO-8601 with an explicit `Z` or offset.
4. Display format: `d MMM yyyy` (e.g. `1 Jan 1990`), close to the legacy look, through `Intl.DateTimeFormat` with locale `en-GB` (configurable later).
5. Leave ranges are inclusive. We do not compute business days or check overlaps (the legacy app does neither).
6. **Migration** (Data): parse legacy strings with an explicit list of formats (`YYYY-MM-DD`, `DD Mon YYYY`, `M/D/YYYY`, `D/M/YYYY`, with ambiguity reported). Unparseable values become `NULL` and go into a migration report for HR to fix. Contract read models allow `null` for that reason.

## Consequences

- Timezone off-by-one bugs on birthdays and leave dates can't happen by construction.
- Legacy rows with bad dates show up as "—" until HR corrects them.
