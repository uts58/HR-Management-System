# ADR-0009: Legacy parity: definition of done

- Status: Accepted
- Date: 2026-11-17

## Context

"Parity" can't mean bug-for-bug: legacy has no role checks, plain-text passwords, and add/edit employee forms that probably don't work. We need a definition that is strict about features and explicit about changes.

## Decision

A feature (one row in `feature-map.md`) is **done** when all of these hold:

1. **Function:** every user-visible capability of the legacy route exists in the new app for the same role, reachable from the navigation. Data shown matches (same fields, same ordering unless contracts.md says otherwise).
2. **Intentional changes only:** any difference from legacy is listed in contracts.md under "Behaviour changes" (or the feature-map row) with a reason. Unlisted differences are bugs.
3. **Authorization:** the action/page calls `requireRole`. The authz-matrix row exists and passes.
4. **Validation:** the Zod schema covers every rule in contracts.md. Server-side rejection is tested.
5. **Tests:** service tests for the business rules, plus a Playwright journey for the feature-map row, are green in CI.
6. **UX baseline:** works at 375 px and desktop widths, keyboard-operable, form errors next to fields, success feedback, a confirmation before destructive actions.
7. **No legacy dependency:** no calls to the legacy app, no shared session.

**Launch** happens when every feature-map row is done and QA has run the legacy characterisation suite and the new E2E suite side by side with every difference explained by rule 2. The new app launches with an empty database (no legacy data is migrated); the first HR admin is created with `npm run create-admin`.

Out of scope for parity: the unused `Message` model (dropped), the commented-out menu items (recruitment, welfare, documents), and `routes/users.js` (never mounted).

## Consequences

- The feature-map is the progress tracker. QA reports status per row.
- Product changes beyond the listed ones need director approval and go into a later phase.
