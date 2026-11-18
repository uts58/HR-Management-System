-- Deterministic test fixture for the legacy HR Management System.
-- Wipes every table and loads:
--   1. exactly the data from prisma/seed.js (admin, john, 4 departments, 4 positions, welcome notice)
--   2. extra QA-only rows (ids >= 3 / >= 5) so destructive tests never touch shared seed data.
--
-- Passwords are stored in plain text because that is what the legacy app expects.
-- When the Security lead lands password hashing, replace the person.password values
-- with hashes produced by the app's hashing function (keep the plaintexts listed in
-- support/data.ts unchanged so the tests keep working).

BEGIN;

TRUNCATE TABLE person, employee, department, position, empleave, notice, message, performance RESTART IDENTITY;

-- ── prisma/seed.js data ──────────────────────────────────────────────────────
INSERT INTO department (id, "departmentName") VALUES
  (1, 'Human Resources'), (2, 'Engineering'), (3, 'Finance'), (4, 'Marketing');

INSERT INTO position (id, "positionName") VALUES
  (1, 'HR Manager'), (2, 'Software Engineer'), (3, 'Accountant'), (4, 'Marketing Specialist');

INSERT INTO person (id, "Name", password, access) VALUES
  ('1', 'admin', 'admin123', 1),
  ('2', 'john',  'emp123',   0);

INSERT INTO employee (id, "firstName", "middleName", "lastName", department, position, email, gender, country, "contactNo", "homeTown", "maritalStatus", "dateofBirth") VALUES
  (1, 'Admin', '',  'User', 1, 1, 'admin@company.com',    1, 'USA', NULL,       NULL,       NULL,     NULL),
  (2, 'John',  'A', 'Doe',  2, 2, 'john.doe@company.com', 1, 'USA', '555-0100', 'New York', 'single', '01 Jan 1990');

INSERT INTO notice (id, title, notice, type, date) VALUES
  (1, 'Welcome to the HR Portal', 'Welcome to the HR Management System. Please log in and update your profile information.', 0, '1/1/2026');

-- ── QA-only fixtures ─────────────────────────────────────────────────────────
-- Department/position that is in use by an employee (used by the "cannot delete in-use" tests).
INSERT INTO department (id, "departmentName") VALUES (5, 'QA Occupied Department');
INSERT INTO position   (id, "positionName")   VALUES (5, 'QA Occupied Position');

INSERT INTO person (id, "Name", password, access) VALUES
  ('3', 'mary',  'mary123',  0),   -- change-password happy path
  ('4', 'temp',  'temp123',  0),   -- deleted by the employee-delete test
  ('5', 'paula', 'paula123', 0),   -- empty-new-password test (may be locked out on legacy)
  ('6', 'olive', 'olive123', 0);   -- occupies department/position 5

INSERT INTO employee (id, "firstName", "middleName", "lastName", department, position, email, gender, country, "contactNo", "homeTown", "maritalStatus", "dateofBirth") VALUES
  (3, 'Mary',  '', 'Major',    3, 3, 'mary@company.com',  0, 'Canada',  '555-0103', 'Toronto', 'married', '02 Feb 1991'),
  (4, 'Temp',  '', 'Worker',   4, 4, 'temp@company.com',  1, 'India',   '555-0104', 'Delhi',   'single',  '03 Mar 1992'),
  (5, 'Paula', '', 'Weak',     3, 3, 'paula@company.com', 0, 'Germany', '555-0105', 'Berlin',  'single',  '04 Apr 1993'),
  (6, 'Olive', '', 'Occupant', 5, 5, 'olive@company.com', 0, 'Nepal',   '555-0106', 'Pokhara', 'single',  '05 May 1994');

-- Keep autoincrement sequences ahead of the explicit ids above.
SELECT setval(pg_get_serial_sequence('department', 'id'), (SELECT MAX(id) FROM department));
SELECT setval(pg_get_serial_sequence('position',   'id'), (SELECT MAX(id) FROM position));
SELECT setval(pg_get_serial_sequence('notice',     'id'), (SELECT MAX(id) FROM notice));

COMMIT;
