# ADR-0006: Error handling and action result types

- Status: Accepted
- Date: 2026-11-17

## Context

Legacy handlers `console.error` and either redirect silently (a failed delete looks like success), send `500 Server error`, or pass messages in query strings (`?error=Passwords+do+not+match`).

## Decision

### Types (`web/src/contracts/common.ts`)

```ts
type ErrorCode = 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL';
interface AppError { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> }
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: AppError };
```

### Rules

1. **Services throw** `ServiceError` (`code`, user-safe `message`, optional `fieldErrors`). They never return `null` to mean "not found".
2. **Server actions never throw to the client.** Each one is wrapped in `runAction()` (Backend, `web/src/server/errors.ts`), which maps:
   | Thrown | Result |
   |---|---|
   | `ZodError` | `VALIDATION` + `fieldErrors` (from `z.flattenError`) |
   | `ServiceError` | its code/message/fieldErrors |
   | `AuthError` | `UNAUTHENTICATED` / `FORBIDDEN` |
   | Prisma unique violation (P2002) not already handled | `CONFLICT`. Services must handle the known ones themselves, so the user gets the field error. That includes the hand-written `lower(name)` indexes on department/position, whose violation may not name the field. |
   | Prisma record not found (P2025) | `NOT_FOUND` |
   | Prisma foreign-key violation (P2003) | **`INTERNAL`** globally (director ruling): an unexpected FK failure is a bug, not a user error. Delete services that can hit a `Restrict` FK (department/position still referenced) check first and also catch P2003 themselves, converting it to `CONFLICT` with a user-facing message. |
   | anything else | `INTERNAL`, message "Something went wrong. Please try again." The real error is logged server-side with a request id. |
3. `redirect()`/`notFound()` throw control-flow errors in Next.js. `runAction` must rethrow them (`unstable_rethrow` from `next/navigation`; Backend to confirm the current API name).
4. Forms read the result with `useActionState`: field errors next to inputs, `message` in a form-level alert. Success shows a toast (Frontend), replacing the legacy `?saved=1` banners.
5. **Pages** (Server Components) let errors bubble: `NOT_FOUND` → `notFound()`, everything else → the route's `error.tsx`. Pages call `requireRole(..., { onFail: 'redirect' })`.
6. Logging: structured JSON to stdout (Platform collects it). Never log passwords, temporary passwords or session tokens.

## Consequences

- One mapping function, so error UX is the same everywhere and easy to test.
- Silent failures from legacy (deleting a department that is in use, deciding a leave twice) become visible `CONFLICT` messages.
