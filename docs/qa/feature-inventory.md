# Legacy HR Management System: Feature Inventory

Status: Phase 0 baseline, written from a full read of the legacy code and checked against a running instance (Postgres 16, seeded).
Scope: everything a user can see or trigger in the legacy app at the repo root (`app.js`, `routes/index.js`, `routes/hr.js`, `views/*.ejs`, `public/js/*`).
Purpose: this is the functional spec for the Next.js rewrite. A feature is done in `web/` when the matching tests in `legacy-tests/` pass there (see `test-strategy.md`).

Line references are to the legacy code at commit `4f8c6bc`. The Security lead is patching the legacy app in parallel, so line numbers in `routes/` will drift; the behaviour described here is the pre-patch baseline.

## 1. Roles and session model

| Role | How it is identified | Seed account |
|---|---|---|
| Anonymous | no `req.session.name` | none |
| HR (admin) | `person.access = 1` | `admin` / `admin123` (person id `1`, employee id 1) |
| Employee | `person.access = 0` | `john` / `emp123` (person id `2`, employee id 2) |

- The README mentions a separate "Admin" role above HR. It does not exist in the code: there is one privileged level (`access = 1`).
- A login is a `person` row (`id` string, `Name`, `password`, `access`). Profile data is in `employee`, joined only by convention: `employee.id` (int) equals `person.id` (string). There are no foreign keys anywhere in the schema (`prisma/schema.prisma`).
- The session stores `idno` (person id), `name` (the username **as typed** at login), and `access` (`routes/index.js:57-59`).
- **The only server-side guard is "is logged in"** (`if (!req.session.name)`). Nothing checks `access`. The HR-vs-employee difference exists only in which menu is rendered. See SEC-01.
- The menu is chosen per view by a `title` variable (`'hr'` or `'emp'`) and rendered by `views/menu.ejs` (or inline in `welcome.ejs`, `addEmployee.ejs`, `viewEmployee.ejs`). Some routes hard-code it regardless of role (see Leave: HR visiting `/addLeave` gets the employee menu).

### Route map (33 routes)

`routes/users.js` exists but is never mounted. Client JS references `/actChangePass`, which does not exist (dead code in `public/js/ajax.js:25-42`).

| # | Method | Path | File:line | Intended role | Actual guard |
|---|---|---|---|---|---|
| 1 | GET | `/` | index.js:5 | anonymous | none |
| 2 | GET | `/home` | index.js:15 | any user | login |
| 3 | POST | `/actAdmin` | index.js:50 | anonymous | none |
| 4 | GET | `/logout` | index.js:70 | any user | none |
| 5 | GET | `/addNotice` | index.js:77 | HR | login |
| 6 | POST | `/saveNotice` | index.js:94 | HR | login |
| 7 | GET | `/deleteNotice?id=` | index.js:113 | HR | login |
| 8 | GET | `/displayLeave` | index.js:127 | HR | login |
| 9 | GET | `/assignLeave?id=&status=` | index.js:147 | HR | login |
| 10 | GET | `/viewLeavebyAdmin` | index.js:160 | HR | login |
| 11 | GET | `/addPerformance` | index.js:182 | HR | login |
| 12 | POST | `/savePerformance` | index.js:202 | HR | login |
| 13 | GET | `/viewPerformance` | index.js:222 | HR | login |
| 14 | GET | `/deletePerformance?id=` | index.js:242 | HR | login |
| 15 | GET | `/changePassword` | index.js:256 | any user | login |
| 16 | POST | `/savePassword` | index.js:267 | any user | login |
| 17 | GET | `/addLeave` | index.js:291 | employee | login |
| 18 | POST | `/saveLeave` | index.js:301 | employee | login |
| 19 | GET | `/viewLeave` | index.js:323 | employee | login |
| 20 | GET | `/hr/addEmployee` | hr.js:14 | HR | login |
| 21 | GET | `/hr/editEmployee?id=` | hr.js:39 | HR | login |
| 22 | GET | `/hr/viewDetails?id=` | hr.js:64 | HR | login |
| 23 | GET | `/hr/viewProfile` | hr.js:89 | employee | login |
| 24 | GET | `/hr/viewEmployee` | hr.js:112 | HR | login |
| 25 | GET | `/hr/deleteEmployee?id=` | hr.js:133 | HR | login |
| 26 | POST | `/hr/editEmp` | hr.js:148 | HR | login |
| 27 | POST | `/hr/saveEmp` | hr.js:196 | HR | login |
| 28 | GET | `/hr/addDep` | hr.js:266 | HR | login |
| 29 | POST | `/hr/saveDep` | hr.js:284 | HR | login |
| 30 | GET | `/hr/deleteDep?id=` | hr.js:297 | HR | login |
| 31 | GET | `/hr/addPos` | hr.js:311 | HR | login |
| 32 | POST | `/hr/savePos` | hr.js:329 | HR | login |
| 33 | GET | `/hr/deletePos?id=` | hr.js:342 | HR | login |

