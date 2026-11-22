-- QA E2E fixtures, loaded AFTER Data's prisma/seed.ts by tests/support/db/reset.ts.
-- Ids 101+ so they never collide with the seed (ids 1-5).
-- {{QA_HASH}} is replaced at runtime with a bcrypt hash of QA_PASSWORD
-- (tests/support/users.ts). Better Auth's verify accepts bcrypt and rehashes
-- to argon2id on the first sign-in, like migrated legacy users.
-- Keep in sync with tests/support/users.ts.

BEGIN;

-- Placeholder employee (legacy orphan, contracts.md Employee rule 6b):
-- TERMINATED, no login, is_placeholder. Must be hidden from every employee
-- list, count and picker, and shown as "Unknown employee #101" in history.
INSERT INTO employees (id, first_name, last_name, employment_status, terminated_at, is_placeholder, created_at, updated_at)
VALUES (101, 'Unknown', 'employee #101', 'TERMINATED', '2020-01-01T00:00:00Z', true, NULL, now());

INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, seen_by_employee, created_at, updated_at)
VALUES (101, 'SICK', '2019-03-04', '2019-03-05', 'QA placeholder history', 'APPROVED', true, NULL, now());

INSERT INTO appraisals (employee_id, project_name, project_start, project_end, rating, created_at, updated_at)
VALUES (101, 'QA placeholder project', '2019-01-01', '2019-06-30', 2, NULL, now());

-- Active employees with logins. department/position ids come from the seed (1-4).
INSERT INTO employees (id, first_name, last_name, email, contact_no, country, home_town, gender, marital_status, date_of_birth, department_id, position_id, created_at, updated_at) VALUES
  (102, 'Nora',  'Noemail',   NULL,                    '555-0202', 'Nepal',     'Pokhara', 'FEMALE', 'SINGLE',   '1992-02-02', 3, 3, now(), now()),
  (103, 'Carl',  'Contact',   'carl.contact@example.com', '555-0203', 'Germany', 'Berlin',  'MALE',   'MARRIED',  '1987-03-03', 2, 2, now(), now()),
  (104, 'Terry', 'Terminate', 'terry@example.com',     '555-0204', 'USA',       'Denver',  'MALE',   'SINGLE',   '1991-04-04', 4, 4, now(), now()),
  (105, 'Rita',  'Reset',     'rita@example.com',      '555-0205', 'India',     'Chennai', 'FEMALE', 'SINGLE',   '1993-05-05', 3, 3, now(), now()),
  (106, 'Chad',  'Changer',   'chad@example.com',      '555-0206', 'Canada',    'Halifax', 'MALE',   'DIVORCED', '1989-06-06', 2, 2, now(), now()),
  (107, 'Fran',  'Forced',    'fran@example.com',      '555-0207', 'Australia', 'Hobart',  'FEMALE', 'SINGLE',   '1995-07-07', 4, 4, now(), now()),
  (108, 'Lena',  'Leave',     'lena@example.com',      '555-0208', 'Bangladesh','Sylhet',  'FEMALE', 'MARRIED',  '1990-08-08', 2, 2, now(), now()),
  (109, 'Eric',  'Edit',      'eric@example.com',      '555-0209', 'Pakistan',  'Lahore',  'MALE',   'SINGLE',   '1994-09-09', 3, 3, now(), now());

-- Login accounts. Nora and Carl have placeholder login emails
-- (email_is_placeholder; the CHECK requires the @users.invalid domain).
INSERT INTO users (id, name, email, email_is_placeholder, username, display_username, role, must_change_password, employee_id, created_at, updated_at) VALUES
  ('qa-user-102', 'Nora Noemail',   'nora.noemail@users.invalid', true,  'nora.noemail',    'nora.noemail',    'EMPLOYEE', false, 102, now(), now()),
  ('qa-user-103', 'Carl Contact',   'carl.contact@users.invalid', true,  'carl.contact',    'carl.contact',    'EMPLOYEE', false, 103, now(), now()),
  ('qa-user-104', 'Terry Terminate','terry@example.com',          false, 'terry.terminate', 'terry.terminate', 'EMPLOYEE', false, 104, now(), now()),
  ('qa-user-105', 'Rita Reset',     'rita@example.com',           false, 'rita.reset',      'rita.reset',      'EMPLOYEE', false, 105, now(), now()),
  ('qa-user-106', 'Chad Changer',   'chad@example.com',           false, 'chad.changer',    'chad.changer',    'EMPLOYEE', false, 106, now(), now()),
  ('qa-user-107', 'Fran Forced',    'fran@example.com',           false, 'fran.forced',     'fran.forced',     'EMPLOYEE', true,  107, now(), now()),
  ('qa-user-108', 'Lena Leave',     'lena@example.com',           false, 'lena.leave',      'lena.leave',      'EMPLOYEE', false, 108, now(), now()),
  ('qa-user-109', 'Eric Edit',      'eric@example.com',           false, 'eric.edit',       'eric.edit',       'EMPLOYEE', false, 109, now(), now());

INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT 'qa-account-' || substr(id, 9), id, 'credential', id, '{{QA_HASH}}', now(), now()
FROM users WHERE id LIKE 'qa-user-%';

-- Explicit ids were used above: move the sequences past MAX(id).
SELECT setval(pg_get_serial_sequence('"employees"', 'id'), (SELECT MAX(id) FROM employees) + 1, false);

COMMIT;
