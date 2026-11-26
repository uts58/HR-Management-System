# Design spec: CSV import and full data export (B2)

Status: draft for PM scope review, then frontend feasibility sign-off.
Roadmap: `pm-roadmap.md` §4.0 B2, §5.2. Assumes B5 fields (hire date,
employment type, employee number) land first or with this work.

## 1. Problem, users, jobs

A fresh install has one CLI-created admin and no data. HR moving from a
spreadsheet or another HR tool has to add every person through a ~15-field
form. There is also no way to get data out, which contradicts the "own your
data" promise.

| User | Job | Success looks like |
|---|---|---|
| HR admin, first week | "Get my 20–300 people, departments and positions in today." | One file, one pass, errors fixed in the spreadsheet, not one by one. |
| HR admin, ongoing | "Add this month's 8 starters from the recruiter's sheet." | Existing people are not duplicated or overwritten by accident. |
| HR admin, leaving or auditing | "Give me everything, in a format another tool can read." | One download with employees, org and leave history. |

Out of reach for this spec: employees (`EMPLOYEE` role) never see import or
export. Appraisals and notices are not imported (PM to confirm, Q6).

## 2. Entry points

- `/employees` PageHeader actions: `Add employee` (primary, existing) and
  `Import` (outline) linking to `/employees/import`.
- Empty employee list: the `EmptyState` action offers both (see W0).
- Nav: one new HR item, **Import and export** (`/data`), in the Employees group.
  `/data` holds the import launcher and the export card (W9).

## 3. Import flow

Five steps, shown as "Step N of 5" text plus a step list. Nothing is written
to the database until step 5. Every step has Back, and Cancel returns to
`/data` without changes.

1. **Upload.** Choose what to import (Employees, Leave history) and a file.
   Download a template. Org rows come from the employee file (Department,
   Position columns), so there is no separate org import.
2. **Map columns.** Auto-match headers to fields by name and common aliases
   (`Surname` → Last name, `Dept` → Department). HR fixes the rest. Required
   fields that are unmapped block Next.
3. **Review (dry run).** The server validates every row against the same rules
   as the form and reports counts plus row-level errors. This is the dry run:
   it writes nothing. HR picks how to handle duplicates and unknown org names.
4. **Confirm.** A summary of what will happen, in a `ConfirmActionDialog`.
5. **Result.** What was created, updated and skipped, an error report to
   download, and (if accounts were created) the credentials hand-over.

### Rules

- **All-or-nothing commit by default.** Rows with errors are excluded only if
  HR ticks "Import the valid rows and skip rows with errors". Otherwise Next is
  disabled until the error count is 0. This avoids silent partial imports.
- **Duplicate detection** (employees): match on employee number first, then
  email (case-insensitive), then username. Name-only matches are flagged as
  "possible duplicate" warnings, never auto-merged.
- **Duplicate handling** (one choice for the whole file): `Skip existing`
  (default) or `Update existing` (only mapped, non-empty cells overwrite;
  blank cells never erase data). There is no delete.
- **Unknown department or position:** one choice: `Create them` (default; the
  new names are listed in the review) or `Treat as errors`. Matching is
  case-insensitive and trims spaces, as the DB unique index does.
- **Usernames:** blank username → generated `first.last`, then `first.last2`
  etc. An explicit username that is taken or invalid is a row error, never
  silently renamed.
- **No email:** allowed on import (the DB field is optional; PM to confirm,
  Q2). The row shows "No email on file"; any login gets the placeholder address
  internally, which is never displayed.
- **Leave history import** keys each row to an employee by employee number or
  username. Status may be Approved, Rejected or Pending; imported decisions
  record the importing admin as decider (Q5).
- **Re-run safety:** the dry run token expires after 30 minutes or if data
  changes; commit then re-validates and returns to step 3 with a notice.

## 4. Fields

Employee template columns, in order. "Req" follows the current form; Q3 asks
the PM to relax it for imports.

