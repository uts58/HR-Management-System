# Feature map: legacy routes → new app

Owner: Tech Lead. Each row is one parity item (ADR-0009). QA tracks status per row.

The legacy app mounts **33 routes**: 19 in `routes/index.js` at `/` and 14 in `routes/hr.js` at `/hr`. `routes/users.js` exists but is never mounted. Every legacy route except `/`, `/actAdmin` and `/logout` checks only that someone is logged in. **None checks the role.** The "Role" column is the role the new app enforces.

Ownership: **Frontend** owns pages and their `actions.ts` (`web/src/app/**`). **Backend** owns the service function. **Security** owns auth pages/actions and `requireRole`. **QA** owns the E2E journey for every row.

## Auth and shell

| # | Legacy route | New page / action | Service / auth fn | Role | Page+action owner | Notes |
|---|---|---|---|---|---|---|
| 1 | `GET /` (login form + recent notices) | `/login` page; `/` redirects to `/dashboard` or `/login` | – | anonymous | Security (form), Frontend (layout) | **[CHANGE]** No notices on the login page. They moved behind login (director ruling) |
| 2 | `POST /actAdmin` (AJAX, returns `true`/`false`) | Sign-in form → `signInWithUsername` (browser → Better Auth `POST /api/auth/sign-in/username`) | `AuthClientApi.signInWithUsername` | anonymous | Security | Not a server action, so Better Auth's rate limiter applies. Hashed passwords, stable username, terminated users rejected |
| 3 | `GET /logout` | `signOut` action (POST, from the user menu) | `AuthActions.signOut` | any | Security | No more GET mutation |
| 4 | `GET /home` (welcome, notices, leave badge) | `/dashboard` (the only place notices are shown to employees) | `listRecentNotices`, `countPendingLeaveRequests` (HR) / `countMyUnseenDecisions` (EMP) | any | Frontend / Backend | Fixes the `title=='in'` bug: HR now sees the pending count |
| 5 | `GET /changePassword` | `/change-password` page | – | any | Security | Also the forced page while `mustChangePassword` is set |
| 6 | `POST /savePassword` | `changePassword` action | `AuthActions.changePassword` | any | Security | Field errors instead of `?error=` query string |

## Employees (`/hr/*`)

| # | Legacy route | New page / action | Service fn | Role | Page+action owner | Notes |
|---|---|---|---|---|---|---|
| 7 | `GET /hr/viewEmployee` | `/employees` (status filter: Active by default, Terminated, All) | `employeeService.listEmployees` | HR_ADMIN | Frontend / Backend | Shows the admin too, with a role badge (legacy hid id 1). Terminated employees hidden by default |
| 8 | `GET /hr/addEmployee` | `/employees/new` | `getEmployeeFormOptions` | HR_ADMIN | Frontend / Backend | No "next id" preview. The DB assigns the id |
| 9 | `POST /hr/saveEmp` | `createEmployee` action → success screen with one-time credentials | `createEmployee` | HR_ADMIN | Frontend / Backend | Legacy route probably always failed (multipart not parsed, QA to confirm). New accounts get a visible temporary password |
| 10 | `GET /hr/viewDetails?id=` | `/employees/[id]` (read-only) | `getEmployee` | HR_ADMIN | Frontend / Backend | Fixes the IDOR (any user could view anyone) |
| 11 | `GET /hr/editEmployee?id=` | `/employees/[id]/edit` | `getEmployee`, `getEmployeeFormOptions` | HR_ADMIN | Frontend / Backend | |
| 12 | `POST /hr/editEmp` | `updateEmployee` action | `updateEmployee` | HR_ADMIN | Frontend / Backend | Username no longer follows first name |
| 13 | `GET /hr/deleteEmployee?id=` | `terminateEmployee` action (POST + confirm dialog) on `/employees` and `/employees/[id]` | `terminateEmployee` | HR_ADMIN | Frontend / Backend | **[CHANGE]** Soft delete: status TERMINATED, login disabled, sessions revoked, pending leave rejected, history kept. No hard delete in v1. Self / last active admin blocked |
| 14 | `GET /hr/viewProfile` | `/profile` | `getMyProfile` | any | Frontend / Backend | Also replaces HR's "View Profile" link (`viewDetails?id=self`) |
| – | *(none)* | `resetEmployeePassword` action on `/employees/[id]` | `resetEmployeePassword` | HR_ADMIN | Frontend / Backend | **[NEW]**, approved by director. Revokes the user's sessions |

## Departments and positions (`/hr/*`)

