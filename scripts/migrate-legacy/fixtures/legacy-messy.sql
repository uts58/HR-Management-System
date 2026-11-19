-- Test fixture: the legacy schema (same DDL Prisma 6 generates from the legacy prisma/schema.prisma)
-- plus deliberately messy data covering each edge case the migration handles.
-- Load it into an EMPTY scratch database. Never run it against production.
-- No real people: every name, email and password here is invented.

DROP TABLE IF EXISTS "person", "employee", "department", "position", "empleave", "notice", "message", "performance";

CREATE TABLE "person" ("id" TEXT PRIMARY KEY, "Name" TEXT NOT NULL, "password" TEXT NOT NULL, "access" INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "employee" (
  "id" INTEGER PRIMARY KEY, "firstName" TEXT NOT NULL, "middleName" TEXT, "lastName" TEXT NOT NULL,
  "department" INTEGER NOT NULL, "position" INTEGER NOT NULL, "country" TEXT, "homeTown" TEXT, "contactNo" TEXT,
  "email" TEXT, "gender" INTEGER, "maritalStatus" TEXT, "dateofBirth" TEXT);
CREATE TABLE "department" ("id" SERIAL PRIMARY KEY, "departmentName" TEXT NOT NULL);
CREATE TABLE "position" ("id" SERIAL PRIMARY KEY, "positionName" TEXT NOT NULL);
CREATE TABLE "empleave" (
  "id" SERIAL PRIMARY KEY, "empid" TEXT NOT NULL, "leaveType" TEXT, "leaveStart" TEXT, "leaveEnd" TEXT,
  "description" TEXT, "status" INTEGER NOT NULL DEFAULT 0, "read" INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "notice" ("id" SERIAL PRIMARY KEY, "title" TEXT NOT NULL, "type" INTEGER, "notice" TEXT NOT NULL, "date" TEXT);
CREATE TABLE "message" ("id" SERIAL PRIMARY KEY, "from" INTEGER NOT NULL, "to" INTEGER NOT NULL, "msg" TEXT, "date" TEXT, "read" INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "performance" (
  "id" SERIAL PRIMARY KEY, "empId" INTEGER NOT NULL, "project_name" TEXT, "project_begin" TEXT, "project_end" TEXT, "rating" INTEGER);

INSERT INTO "department" ("id", "departmentName") VALUES
  (1, 'Human Resources'), (2, 'Engineering'), (3, 'Finance'), (4, 'engineering '),  -- 4 duplicates 2 case-insensitively
  (5, 'Marketing');
INSERT INTO "position" ("id", "positionName") VALUES
  (1, 'HR Manager'), (2, 'Software Engineer'), (3, 'Accountant'), (4, 'SOFTWARE ENGINEER');

INSERT INTO "employee" VALUES
  (1, 'Admin', '', 'User', 1, 1, 'USA', NULL, NULL, 'admin@example.com', 1, NULL, NULL),
  (2, 'John', 'A', 'Doe', 2, 2, 'USA', 'New York', '5550100', 'John.Doe@example.com', 1, 'single', '01 Jan 1990'),
  (3, 'john', '', 'doe', 4, 4, 'India', 'Pune', '5550101', 'shared@example.com', 1, 'married', '1988-07-15'),  -- same name; merged dept/pos
  (4, 'Ana', NULL, 'Silva', 0, 0, 'Bangladesh', NULL, NULL, 'shared@example.com', 0, '0', '31/12/1992'),       -- unset dept/pos ("0")
  (5, 'Bob', '', 'Stale', 99, 3, 'Canada', NULL, NULL, '', 1, 'divorced', 'sometime in 1980'),                -- missing dept 99; bad DOB
  (6, 'Zoë', '', 'Ödegaard', 5, 3, 'Germany', NULL, NULL, 'not-an-email', 7, 'complicated', '03/04/1985'),     -- odd gender, ambiguous DOB
  (7, 'NoLogin', '', 'Person', 3, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL);                                -- employee without person

INSERT INTO "person" VALUES
  ('1', 'admin', 'admin123', 1),
  ('2', 'john', 'emp123', 0),
  ('3', 'John', '$2b$10$wRUUqF.D0R6kvEohkRv76Oe38B9RXkYNHdLfnOPgIugYVTCFEEFKW', 0),  -- already bcrypt (password secret99)
  ('4', 'Ana', 'x7Kq9mZp', 0),
  ('5', 'bob', '', 0),                                                               -- empty password
  ('6', 'zoe', 'pw6', 3),                                                            -- unknown access value
  ('42', 'ghost', 'boo', 0),                                                         -- person without employee
  ('abc', 'weird', 'pw', 0);                                                         -- non-numeric person id

INSERT INTO "empleave" ("id", "empid", "leaveType", "leaveStart", "leaveEnd", "description", "status", "read") VALUES
  (1, '2', 'Sick Leave', '2026-01-10', '2026-01-12', 'flu', 1, 1),
  (2, '2', 'Annual Leave', '2026-03-01', '2026-03-05', NULL, 0, 0),
  (3, '3', 'casual', '03/04/2026', '03/05/2026', NULL, 2, 0),       -- ambiguous slash dates, decided but unseen
  (4, '4', 'Study Leave', 'tomorrow', '2026-02-30', NULL, 1, 1),    -- unknown type, unparseable dates
  (5, '17', 'Sick Leave', '2025-05-01', '2025-05-02', NULL, 1, 1),  -- employee 17 hard-deleted -> placeholder
  (6, 'john', 'Sick Leave', '2025-05-01', '2025-05-02', NULL, 0, 0),-- non-numeric empid -> rejected
  (7, '2', 'Unpaid Leave', '2026-06-10', '2026-06-01', NULL, 9, 0); -- end before start, unknown status

INSERT INTO "notice" ("id", "title", "type", "notice", "date") VALUES
  (1, 'Welcome', 0, 'Welcome to the portal', '11/17/2026'),
  (2, 'Server down', 1, 'Maintenance tonight', '17/11/2026'),
  (3, 'Eid holiday', 2, 'Office closed', NULL),
  (4, 'Mystery', 5, '', 'garbage');

INSERT INTO "message" ("from", "to", "msg") VALUES (1, 2, 'hello'), (2, 1, 'hi');

INSERT INTO "performance" ("id", "empId", "project_name", "project_begin", "project_end", "rating") VALUES
  (1, 2, 'Payroll revamp', '2025-01-01', '2025-06-30', 4),
  (2, 3, 'Website', '2025-07-01', '2025-03-01', 9),   -- end before start, rating out of range
  (3, 18, 'Old project', '2024-01-01', NULL, 3),      -- employee 18 hard-deleted -> placeholder
  (4, 4, NULL, 'Q1 2025', '', NULL);                  -- unparseable start

SELECT setval(pg_get_serial_sequence('"department"', 'id'), 5);
SELECT setval(pg_get_serial_sequence('"position"', 'id'), 4);
SELECT setval(pg_get_serial_sequence('"empleave"', 'id'), 7);
SELECT setval(pg_get_serial_sequence('"notice"', 'id'), 4);
SELECT setval(pg_get_serial_sequence('"performance"', 'id'), 4);