| Column header | Field | Req | Format / allowed values |
|---|---|---|---|
| Employee number | `employeeNumber` (B5) | Q3 | Text, unique |
| First name | `firstName` | Yes | ≤100 |
| Middle name | `middleName` | No | ≤100 |
| Last name | `lastName` | Yes | ≤100 |
| Email | `email` | Q2 | Valid email, ≤254 |
| Contact number | `contactNo` | Q3 | 5–20, digits, spaces, `+ - ( )` |
| Date of birth | `dateOfBirth` | Q3 | `YYYY-MM-DD`, in the past |
| Gender | `gender` | Q3 | Values from B5 (labels or codes) |
| Marital status | `maritalStatus` | Q3 | Single, Married, Divorced |
| Country | `country` | Q3 | Name from the country list |
| Home town | `homeTown` | Q3 | ≤100 |
| Department | `department` | Yes | Name |
| Position | `position` | Yes | Name |
| Hire date | `hireDate` (B5) | Q3 | `YYYY-MM-DD` |
| Employment type | `employmentType` (B5) | Q3 | Values from B5 |
| Username | `username` | No | 3–30, `a-z 0-9 . _` |
| Status | `employmentStatus` | No | Active (default), Terminated |

Leave template: Employee number or Username, Leave type (Sick, Annual, Casual,
Maternity, Unpaid), Start date, End date, Reason, Status.

Enum cells accept the label or the code, case-insensitive. Dates also accept
`DD/MM/YYYY` only if HR picks that in step 2 ("Date format" select), because
`03/04/2026` is ambiguous.

## 5. Wireframes

Desktop at ≥`md`. Mobile notes in §7.

### W0. Employees, empty

```
+--------------------------------------------------------------+
| Employees                               [Import] [Add employee]|
+--------------------------------------------------------------+
|                    (users icon)                              |
|                 No employees yet                             |
|   Add people one at a time, or import a spreadsheet.         |
|        [Import from CSV]   [Add employee]                    |
+--------------------------------------------------------------+
```

### W1. Step 1, upload

```
Import and export > Import
Import data                                     Step 1 of 5
(1 Upload)  2 Map  3 Review  4 Confirm  5 Result
+--------------------------------------------------------------+
| What are you importing?                                      |
|  (o) Employees, with their departments and positions         |
|  ( ) Leave history (import employees first)                  |
|                                                              |
| CSV file                                                     |
| +----------------------------------------------------------+ |
| |  Drag a .csv file here, or  [Choose file]                | |
| |  UTF-8, up to 5 MB and 5,000 rows.                       | |
| +----------------------------------------------------------+ |
| Need a starting point? Download the template (CSV)           |
|                                                              |
| [Next: map columns]   [Cancel]                               |
+--------------------------------------------------------------+
```

W1a, file chosen: the drop zone shows `staff.csv · 214 rows · 38 KB [Remove]`.
W1b, file error: inline error under the file field (copy in §6), Next disabled.

### W2. Step 2, map columns

```
Map columns                                     Step 2 of 5
We matched 12 of 14 columns. Check the rest.
+--------------------------------------------------------------+
| Column in your file   Sample value       Import as           |
|--------------------------------------------------------------|
| Given name            Ayesha             [First name      v] |
| Surname               Rahman             [Last name       v] |
| Dept                  Finance            [Department      v] |
| Start                 2024-02-01         [Hire date       v] |
| Notes                 likes tea          [Don't import    v] |
| Phone ext             204                [Choose a field  v] |  <- needs a choice
+--------------------------------------------------------------+
| Date format   [YYYY-MM-DD v]                                 |
| ! Required field not mapped: Position                        |
| [Back] [Next: check data]                                    |
+--------------------------------------------------------------+
```

Each field can be chosen once; a chosen field shows "(used by Surname)" in
other selects. "Don't import" is always available.

### W3. Step 3, review (dry run)