| # | Legacy route | New page / action | Service fn | Role | Page+action owner | Notes |
|---|---|---|---|---|---|---|
| 15 | `GET /hr/addDep` (form + list) | `/org/departments` | `orgService.listDepartments` | HR_ADMIN | Frontend / Backend | Shows employee count |
| 16 | `POST /hr/saveDep` | `createDepartment` action | `createDepartment` | HR_ADMIN | Frontend / Backend | Duplicate names rejected |
| 17 | `GET /hr/deleteDep?id=` | `deleteDepartment` action (POST + confirm) | `deleteDepartment` | HR_ADMIN | Frontend / Backend | Blocked while employees are assigned |
| 18 | `GET /hr/addPos` (form + list) | `/org/positions` | `listPositions` | HR_ADMIN | Frontend / Backend | |
| 19 | `POST /hr/savePos` | `createPosition` action | `createPosition` | HR_ADMIN | Frontend / Backend | |
| 20 | `GET /hr/deletePos?id=` | `deletePosition` action (POST + confirm) | `deletePosition` | HR_ADMIN | Frontend / Backend | Blocked while employees are assigned |

## Notices

| # | Legacy route | New page / action | Service fn | Role | Page+action owner | Notes |
|---|---|---|---|---|---|---|
| 21 | `GET /addNotice` (form + list) | `/notices` | `noticeService.listNotices` | HR_ADMIN | Frontend / Backend | |
| 22 | `POST /saveNotice` | `createNotice` action | `createNotice` | HR_ADMIN | Frontend / Backend | Title/body required. Real timestamp |
| 23 | `GET /deleteNotice?id=` | `deleteNotice` action (POST + confirm) | `deleteNotice` | HR_ADMIN | Frontend / Backend | |

## Leave

| # | Legacy route | New page / action | Service fn | Role | Page+action owner | Notes |
|---|---|---|---|---|---|---|
| 24 | `GET /addLeave` | `/leave/apply` | – | EMPLOYEE | Frontend | Date pickers instead of free text |
| 25 | `POST /saveLeave` | `applyForLeave` action | `leaveService.applyForLeave` | EMPLOYEE | Frontend / Backend | end ≥ start |
| 26 | `GET /viewLeave` (also marks decided rows read) | `/leave/history` + `markLeaveDecisionsSeen` action called once after render | `listMyLeaveRequests`, `markMyLeaveDecisionsSeen` | EMPLOYEE | Frontend / Backend | Read and mark-seen are split (no side effects in GET) |
| 27 | `GET /displayLeave` (pending queue) | `/leave/requests` | `listPendingLeaveRequests` | HR_ADMIN | Frontend / Backend | Oldest first |
| 28 | `GET /assignLeave?id=&status=` | `decideLeave` action (Approve / Reject buttons, confirm) | `decideLeaveRequest` | HR_ADMIN | Frontend / Backend | Only PENDING → APPROVED/REJECTED. Records decidedBy/At |
| 29 | `GET /viewLeavebyAdmin` | `/leave/all` | `listAllLeaveRequests` | HR_ADMIN | Frontend / Backend | Same columns as legacy (employee, type, from, to, reason, status) |

## Performance appraisal

| # | Legacy route | New page / action | Service fn | Role | Page+action owner | Notes |
|---|---|---|---|---|---|---|
| 30 | `GET /addPerformance` | `/appraisals/new` | `employeeService.listEmployeeOptions` | HR_ADMIN | Frontend / Backend | Picker lists ACTIVE employees only |
| 31 | `POST /savePerformance` | `createAppraisal` action | `performanceService.createAppraisal` | HR_ADMIN | Frontend / Backend | Employee, project, dates, rating all required |
| 32 | `GET /viewPerformance` | `/appraisals` | `listAppraisals` | HR_ADMIN | Frontend / Backend | |
| 33 | `GET /deletePerformance?id=` | `deleteAppraisal` action (POST + confirm) | `deleteAppraisal` | HR_ADMIN | Frontend / Backend | |

## Not migrated

| Legacy | Reason |
|---|---|
| `routes/users.js` (`GET /users`) | Never mounted |
| `Message` model, commented-out `/message` menu link | Unused, dropped |
| Commented-out menu: Recruitment, Employment Welfare, Document Processing (`/addDocument`) | Never implemented |
| `/actChangePass` (referenced in `public/js/ajax.js`) | No server route exists; replaced by row 6 |

## Navigation (replaces `views/menu.ejs`)

- **HR_ADMIN:** Employees (Add, Manage, Departments, Positions) · Notices · Leave (Pending requests, All leave) · Appraisals (Add, Manage) · user menu (Profile, Change password, Sign out)
- **EMPLOYEE:** Leave (Apply, History) · user menu (Profile, Change password, Sign out)

The menu is built on the server from `session.user.role`. Hiding a link is convenience only. The page and action checks are what enforce access.