No 404 or error handler is registered (`app.js`); unknown paths get Express's default `Cannot GET /x`, and template crashes are caught per route and return a bare `500 Server error`.

---

## 2. Authentication

### 2.1 Login page (`GET /`, `views/index.ejs`)
- **Role:** anonymous (also reachable when logged in; it does not redirect to `/home`).
- **UI:** "User Login" box with Username, Password, Submit and Reset buttons; "About Us" blurb; "Recent Notices" panel.
- **Recent Notices (public):** shows only notices of type **Urgent** (`type == 1`), newest 5 by table order, title only; clicking a title expands the body and date (jQuery accordion). General and Holiday notices are not shown here (`index.ejs:71-95`).
- **Quirks:**
  - Pressing Enter in the password field triggers Submit (`searchKeyPress`, `functions.js:103`). Enter in the username field does nothing.
  - The page loads `http://ajax.googleapis.com/.../jquery/1.3.1` and `../calender/*` files that do not exist. The inline `$($.date_input.initialize)` throws on every page load. Harmless because jQuery 2.0.3 is loaded locally afterwards, but the console is full of errors and over HTTPS the http script is mixed content (BUG-15).
  - Labels are not linked to inputs (`for="username"` vs `id="txtUsername"`), so screen readers cannot associate them (BUG-15).

### 2.2 Log in (`POST /actAdmin`, AJAX from `public/js/ajax.js:5`)
- **Inputs:** `username`, `password` (form fields `txtUsername`, `txtPassword`).
- **Client validation (`verify()`, `functions.js:45`):** empty username: alert "Please enter the Username"; empty password: alert "Please enter the Password". The request is not sent.
- **Server:** `person.findFirst` where `Name` equals username **case-insensitively** and `password` equals the plaintext password (`index.js:53-55`). Responds with body `true` / `false` (HTTP 200 either way).
- **Success:** the browser goes to `/home`.
- **Failure:** alert "Invalid User!", password cleared, focus back on username.
- **Edge cases / quirks:**
  - The username is case-insensitive and the password case-sensitive. `ADMIN` / `admin123` works, and the dashboard then says "Welcome ADMIN !" because the session stores the typed name (`index.js:58`) (BUG-17).
  - The username is `person.Name`, which for employees created through the UI is their **first name** (`hr.js:235`). Two employees with the same first name are told apart only by password; if they also share a password, whichever row comes first is logged in (BUG-24).
  - No lockout, rate limit or delay (SEC-07). No session regeneration on login (SEC-06).
  - A DB error is reported as an invalid login.