```
Check your data                                 Step 3 of 5
Nothing has been saved yet.
+--------------+--------------+--------------+---------------+
| 190 new      | 12 existing  | 9 errors     | 3 warnings    |
+--------------+--------------+--------------+---------------+
| New departments and positions (4)                          |
|  Departments: Logistics, Legal   Positions: Driver, Paralegal|
|  (o) Create them   ( ) Treat as errors                     |
| People who already exist (12)                              |
|  (o) Skip them     ( ) Update them with values from the file|
+--------------------------------------------------------------+
| Show: [Errors (9) v]                      Download error report|
| Row  Name             Problem                                |
|  14  Ken Ito          Email: Enter a valid email address     |
|  27  Mia Diaz         Username "mia.diaz" is already taken   |
|  31  (blank)          First name is required                 |
|  ...                                                        |
| Showing 1-9 of 9                     [Previous] [Next]       |
+--------------------------------------------------------------+
| [ ] Import the valid rows and skip rows with errors          |
| [Back] [Re-upload fixed file] [Next: confirm]                |
+--------------------------------------------------------------+
```

"Show" filters: Errors, Warnings, New, Existing, All. Each row expands to list
every problem for that row, not only the first. The count tiles are text, with
colour as a secondary cue.

W3a, no problems: tiles show `0 errors`, the table defaults to "New", and a
success line reads "All 214 rows are ready to import."

### W4. Step 4, confirm (ConfirmActionDialog)

```
+------------------------------------------+
| Import 202 employees?                    |
| This will:                               |
|  - add 190 employees                     |
|  - update 12 existing employees          |
|  - create 2 departments and 2 positions  |
|  - create 190 login accounts (Q1)        |
|  - skip 9 rows with errors               |
| You can't undo an import.                |
|            [Cancel] [Import 202 employees]|
+------------------------------------------+
```

### W5. Importing (in progress)

```
Importing…                                      Step 5 of 5
[=============>               ] 96 of 202 rows
Keep this page open. This usually takes under a minute.
```

### W6. Step 5, result

```
Import complete                                 Step 5 of 5
+--------------------------------------------------------------+
| (check) 190 added · 12 updated · 9 skipped                   |
| Created: departments Logistics, Legal; positions Driver,     |
| Paralegal.                                                   |
| [Download skipped rows (CSV)]                                |
+--------------------------------------------------------------+
| Temporary logins (190)                         (warning panel)|
| These passwords are shown only once. Download them now and   |
| hand them over securely. Employees must change them at first |
| sign-in.                                                     |
| [Download logins (CSV)]                                      |
+--------------------------------------------------------------+
| [View employees] [Import another file]                       |
```

The logins section is shown only if Q1 resolves to "create accounts". The
skipped-rows file is the original rows plus an `Error` column, ready to fix
and re-import.

### W7. Partial failure during commit

```
+--------------------------------------------------------------+
| (alert, destructive) The import stopped at row 140.          |
| No changes were saved. Try again; if it keeps failing,       |
| quote reference 7f3a2c to your administrator.                |
| [Try again] [Back to review]                                 |
+--------------------------------------------------------------+
```

The commit is one transaction, so "partial" means nothing saved. If Backend
must batch, this copy changes to list what was saved (Q4).

### W8. No permission

Non-HR users hitting `/data` or `/employees/import` get the existing
`/forbidden` page (`ForbiddenState`). No new screen.

### W9. Export (`/data`)

```
Import and export
+------------------------------+  +---------------------------------+
| Import                       |  | Export                          |
| Add employees or leave       |  | Download a copy of your data.   |
| history from a CSV file.     |  | Format  (o) CSV (ZIP)  ( ) JSON |
| [Start import]               |  | Include [x] Employees           |
| Templates: Employees · Leave |  |         [x] Departments, positions|
+------------------------------+  |         [x] Leave history       |
                                  |         [ ] Terminated employees|
                                  | [Download export]               |
                                  | Last export: 26 Nov 2026, 14:02 |
                                  +---------------------------------+
```

- CSV export is a ZIP with one file per entity, using the import template
  headers so an export can be re-imported. JSON is one file with the same
  entities.
- Never exported: password hashes, sessions, placeholder `@users.invalid`
  emails (written as blank). Usernames are included.
- Dates are ISO (`YYYY-MM-DD`, instants in UTC ISO 8601).
- Filename: `hr-export-2026-11-26.zip` / `.json`.
- Button shows "Preparing…" while pending; a toast confirms "Export ready".

