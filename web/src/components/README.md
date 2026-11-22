# UI components: conventions

Owner: Frontend. Applies to `src/components/` and the feature components
colocated under `src/app/**`.

## Layout

| Path                            | What                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ui/`                           | shadcn/ui primitives (`base-nova`, Base UI). Add with `npx shadcn add <name>`, then run `npm run format`. Don't fork them. |
| `shell/`                        | App shell: sidebar and mobile nav (`nav-config.ts` per role), user menu, theme.                                            |
| `forms/`                        | `ActionForm`, `SubmitButton`, `FormField` and the `*Field` wrappers.                                                       |
| `common/`                       | Page header, empty and not-found states, status badges, confirm dialog, credentials panel, label maps.                     |
| `employees/`                    | Domain components shared by several routes (e.g. `EmployeeDetails` for `/employees/[id]` and `/profile`).                  |
| `local-time.tsx`                | The **only** formatter for instants (`UtcTimestamp`).                                                                      |
| `calendar-date.tsx`             | Display for calendar dates (`IsoDate`).                                                                                    |
| `app/(app)/<route>/_components` | Components used by one route, including the ones that call server actions.                                                 |

Import rules (ADR-0002): components may import `@/contracts`, `@/lib/validation`
and other components. They never import `@/server/*`, `@/auth/*` (except
`auth/client.ts` for the sign-in form) or anything from `src/app`. Anything that
calls an action lives in `src/app/**`, which passes data down as props.

Server actions belong to Backend: they live in `web/src/server/actions/*.ts`
(`'use server'`, `defineAction`). Pages and route-level client components
import them from `@/server/actions`. Don't create `actions.ts` files in
`src/app` (director ruling).

## Tokens and theming

- Use semantic Tailwind tokens (`bg-background`, `text-muted-foreground`,
  `border`, `bg-primary`…). Don't use raw palette colours (`text-blue-600`).
- Status colours: `success`, `warning`, `info`, `destructive`. Use them as text
  on a tint of themselves (`bg-success/12 text-success`), or use `StatusPill`.
  Always pair colour with text.
- Light and dark values live in `app/globals.css`. Every pair is meant to meet
  WCAG AA. Check contrast when you add a token.
- Dark mode is the `dark` class on `<html>`. It is set before first paint by
  `THEME_INIT_SCRIPT`, and the user changes it in the user menu
  (light / dark / system).

## Dates (ADR-0007)

- Instants (`createdAt`, `decidedAt`, `terminatedAt`, notice dates) arrive as
  `UtcTimestamp` strings. Render them only with `<LocalTime value={…} />`. It
  shows a stable `d MMM yyyy, HH:mm UTC` fallback on the server and the first
  client render, then the viewer's local time, with the full timestamp and
  zone in `title`.
- Calendar dates (`YYYY-MM-DD`) use `<CalendarDate>` / `<CalendarDateRange>`.
  These are the UI standard: they show "22 Dec 2026", built from the string,
  never create a `Date` and never convert zones. ISO stays for exports and
  logs. Null renders "—" plus screen-reader text "Not recorded".

## Email display

Show the contact email (`employee.email`) whenever there is one, even if the
login account has `emailIsPlaceholder`. Show "No email on file" only when
there is no contact email. Never display a `@users.invalid` address.

## Forms

- Wrap every mutation form in `<ActionForm action={…} schema={…}>`.
  - `action` has the `useActionState` shape `(prev, formData) => ActionResult`.
    Actions from `defineAction` fit it directly.
  - `schema` is the matching schema from `@/lib/validation`. It runs on submit
    for inline errors, and the server check stays authoritative.
- Field `name`s equal the contract property names (`firstName`, `departmentId`).
  An update action also posts a hidden `id` (`{ id, ...fields }`).
- Use `TextField` / `SelectField` / `TextareaField` / `RadioGroupField`, or
  `FormField` with a render prop for anything else. These wrappers link the
  label, hint and error (`htmlFor`, `aria-describedby`, `aria-invalid`).
  Optional fields say "(optional)".
- After a failed submit, focus goes to the first invalid field, or to the
  form-level alert if no field is invalid. Errors stay inline.
- Success is a toast (sonner, ADR-0006 rule 4): pass `successMessage` to
  `ActionForm` or `ConfirmActionDialog`. The `<Toaster>` is mounted once in
  the root layout. Its live region announces the toast, and focus stays put.
- Destructive or irreversible actions go through `ConfirmActionDialog`. Errors
  show inside the dialog.
- One-time passwords go only in `CredentialsPanel`, from client state. Never put
  them in the URL, in storage or in logs.

## Pages

- One `<h1>` per page, via `PageHeader` (title, description, breadcrumbs,
  actions).
- Lists: `Card` + `Table` with an `sr-only` `<caption>` and `scope="col"`
  headers. Hide secondary columns below `md`/`lg` rather than scrolling the page.
  Use `EmptyState` when there are no rows.
- The `(app)` route group provides `loading.tsx`, `error.tsx` (generic message
  plus digest) and `not-found.tsx`. For unknown ids, use Backend's
  `orNotFound()` helper from `web/src/server`, which calls `notFound()`.
  - **Known behaviour (accepted):** because `loading.tsx` starts streaming
    first, a `notFound()` inside the shell returns HTTP **200** with the
    not-found UI, not 404 (e.g. `/employees/999`). Unmatched URLs still
    return 404.
- 403: `ForbiddenState` (`common/forbidden-state.tsx`) and the `/forbidden`
  page. We don't use the experimental `authInterrupts`/`forbidden()`, so a
  `requireRole` failure in a page redirects to `/forbidden`.
- Each page calls `requireRole`/`requireSession` itself with
  `{ onFail: "redirect" }` (layouts are not an auth boundary), then reads
  through `web/src/server/<area>/service.ts` with the session's actor.

## Accessibility checklist

Every input has a visible label. Everything works by keyboard (skip link, focus
rings, menus and dialogs from Base UI). No information is carried by colour
alone. Touch targets are at least about 36px. Layouts work at 375px. Animations
respect `prefers-reduced-motion`.