### 2.3 Dashboard (`GET /home`, `views/welcome.ejs`)
- **Role:** any logged-in user. Anonymous users are redirected to `/`.
- **Shows:** "Welcome <typed username> !", the role menu, "Recent Notices" (newest 5 notices of **all** types by table order, title and expandable body and date), and a static "Our Company Policy" paragraph.
- **Leave notification:**
  - Employee: if any of their leave requests was decided (status not 0) and not yet seen (`read = 0`), a link "The admin views your Leave request" goes to `/viewLeave`. It disappears after the employee opens their leave history (which sets `read = 1`).
  - HR: intended to show "Leave application N" linking to `/displayLeave` when there are pending requests. Because the template checks `title=='in'`, which is never true (`welcome.ejs:97`), HR instead sees the **employee** text "The admin views your Leave request", linking to `/viewLeave` (HR's own, normally empty, history) whenever any request is pending (BUG-06).
- **Edge cases:** if the session's person was deleted, `user.access` throws and the page returns 500 "Server error" (`index.js:24`, BUG-10). Notice ordering depends on Postgres's physical row order because there is no `orderBy` (`index.js:20`, BUG-13).

### 2.4 Log out (`GET /logout`)
- Destroys the session if there is one and redirects to `/`. It is a GET, so any page can log a user out with an `<img>` tag (SEC-04).
- In the menu it sits under the username drop-down: "Log out".

---

## 3. Employees (HR)

Menu: **Employee →** Add new employee / Manage Department / Manage Position / Manage Employee.

### 3.1 Employee list (`GET /hr/viewEmployee`, `views/viewEmployee.ejs`)
- **Shows:** heading "Employees Listing"; a table of Id, Name (first middle last, capitalised by CSS), Position (name), Email, and Action links "View Details | Edit | Delete".
- **Quirks:**
  - The employee with id **1** is always hidden, hard-coded (`viewEmployee.ejs:622`) (BUG-16). In the seed that is the HR admin; other HR users would be listed.
  - Position and Email cells are rendered inside the position-lookup loop (`viewEmployee.ejs:634-643`). If an employee's position no longer exists, **both cells are missing** and the row's Action links shift left under the Position column (BUG-07).
  - No ordering, pagination, search or sorting. Department is not shown.

### 3.2 Add employee (`GET /hr/addEmployee`, `POST /hr/saveEmp`)
- **Form fields (labels as shown):** Employee Id (read-only, pre-filled with max(id)+1), First name, Middle name, Last name, Department (select, from DB), Position (select, from DB), Country (select: Bangladesh, Nepal, India, Pakistan, USA, Germany, Canada, Australia), Home Town, Contact No. (digits only), E-mail, Gender (radio Male [default] / Female), Maritial Status [sic] (Single/Married/Divorced), Date of Birth (text, default "01 Jan 2019"). The banner reads "All fields are mandatory excpet Middle name" [sic].
- **Client validation (`verify_addemp`, `functions.js:137`), in order, each as an alert:** first name, last name, department, position, home town, contact, email required; email regex `^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$`; marital status; date of birth. Country is **not** validated. The function then reads `addemp.inpFile.value`, but the add form has no file input, so it throws a TypeError, the handler aborts and the browser submits anyway.
- **Server:** creates `employee` and `person` in one transaction. The person gets `Name = firstName`, `access = 0` and a **random 8-character password that is never shown to anyone** (`hr.js:232-239`). On success it re-renders the form with "Saved Succuessfully !" [sic] and the next id. On any error it redirects to the list with no message.
- **Expected (rewrite):** HR creates an employee with the fields above, gets a clear success or error message, the new employee shows in the list, and the employee gets a way to log in (an initial password shown to HR or an invite flow; product decision needed).
- **Observed defects:**
  - **BUG-01 (critical): adding an employee through the UI never works.** The form is `enctype="multipart/form-data"` (`addEmployee.ejs:129`) but the app only registers urlencoded and JSON body parsers (`app.js:15-16`). `req.body` is `{}`, `parseInt(undefined)` is `NaN`, Prisma throws, and the user lands on the list with no message and no new employee. Verified both by curl (multipart: 302, nothing created; urlencoded: saved) and by the E2E test.
  - BUG-03: even when it works (urlencoded POST), the new user cannot log in because nobody knows the password, and their username is their first name.
  - BUG-19: the id is max+1, computed when the form renders (race between two HR users), and `txtEmpId` is client-controlled.
  - Duplicate emails are allowed. There is no server-side validation of any field.

### 3.3 View employee details (`GET /hr/viewDetails?id=N`)
- **Shows:** heading "Employee Details" and label/value rows: First name (shows full name), Employee Id, Department (name), Position (name), Country, Home Town, Contact No., E-mail, Gender (Male if 1, otherwise Female), Maritial Status (raw value, e.g. `single`), Date of Birth.
- Also used for **HR's own profile** (menu: username → View Profile links to `/hr/viewDetails?id=<own id>`).
- **Edge cases:**
  - Missing `id` redirects to `/` (the login page) even when logged in (BUG-14).
  - Unknown id: the template dereferences `null`, returns 500 "Server error" (BUG-09).
  - Gender `null` shows "Female". A missing department or position shows blank.
  - Any logged-in user, including employees, can view any employee by changing the id (SEC-02).

### 3.4 Edit employee (`GET /hr/editEmployee?id=N`, `POST /hr/editEmp`)
- **Form:** same fields as Add, pre-filled, plus an "Image" block showing `../photo/<id>.jpg` (always a broken image, since no photo storage exists) and a file input "photograph". Employee Id is read-only.
- **Server:** updates `employee` and sets `person.Name = firstName` in one transaction; redirects to the list on success **and on failure** with no message.
- **Observed defects:**
  - **BUG-02 (critical): editing never works through the UI.** (a) `verify_addemp` requires a photograph (`functions.js:197`); without one the alert "Please select the Photograph" blocks submission. (b) With a photo selected, the form is multipart (`addEmployee.ejs:247`), so the body is empty and the update throws, and the user is redirected to the list as if it had succeeded.
  - BUG-04: changing an employee's first name silently changes their login username (`hr.js:184-187`).
  - BUG-18: the Department and Position placeholder options have no `value`, so if chosen the server gets `NaN`. The client check compares to `'0'` and misses this.
  - Unknown id returns 500 (BUG-09); missing id redirects to the login page (BUG-14).

### 3.5 Delete employee (`GET /hr/deleteEmployee?id=N`)
- **UI:** "Delete" link with confirm "Are you Sure! You want to delete?"; Cancel keeps the employee.
- **Server:** deletes `employee` and `person` in one transaction, then redirects to the list. Errors are swallowed.
- **Outcome:** the employee disappears from the list and can no longer log in. Verified by E2E.
- **Edge cases:**
  - If either row is missing, the transaction fails silently and nothing is deleted.
  - Their leave requests and appraisals are kept (no cascade), and HR screens then show the raw employee id in the name column (BUG-08).
  - HR can delete themselves via URL (id 1 is hidden in the list, but the route does not protect it). An active session of a deleted user then gets 500 on `/home` (BUG-10).
  - It is a GET, so it is CSRF-able (SEC-04).

### 3.6 Own profile (employee) (`GET /hr/viewProfile`)
- **Role:** employee (menu: username → View Profile). Read-only "Employee Details" view of the logged-in user's employee row, same layout as 3.3.
- Employees cannot edit any of their own data.
- If the logged-in person has no `employee` row, the page returns 500.

---

## 4. Departments (HR) (`GET /hr/addDep`, `POST /hr/saveDep`, `GET /hr/deleteDep?id=`)
- **UI:** heading "Manage Departments"; form "Department Name:" + button "Add Department"; table Id / Department Name / Action (Delete with confirm "Delete this department?"); empty state "No departments added yet."
- **Validation:** the name is trimmed; blank gives the red message "Name required" (server-side, via `?error=`). No length limit, and **duplicates are allowed**.
- **Success:** "Saved Successfully!"; the new row appears; the department is offered in the Add/Edit Employee selects.
- **Delete:** removes the row. **No check for employees in that department** (BUG-07): their details then show a blank Department. A DB error is swallowed. A deleted id is never reused.
- No rename/edit.

## 5. Positions (HR) (`GET /hr/addPos`, `POST /hr/savePos`, `GET /hr/deletePos?id=`)
Identical to Departments, with "Manage Positions", "Position Name:", "Add Position", "Delete this position?" and "No positions added yet.". Deleting an in-use position also breaks the employee list layout (see 3.1) (BUG-07).
Dead code: `verify_addPos` alerts "Please enter the Department Name" (copy-paste), but it is not wired to anything.

---

## 6. Leave

### 6.1 Apply for leave (employee) (`GET /addLeave`, `POST /saveLeave`)
- Menu: **Leave →** Leave Request.
- **Form:** Leave Type (select: Sick Leave, Annual Leave, Casual Leave, Maternity Leave, Unpaid Leave; Sick is the default), From Date (text, placeholder YYYY-MM-DD), To Date (text), Reason (textarea), button "Submit Request".
- **Server:** creates `empleave` with `empid` = session person id, `status = 0` (Pending), `read = 0`. Redirects with "Leave request submitted successfully!".
- **Validation:** none, client or server (BUG-12). Empty dates, free text such as "tomorrow", end before start, overlapping requests and past dates are all accepted. (`verify_addLeave` in functions.js targets field names that no longer exist and is not wired.)
- **Quirk:** the page always renders the employee menu, so an HR user who opens it loses the HR menu until they go back to `/home`. HR can also file leave for themselves (BUG-22).

### 6.2 My leave history (employee) (`GET /viewLeave`)
- Menu: **Leave →** View Leave History. Heading "My Leave History".
- Table: Leave Type, From, To, Reason, Status (Pending orange / Approved green / Rejected red), newest first. Empty state "No leave requests found."
- **Side effect:** opening this page marks all decided requests as read, which clears the dashboard notification.
- An unknown status value (see 6.4) is shown as "Pending".

### 6.3 Pending leave requests (HR) (`GET /displayLeave`)
- Menu: **Leave →** Assign. Heading "Pending Leave Requests".
- Table: Employee (first + last name, or the raw id if no employee row), Leave Type, From, To, Description, Action "Approve | Reject" (each with a confirm, "Approve this leave?" / "Reject this leave?"). Oldest first. Empty state "No pending leave requests."

### 6.4 Approve / reject (HR) (`GET /assignLeave?id=&status=`)
- Sets `status` (1 = Approved, 2 = Rejected) and resets `read = 0` so the employee is notified. Redirects to the pending list, where the request is gone.
- **Edge cases:** any integer status is accepted (`index.js:150`). For example `status=7` removes the request from the pending list while the employee and the "all" view still show "Pending", so it is lost (BUG-21). A decided request can be re-decided via URL. It is a GET, so it is CSRF-able (SEC-04). There is no comment or reason field for HR.

### 6.5 All leave requests (HR) (`GET /viewLeavebyAdmin`)
- Menu: **Leave →** View Leave Dates. Heading "All Leave Requests".
- Table: Employee, Leave Type, From, To, Description, Status (Pending/Approved/Rejected), newest first. Read-only, no filtering. Empty state "No leave requests found."

---

## 7. Notices

### 7.1 Manage notices (HR) (`GET /addNotice`, `POST /saveNotice`, `GET /deleteNotice?id=`)
- Menu: **Notice →** Manage Notice. Heading "Manage Notices".
- **Form:** Title (text), Notice (textarea), Type (select: General = 0, Urgent = 1, Holiday = 2), button "Post Notice".
- **Server:** creates the notice with `date = new Date().toLocaleDateString()` in the **server's** locale and timezone, stored as a string (BUG-13). Success message: "Notice posted successfully!".
- **Validation:** none. A blank title or body is saved, and if the DB rejects it the user is redirected with no message. (`verify_addNotice` exists but is not wired.)
- **List:** Id, Title, Notice, Date, Action (Delete, confirm "Delete this notice?"), newest first. Empty state "No notices posted yet."
- No edit.

### 7.2 Notice visibility
| Where | Who | Which notices | Limit |
|---|---|---|---|
| Login page "Recent Notices" | everyone | Urgent only | 5 newest |
| Dashboard "Recent Notices" | HR and employees | all types | 5 newest |
| Manage Notices table | HR | all | all |

Titles expand to show the body and date. "Newest" means last in physical table order, because there is no `ORDER BY` (BUG-13). Notice type has no visual distinction on the dashboard.

---

## 8. Performance appraisals (HR)

### 8.1 Add appraisal (`GET /addPerformance`, `POST /savePerformance`)
- Menu: **Performance Appraisal →** Add Appraisal. Heading "Add Performance Appraisal".
- **Form:** Employee (select "-- Select Employee --" + all employees sorted by first name, **including the HR admin**), Project Name, Start Date (text, YYYY-MM-DD placeholder), End Date, Rating (1 Poor, 2 Below Average, 3 Average [default], 4 Good, 5 Excellent), button "Save Appraisal".
- **Success:** "Appraisal saved successfully!".
- **Validation:** none on the client. On the server, a missing employee makes `parseInt('')` NaN and the insert throws; the user is sent back to a blank form **with no error message** (BUG-11). Dates are free text and are not checked (end before start is accepted). A rating outside 1-5 can be posted directly.

### 8.2 Manage appraisals (`GET /viewPerformance`, `GET /deletePerformance?id=`)
- Menu: **Performance Appraisal →** Manage Appraisal. Heading "Performance Appraisals".
- Table: Employee (first + last, or the raw id), Project, Start, End, Rating shown as `N/5`, Action Delete (confirm "Delete this appraisal?"). Newest first. Empty state "No appraisals recorded yet."
- No edit. **Employees cannot see their own appraisals anywhere.**

---

## 9. Profile
See 3.3 (HR's own profile, via `/hr/viewDetails?id=<own id>`) and 3.6 (employee's own profile via `/hr/viewProfile`). Both are read-only, and nobody can edit their own contact details.

## 10. Change password (`GET /changePassword`, `POST /savePassword`)
- **Role:** any logged-in user (menu: username → Change Password). The page shows the menu that matches the role.
- **Form:** Current Password, New Password, Confirm New Password, button "Change Password".
- **Rules (server):**
  1. new ≠ confirm: "Passwords do not match" (checked first, before the current password).
  2. current password wrong: "Current password is incorrect".
  3. otherwise the plaintext password is updated: "Password changed successfully!".
- The session stays valid after a change, and other sessions of the same user are not invalidated.
- **Defects:**
  - **BUG-05:** an empty new password (both fields blank) is accepted. The user is then locked out, because the login form refuses to send an empty password (`functions.js:54`). There is no minimum length or complexity rule.
  - BUG-23: the error text is taken from the `?error=` query string and shown on the page (HTML-escaped, but any message can be injected via a crafted link).
  - Passwords are stored and compared in plain text (SEC-03).

---

## 11. Known defects

Each entry has a stable ID. `legacy-tests` marks tests for the correct behaviour with `knownDefect('<ID>')`, which makes them expected-to-fail on legacy.

### Functional bugs
| ID | Severity | Summary | Location | E2E |
|---|---|---|---|---|
| BUG-01 | Critical | Add-employee form is multipart; no multipart parser; nothing is saved and no error is shown | views/addEmployee.ejs:129, app.js:15-16, routes/hr.js:196-261 | expected-fail |
| BUG-02 | Critical | Edit-employee requires a photo (`functions.js:197`) and is multipart, so the update never applies; redirects as if it succeeded | views/addEmployee.ejs:247, public/js/functions.js:197, routes/hr.js:189-192 | expected-fail |
| BUG-03 | High | New employees get a random password nobody sees; username = first name | routes/hr.js:232-239 | inventory only |
| BUG-04 | Medium | Editing first name silently renames the login | routes/hr.js:184-187 | inventory only |
| BUG-05 | High | Empty new password accepted; user locked out | routes/index.js:270-281, public/js/functions.js:54 | expected-fail |
| BUG-06 | Medium | HR dashboard shows the employee leave message and link instead of the pending count | views/welcome.ejs:97-115 | expected-fail |
| BUG-07 | Medium | Departments/positions in use can be deleted; employees left blank; list columns shift | routes/hr.js:297-307, 342-352; views/viewEmployee.ejs:634-643 | expected-fail (×2) |
| BUG-08 | Low | Deleting an employee orphans their leave and appraisals (raw id shown) | routes/hr.js:138-141 | inventory only |
| BUG-09 | Medium | Unknown employee id gives 500 on details/edit | routes/hr.js:44-61, 69-86 | expected-fail |
| BUG-10 | Low | Session of a deleted user gives 500 on `/home` | routes/index.js:19,24 | inventory only |
| BUG-11 | Medium | Appraisal without employee fails silently | routes/index.js:202-219 | expected-fail |
| BUG-12 | Medium | Leave dates unvalidated (empty, free text, end < start) | routes/index.js:301-321 | expected-fail |
| BUG-13 | Low | Notice date stored in server locale; notice ordering relies on physical row order | routes/index.js:7,20,103; views/welcome.ejs:121-125; views/index.ejs:71-76 | inventory only |
| BUG-14 | Low | `editEmployee`/`viewDetails` without id redirect to the login page | routes/hr.js:42,67 | inventory only |
| BUG-15 | Low | Broken asset references (`calender/*`, http jQuery 1.3.1) throw JS errors on every legacy-layout page; login labels not linked to inputs | views/index.ejs:8-12,39-44; views/welcome.ejs:9-13; views/addEmployee.ejs, viewEmployee.ejs heads | inventory only |
| BUG-16 | Low | Employee id 1 hard-coded as hidden in the list | views/viewEmployee.ejs:622 | inventory only |
| BUG-17 | Cosmetic | Welcome shows the username as typed ("Welcome ADMIN") | routes/index.js:58 | inventory only |
| BUG-18 | Low | Edit form placeholder options have no value (NaN on submit) | views/addEmployee.ejs:276,289 | inventory only |
| BUG-19 | Low | Employee id = max+1 computed at render, client-controlled | routes/hr.js:20,30,217 | inventory only |
| BUG-20 | Cosmetic | Typos: "Menagement", "Succuessfully", "Maritial", "excpet" | views/*.ejs | inventory only |
| BUG-21 | Medium | `assignLeave` accepts any status; non-0/1/2 values lose the request | routes/index.js:150-153 | inventory only |
| BUG-22 | Low | Leave pages force the employee menu; HR can file leave | routes/index.js:291-299, 323-339 | inventory only |
| BUG-23 | Low | Change-password message reflected from the query string | routes/index.js:262, views/changePassword.ejs | inventory only |
| BUG-24 | Medium | Logins are not unique (first name + password); ambiguous login | routes/hr.js:235, routes/index.js:53-55 | inventory only |

### Security defects (being patched by the Security lead)
| ID | Summary | Location | E2E |
|---|---|---|---|
| SEC-01 | No role checks: any logged-in employee can open and use every HR page and action (add/edit/delete employees, departments, positions, notices, approve leave, appraisals) | every handler in routes/hr.js; routes/index.js:77-252 | expected-fail (×10) |
| SEC-02 | IDOR: any user can view any employee via `/hr/viewDetails?id=` | routes/hr.js:64-87 | expected-fail |
| SEC-03 | Plaintext passwords (storage, compare, seed) | prisma/schema.prisma:13; routes/index.js:54,275,280; routes/hr.js:236 | not E2E-observable |
| SEC-04 | State-changing GETs: delete employee/department/position/notice/appraisal, approve/reject leave, logout | routes/hr.js:133,297,342; routes/index.js:70,113,147,242 | not E2E-observable |
| SEC-05 | No CSRF protection on any POST form | all forms | not E2E-observable |
| SEC-06 | Session: fallback secret `change-me`, no regeneration on login (fixation), default cookie flags, `saveUninitialized: true` | app.js:17; routes/index.js:57 | inventory only |
| SEC-07 | No brute-force protection on login | routes/index.js:50 | inventory only |

The E2E suite deliberately does not test SEC-03/04/05 internals (hashing, HTTP verbs, tokens), so that it keeps passing after the patch. Those belong in unit and integration tests for the new app (see `test-strategy.md`).

## 12. Not in scope / dead code
- `message` table and the commented-out "Message" menu item: no routes. The messaging feature does not exist.
- Commented-out menus: Recruitment, Employment Welfare, Document Processing (`/addDocument`). Not implemented.
- `public/js/bootstrap.js` (Laravel boilerplate using `require`) is never loaded.
- `views/layout.ejs` uses EJS 1 `<% include %>` syntax and is unused.
- Employee photos: the edit page references `/photo/<id>.jpg` but there is no upload handling or storage.

## 13. Open product questions for the rewrite
1. How does a newly created employee get credentials (shown temp password, email invite, HR sets password)? (BUG-03)
2. Should the username be first name (legacy), email, or an explicit username? Must it be unique? (BUG-24)
3. Deleting in-use departments/positions: block, or reassign? Deleting employees: soft delete, or cascade their leave and appraisals? (BUG-07/08)
4. Should employees see their own appraisals, and edit their own contact details?
5. Leave rules: date validation, overlap, balances, HR comment on decision?
6. Notice ordering and limit: keep "5 newest", and keep the login page showing Urgent only?