## 6. Copy

### Labels and actions

| Key | Copy |
|---|---|
| Page title | Import data |
| Step list | Upload · Map columns · Check data · Confirm · Result |
| Type radio | Employees, with their departments and positions / Leave history (import employees first) |
| File hint | UTF-8, up to 5 MB and 5,000 rows. |
| Template link | Download the template (CSV) |
| Map intro | We matched {n} of {total} columns. Check the rest. |
| Skip option | Don't import |
| Review intro | Nothing has been saved yet. |
| Org choice | Create them / Treat as errors |
| Duplicate choice | Skip them / Update them with values from the file |
| Update hint | Empty cells in your file never erase existing data. |
| Partial opt-in | Import the valid rows and skip rows with errors |
| Confirm button | Import {n} employees |
| Result title | Import complete |
| Export title / button | Export / Download export |

### Errors

| Case | Where | Copy |
|---|---|---|
| No file | File field | Choose a CSV file to import. |
| Not CSV | File field | This file isn't a CSV. In your spreadsheet, use Save as > CSV UTF-8. |
| Empty file | File field | This file has no rows. Add data under the header row and try again. |
| Header only | File field | We found the column headers but no data rows. |
| Wrong encoding | File field | Some characters couldn't be read. Save the file as CSV UTF-8 and upload it again. |
| Too big | File field | This file is over 5 MB or 5,000 rows. Split it into smaller files. |
| Duplicate headers | Map step | Two columns are called "{name}". Rename one in your file. |
| Required unmapped | Map step | Required field not mapped: {fields} |
| Field invalid | Review row | {Field}: {same message as the employee form} |
| Username taken | Review row | Username "{u}" is already taken. |
| Username repeated | Review row | Username "{u}" is used on rows {a} and {b}. |
| Duplicate in file | Review row | Same {employee number/email} as row {n}. |
| Unknown org (reject) | Review row | Department "{name}" doesn't exist. |
| Leave: no employee | Review row | No employee with number or username "{v}". |
| Leave: dates | Review row | End date must be on or after start date. |
| Possible duplicate | Review warning | Same name as an existing employee ({name}). Check this isn't the same person. |
| Stale dry run | Review alert | Data changed since you checked this file. We checked it again. |
| Commit failed | Result alert | The import stopped at row {n}. No changes were saved. … reference {digest}. |
| Export failed | Export card | The export couldn't be prepared. Try again. |

### Empty and success states

| State | Copy |
|---|---|
| Employees empty | No employees yet. Add people one at a time, or import a spreadsheet. |
| Review, no problems | All {n} rows are ready to import. |
| Review, nothing new | Every row matches an existing employee. Choose "Update them" or upload a different file. |
| Export, nothing to export | There's no data to export yet. (Button disabled.) |

## 7. Edge cases

| Case | Behaviour |
|---|---|
| Empty or header-only file | W1b error, stays on step 1. |
| Wrong encoding | Detect UTF-8 BOM and UTF-8; anything else (or replacement chars) → encoding error. Excel "CSV UTF-8" and Google Sheets work. Semicolon delimiters are auto-detected. |
| Huge file | Client checks size before upload; server enforces row cap. Review table is paginated (25 rows); counts cover the whole file. |
| Unknown department or position | Per-file choice in W3. New names listed before commit. |
| Username clash | With existing user or another row → row error, never renamed. Generated usernames get a numeric suffix. |
| No email | Allowed (Q2); no warning. Placeholder email never shown. |
| Same person twice in the file | Row error on the later row. |
| Partial failure | All-or-nothing commit (W7). Skipping bad rows is an explicit opt-in in W3. |
| Two admins importing at once | Stale dry run detection (§3) re-checks before commit. |
| Leaving mid-wizard | State is lost; browser `beforeunload` warning only while W5 is running. |
| Permission denied | `/forbidden` (W8). Server actions re-check role. |
| Mobile (375px) | Supported, not optimised. Step list collapses to "Step 2 of 5: Map columns". Mapping table becomes stacked cards (column name, sample, select). Review table shows Row + Problem; name moves under the problem. Drop zone becomes a plain file button. Buttons stack full width. |

## 8. Accessibility acceptance criteria

1. One `<h1>` ("Import data"); each step has an `<h2>` that receives focus when
   the step changes, and the document title includes "Step N of 5".
2. The step list is an `<ol>` with the current step marked
   `aria-current="step"`; completed and upcoming are stated in text, not only
   colour.
3. The file control is a real `<input type="file" accept=".csv,text/csv">`
   with a visible label; the drop zone is an enhancement, and keyboard users
   reach the same input. File errors are linked with `aria-describedby` and
   focus moves to the field.
4. Each mapping select has an accessible name that includes the source column
   ("Import 'Surname' as").
5. The review table has an `sr-only` caption with the current filter and
   counts, `scope="col"` headers, and row numbers that match the file's line
   numbers (header = row 1).
6. Count tiles and status chips always show text; colour is secondary.
7. Validation results, filter changes and import progress are announced
   through a polite live region; progress updates at most every 10%.
8. Confirm uses `ConfirmActionDialog` (focus trap, Escape cancels, focus
   returns to trigger).
9. Result page focuses its `<h2>`; the credentials section reuses
   `CredentialsPanel` styling and wording.
10. All of it works at 375px with no horizontal page scroll (the review table
    may scroll inside its card) and touch targets ≥36px.
11. Downloads are buttons with explicit file type in the label.

## 9. Component mapping (for the frontend lead)

| Wireframe | Existing components | New |
|---|---|---|
| W0 | `PageHeader`, `EmptyState`, `ButtonLink` | – |
| W1 | `PageHeader`, `Card`, `RadioGroupField`, `FormField`, `Button` | **FileField** (file input + drop zone, size check); **Stepper** (step list pattern) |
| W2 | `Card`, `Table`, `NativeSelect` via `SelectField`, `Alert` | Stepper |
| W3 | `Card`, `Table`, `RadioGroupField`, `Badge`/`StatusPill`, `Alert`, `Button` | **Checkbox** (no `ui/checkbox` yet; `npx shadcn add checkbox`); **Pagination** (shared with U5 list work); **StatTile** (count tiles, could be `Card` variant) |
| W4 | `ConfirmActionDialog` | – |
| W5 | `Card` | **Progress** (`npx shadcn add progress`) |
| W6 | `Alert`, `Button`, `CredentialsPanel` copy and styling | **BulkCredentialsPanel** (download-only variant of `CredentialsPanel`) |
| W7 | `Alert` (destructive), error digest pattern from `(app)/error.tsx` | – |
| W8 | `/forbidden`, `ForbiddenState` | – |
| W9 | `PageHeader`, `Card`, `RadioGroupField`, `LocalTime`, `Button`, toast | Checkbox |

Mobile card list for W2/W3 should be the same pattern the IA cleanup (U5, U11)
needs; worth building once.

## 10. Open questions for the PM

1. **Accounts and credentials.** Does importing an employee also create a login
   account? If yes, how are 190 temporary passwords handed over: a one-time
   CSV download (W6, needs a Security decision), per-employee "Issue login"
   later, or B6 email where real addresses exist? Or no accounts on import at
   all, with a bulk "Create logins" step afterwards?
2. **Email.** The form requires email but the DB does not. Can imported
   employees have no email (frontline staff)?
3. **Required fields for import.** Today's form requires contact number, date of
   birth, gender, marital status, country and home town. Most source files lack
   some of these. Propose: required = first name, last name, department,
   position, plus employee number and hire date once B5 lands. Agree?
4. **Commit model.** All-or-nothing plus opt-in "skip bad rows" (this spec), or
   commit valid rows always? Backend to confirm one transaction fits 5,000 rows.
5. **Leave import.** In scope for launch? Should imported Approved/Rejected
   leave record the importing admin as decider, or "Imported"?
6. **Scope of export.** Include appraisals and notices in the "full" export
   (this spec says employees, org, leave per B2)? Should B3 audit log record
   each import and export?
7. **Limits.** Are 5 MB / 5,000 rows the right caps for the target customers?
