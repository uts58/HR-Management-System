/**
 * Migrates the legacy HR DB (Prisma 6 schema, prisma/schema.prisma) to the v2 DB (web/prisma/schema.prisma).
 *
 *   LEGACY_DATABASE_URL  source. Read-only, one REPEATABLE READ snapshot.
 *   DATABASE_URL         target. The v2 migrations must already be applied (prisma migrate deploy).
 *
 * All target writes run in ONE transaction. Any fatal error or failed verification rolls back.
 * Re-runnable: rows are upserted on their preserved legacy ids (users on legacy_person_id,
 * credential accounts on (provider_id, account_id)). Use --reset for an exact copy.
 * See README.md.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import pg from "pg";
import { parseLegacyDate, type DateParseResult, type SlashOrder } from "./dates.js";
import {
  assignUsernames,
  classifyPassword,
  cleanStr,
  isPlausibleEmail,
  mapGender,
  mapLeaveStatus,
  mapMaritalStatus,
  mapNoticeType,
  mapRating,
  mapRole,
  mapSeenByEmployee,
  mergeByName,
  normaliseBcrypt,
  normaliseLeaveType,
  parseIntId,
  type Mapped,
  type PasswordKind,
} from "./transform.js";

// ---------------------------------------------------------------------------
// CLI / config
// ---------------------------------------------------------------------------

const { values: flags } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    reset: { type: "boolean", default: false },
    strict: { type: "boolean", default: false },
    "must-change-plaintext": { type: "boolean", default: false },
    "slash-order": { type: "string", default: "MDY" },
    report: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (flags.help) {
  console.log(`Usage: npm run migrate -- [--dry-run] [--reset] [--strict] [--must-change-plaintext]
                       [--slash-order MDY|DMY] [--report path.json]
See README.md for details.`);
  process.exit(0);
}

const SLASH_ORDER = String(flags["slash-order"]).toUpperCase() as SlashOrder;
if (SLASH_ORDER !== "MDY" && SLASH_ORDER !== "DMY") fatal("--slash-order must be MDY or DMY");
// Director decision: every migrated password is bcrypt. Security's Better Auth verify accepts bcrypt and rehashes to scrypt on login.
const BCRYPT_COST = Number(process.env.BCRYPT_COST ?? 12);
if (!Number.isInteger(BCRYPT_COST) || BCRYPT_COST < 10 || BCRYPT_COST > 15) fatal("BCRYPT_COST must be an integer 10..15");
const REPORT_PATH = flags.report ?? `migration-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const USERNAMES_CSV = REPORT_PATH.replace(/\.json$/i, "") + ".usernames.csv";
const SYNTHETIC_EMAIL_DOMAIN = "users.invalid"; // RFC 2606: can never be delivered

const LEGACY_URL = process.env.LEGACY_DATABASE_URL;
const TARGET_URL = process.env.DATABASE_URL;
if (!LEGACY_URL) fatal("LEGACY_DATABASE_URL is not set");
if (!TARGET_URL) fatal("DATABASE_URL is not set");
if (LEGACY_URL === TARGET_URL) fatal("LEGACY_DATABASE_URL and DATABASE_URL must differ");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

type TableName = "departments" | "positions" | "employees" | "users" | "accounts" | "leave_requests" | "notices" | "appraisals";

interface TableStats {
  legacyTable: string;
  legacyRows: number;
  /** rows created by the migration with no 1:1 legacy row (placeholder employees, credential accounts) */
  synthesized: number;
  /** legacy rows folded into another row (case-insensitive duplicate names) */
  merged: number;
  /** legacy rows that could not be migrated at all */
  rejected: number;
  inserted: number;
  updated: number;
  targetRowsAfter?: number;
}

const report = {
  startedAt: new Date().toISOString(),
  finishedAt: "",
  mode: flags["dry-run"] ? "dry-run (rolled back)" : "commit",
  options: { reset: flags.reset, slashOrder: SLASH_ORDER, bcryptCost: BCRYPT_COST, mustChangePlaintext: flags["must-change-plaintext"] },
  tables: {} as Record<TableName, TableStats>,
  dropped: { message: 0 },
  /** plaintext = newly hashed with bcrypt this run; kept-existing-hash = bcrypt hash reused from a previous run */
  passwords: { "better-auth-scrypt": 0, bcrypt: 0, "other-hash": 0, plaintext: 0, empty: 0, "kept-existing-hash": 0 } as Record<PasswordKind | "kept-existing-hash", number>,
  dates: { parsed: 0, empty: 0, invalid: 0, ambiguousDayMonth: 0, orderInferred: 0, timeDropped: 0 },
  /** For HR: every migrated login, with its NEW username. Also written as CSV. */
  usernames: [] as {
    legacyPersonId: string; legacyLoginName: string | null; employeeId: number | null; employeeName: string | null;
    username: string; email: string; emailIsSynthetic: boolean; role: string; canLogIn: boolean;
  }[],
  /** Every placeholder auth email generated (director decision): legacyPersonId -> email, and why. */
  placeholderEmails: [] as { legacyPersonId: string; username: string; email: string; reason: string }[],
  merges: [] as { table: string; survivorId: number; survivorName: string; mergedId: number; mergedName: string; employeesReassigned: number }[],
  placeholderEmployees: [] as { employeeId: number; referencedBy: string[] }[],
  orphans: [] as { check: string; legacyTable: string; legacyId: string | number; ref: unknown; action: string }[],
  warnings: [] as { legacyTable: string; legacyId: string | number; field: string; message: string }[],
  rejected: [] as { legacyTable: string; legacyId: string | number; reasons: string[]; row: Record<string, unknown> }[],
  verification: [] as { check: string; ok: boolean; detail: string }[],
};

function warn(legacyTable: string, legacyId: string | number, field: string, message: string) {
  report.warnings.push({ legacyTable, legacyId, field, message });
}
function orphan(check: string, legacyTable: string, legacyId: string | number, ref: unknown, action: string) {
  report.orphans.push({ check, legacyTable, legacyId, ref, action });
}
function reject(legacyTable: string, legacyId: string | number, reasons: string[], row: Record<string, unknown>) {
  const safe = { ...row };
  delete safe.password;
  report.rejected.push({ legacyTable, legacyId, reasons, row: safe });
}
function take<T>(m: Mapped<T>, table: string, id: string | number, field: string): T {
  if (m.warn) warn(table, id, field, m.warn);
  return m.value;
}

/** Parses a legacy date to "YYYY-MM-DD". Returns null if empty, undefined if invalid (already reported). */
function date(raw: unknown, table: string, id: string | number, field: string): string | null | undefined {
  const r: DateParseResult = parseLegacyDate(raw, { slashOrder: SLASH_ORDER });
  if (r.kind === "empty") {
    report.dates.empty++;
    return null;
  }
  if (r.kind === "invalid") {
    report.dates.invalid++;
    warn(table, id, field, `unparseable date "${String(raw)}" (${r.reason}); stored as NULL`);
    return undefined;
  }
  report.dates.parsed++;
  if (r.note === "ambiguous-day-month") {
    report.dates.ambiguousDayMonth++;
    warn(table, id, field, `ambiguous date "${String(raw)}" read as ${r.value} (--slash-order ${SLASH_ORDER})`);
  } else if (r.note === "day-month-order-inferred") {
    report.dates.orderInferred++;
    warn(table, id, field, `date "${String(raw)}" read as ${r.value} (day/month order inferred from value)`);
  } else if (r.note === "time-component-dropped") {
    report.dates.timeDropped++;
  }
  return r.value;
}

// ---------------------------------------------------------------------------
// Legacy row shapes (column names exactly as in the legacy prisma/schema.prisma)
// ---------------------------------------------------------------------------

interface LPerson { id: string; Name: string | null; password: string | null; access: number | null }
interface LEmployee {
  id: number; firstName: string | null; middleName: string | null; lastName: string | null;
  department: number | null; position: number | null; country: string | null; homeTown: string | null;
  contactNo: string | null; email: string | null; gender: number | null; maritalStatus: string | null;
  dateofBirth: string | null;
}
interface LDepartment { id: number; departmentName: string | null }
interface LPosition { id: number; positionName: string | null }
interface LEmpLeave {
  id: number; empid: string | null; leaveType: string | null; leaveStart: string | null; leaveEnd: string | null;
  description: string | null; status: number | null; read: number | null;
}
interface LNotice { id: number; title: string | null; type: number | null; notice: string | null; date: string | null }
interface LPerformance {
  id: number; empId: number | null; project_name: string | null; project_begin: string | null;
  project_end: string | null; rating: number | null;
}

// ---------------------------------------------------------------------------
// Target writing
// ---------------------------------------------------------------------------

interface Col { name: string; cast?: string }

/** Multi-row INSERT ... ON CONFLICT DO UPDATE, in chunks. Returns the inserted/updated counts. */
async function upsert(
  db: pg.PoolClient,
  table: TableName,
  cols: Col[],
  rows: unknown[][],
  conflict: string[],
  updateCols: string[],
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const CHUNK = 500;
  for (let off = 0; off < rows.length; off += CHUNK) {
    const chunk = rows.slice(off, off + CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const ph = cols.map((c, i) => {
        params.push(row[i]);
        return `$${params.length}${c.cast ? `::${c.cast}` : ""}`;
      });
      return `(${ph.join(", ")}, now())`;
    });
    const sets = [...updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`), `"updated_at" = now()`];
    const sql =
      `INSERT INTO "${table}" (${cols.map((c) => `"${c.name}"`).join(", ")}, "updated_at") VALUES ${tuples.join(", ")} ` +
      `ON CONFLICT (${conflict.map((c) => `"${c}"`).join(", ")}) DO UPDATE SET ${sets.join(", ")} ` +
      `RETURNING (xmax = 0) AS inserted`;
    const res = await db.query<{ inserted: boolean }>(sql, params);
    for (const r of res.rows) r.inserted ? inserted++ : updated++;
  }
  return { inserted, updated };
}

/** The columns this script writes. Preflight checks that they exist, so schema drift fails fast. */
const TARGET_COLUMNS: Record<TableName, string[]> = {
  departments: ["id", "name", "updated_at"],
  positions: ["id", "name", "updated_at"],
  employees: ["id", "first_name", "middle_name", "last_name", "email", "contact_no", "country", "home_town", "gender", "marital_status", "date_of_birth", "department_id", "position_id", "employment_status", "terminated_at", "created_at", "updated_at"],
  users: ["id", "name", "email", "email_verified", "username", "display_username", "role", "must_change_password", "employee_id", "legacy_person_id", "updated_at"],
  accounts: ["id", "account_id", "provider_id", "user_id", "password", "updated_at"],
  leave_requests: ["id", "employee_id", "leave_type", "start_date", "end_date", "reason", "status", "seen_by_employee", "created_at", "updated_at"],
  notices: ["id", "title", "body", "type", "created_at", "updated_at"],
  appraisals: ["id", "employee_id", "project_name", "project_start", "project_end", "rating", "created_at", "updated_at"],
};

async function preflight(db: pg.PoolClient) {
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(TARGET_COLUMNS)) {
    const res = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
      [table],
    );
    const have = new Set(res.rows.map((r) => r.column_name));
    if (have.size === 0) missing.push(`table ${table}`);
    else for (const c of cols) if (!have.has(c)) missing.push(`${table}.${c}`);
  }
  if (missing.length) {
    fatal(`target DB does not match schema v2 (missing: ${missing.join(", ")}). Run \`prisma migrate deploy\` in web/ first.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const legacyPool = new pg.Pool({ connectionString: LEGACY_URL, max: 1 });
  const targetPool = new pg.Pool({ connectionString: TARGET_URL, max: 1 });
  const legacy = await legacyPool.connect();
  const target = await targetPool.connect();
  const runTs = new Date().toISOString();

  try {
    await preflight(target);

    // ---- 1. Read the legacy data as one consistent snapshot ---------------------------------
    await legacy.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const q = async <T extends pg.QueryResultRow>(sql: string) => (await legacy.query<T>(sql)).rows;
    const persons = await q<LPerson>(`SELECT * FROM "person"`);
    const employees = await q<LEmployee>(`SELECT * FROM "employee" ORDER BY id`);
    const departments = await q<LDepartment>(`SELECT * FROM "department" ORDER BY id`);
    const positions = await q<LPosition>(`SELECT * FROM "position" ORDER BY id`);
    const leaves = await q<LEmpLeave>(`SELECT * FROM "empleave" ORDER BY id`);
    const notices = await q<LNotice>(`SELECT * FROM "notice" ORDER BY id`);
    const perfs = await q<LPerformance>(`SELECT * FROM "performance" ORDER BY id`);
    const hasMessage = (await q<{ t: string | null }>(`SELECT to_regclass('message')::text AS t`))[0].t;
    report.dropped.message = hasMessage ? Number((await q<{ n: string }>(`SELECT count(*) AS n FROM "message"`))[0].n) : 0;
    await legacy.query("COMMIT");

    // Numeric ids first, in ascending order, then non-numeric ones. This order decides username priority.
    persons.sort((a, b) => {
      const na = parseIntId(a.id);
      const nb = parseIntId(b.id);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return a.id.localeCompare(b.id);
    });

    const stats = (legacyTable: string, legacyRows: number): TableStats =>
      ({ legacyTable, legacyRows, synthesized: 0, merged: 0, rejected: 0, inserted: 0, updated: 0 });
    report.tables = {
      departments: stats("department", departments.length),
      positions: stats("position", positions.length),
      employees: stats("employee", employees.length),
      users: stats("person", persons.length),
      accounts: stats("person.password", 0),
      leave_requests: stats("empleave", leaves.length),
      notices: stats("notice", notices.length),
      appraisals: stats("performance", perfs.length),
    };

    // ---- 2. Transform (in memory) ------------------------------------------------------
    const depMerge = mergeByName(departments.map((d) => ({ id: d.id, name: d.departmentName })), "Department");
    const posMerge = mergeByName(positions.map((p) => ({ id: p.id, name: p.positionName })), "Position");
    report.tables.departments.merged = depMerge.merges.length;
    report.tables.positions.merged = posMerge.merges.length;

    const empIds = new Set(employees.map((e) => e.id));
    const personEmpIds = new Set(persons.map((p) => parseIntId(p.id)).filter((n): n is number => n !== null));
    const reassigned = new Map<string, number>(); // "department:<mergedId>" -> number of employees moved

    const empRows = employees.map((e) => {
      const T = "employee";
      const resolveRef = (kind: "department" | "position", v: number | null, merge: typeof depMerge): number | null => {
        if (v === null) return null;
        if (v === 0) {
          orphan(`employee.${kind} unset (0)`, T, e.id, 0, `${kind}_id = NULL`);
          return null;
        }
        const target = merge.remap.get(v);
        if (target === undefined) {
          orphan(`employee.${kind} -> missing ${kind}`, T, e.id, v, `${kind}_id = NULL`);
          return null;
        }
        if (target !== v) reassigned.set(`${kind}:${v}`, (reassigned.get(`${kind}:${v}`) ?? 0) + 1);
        return target;
      };
      const departmentId = resolveRef("department", e.department, depMerge);
      const positionId = resolveRef("position", e.position, posMerge);
      if (!personEmpIds.has(e.id)) orphan("employee without person (no login)", T, e.id, null, "migrated; no user created");
      const first = (e.firstName ?? "").trim();
      const last = (e.lastName ?? "").trim();
      if (!first) warn(T, e.id, "firstName", "empty first name");
      if (!last) warn(T, e.id, "lastName", "empty last name");
      let email = cleanStr(e.email)?.toLowerCase() ?? null;
      if (email && !isPlausibleEmail(email)) warn(T, e.id, "email", `"${email}" does not look like an email; kept as-is`);
      return [
        e.id, first, cleanStr(e.middleName), last, email, cleanStr(e.contactNo), cleanStr(e.country), cleanStr(e.homeTown),
        take(mapGender(e.gender), T, e.id, "gender"), take(mapMaritalStatus(e.maritalStatus), T, e.id, "maritalStatus"),
        date(e.dateofBirth, T, e.id, "dateofBirth") ?? null, departmentId, positionId, "ACTIVE", null, null,
      ];
    });
    for (const [label, m] of [["department", depMerge], ["position", posMerge]] as const) {
      for (const x of m.merges) {
        report.merges.push({ table: label, ...x, employeesReassigned: reassigned.get(`${label}:${x.mergedId}`) ?? 0 });
      }
    }

    // Placeholder employees for leave/appraisal history whose employee was hard-deleted in legacy.
    // History is kept (director decision 2). The placeholder is TERMINATED, so it never shows as active staff.
    const placeholders = new Map<number, string[]>();
    const needEmployee = (id: number, ref: string) => {
      if (empIds.has(id)) return;
      placeholders.set(id, [...(placeholders.get(id) ?? []), ref]);
    };

    const leaveRows: unknown[][] = [];
    for (const l of leaves) {
      const T = "empleave";
      const empId = parseIntId(l.empid);
      if (empId === null) {
        orphan("empleave.empid not an integer", T, l.id, l.empid, "row rejected");
        reject(T, l.id, [`empid "${l.empid}" is not an integer employee id`], l as unknown as Record<string, unknown>);
        continue;
      }
      if (!empIds.has(empId)) {
        orphan("empleave.empid -> missing employee", T, l.id, l.empid, "kept; linked to placeholder TERMINATED employee");
        needEmployee(empId, `empleave#${l.id}`);
      }
      const start = date(l.leaveStart, T, l.id, "leaveStart") ?? null;
      let end = date(l.leaveEnd, T, l.id, "leaveEnd") ?? null;
      if (!start && l.leaveStart == null) warn(T, l.id, "leaveStart", "empty; stored as NULL");
      if (!end && l.leaveEnd == null) warn(T, l.id, "leaveEnd", "empty; stored as NULL");
      if (start && end && end < start) {
        warn(T, l.id, "leaveEnd", `leaveEnd ${end} is before leaveStart ${start}; end_date stored as NULL (original "${l.leaveEnd}")`);
        end = null;
      }
      const status = take(mapLeaveStatus(l.status), T, l.id, "status");
      leaveRows.push([
        l.id, empId, take(normaliseLeaveType(l.leaveType), T, l.id, "leaveType"), start, end, cleanStr(l.description),
        status, mapSeenByEmployee(status, l.read), null,
      ]);
    }

    const perfRows: unknown[][] = [];
    for (const p of perfs) {
      const T = "performance";
      if (p.empId === null) {
        reject(T, p.id, ["empId is NULL"], p as unknown as Record<string, unknown>);
        continue;
      }
      if (!empIds.has(p.empId)) {
        orphan("performance.empId -> missing employee", T, p.id, p.empId, "kept; linked to placeholder TERMINATED employee");
        needEmployee(p.empId, `performance#${p.id}`);
      }
      const start = date(p.project_begin, T, p.id, "project_begin") ?? null;
      let end = date(p.project_end, T, p.id, "project_end") ?? null;
      if (start && end && end < start) {
        warn(T, p.id, "project_end", `project_end ${end} is before project_begin ${start}; project_end stored as NULL`);
        end = null;
      }
      perfRows.push([p.id, p.empId, cleanStr(p.project_name), start, end, take(mapRating(p.rating), T, p.id, "rating"), null]);
    }

    for (const [id, refs] of [...placeholders].sort((a, b) => a[0] - b[0])) {
      // id, first, middle, last, email, contact, country, homeTown, gender, marital, dob, dept, pos, status, terminatedAt, createdAt
      empRows.push([id, "Unknown", null, `employee #${id}`, null, null, null, null, null, null, null, null, null, "TERMINATED", runTs, null]);
      report.placeholderEmployees.push({ employeeId: id, referencedBy: refs });
    }
    report.tables.employees.synthesized = placeholders.size;

    const noticeRows = notices.map((n) => {
      const T = "notice";
      const d = date(n.date, T, n.id, "date");
      if (d === null) warn(T, n.id, "date", "empty; created_at stored as NULL");
      if (!cleanStr(n.title)) warn(T, n.id, "title", "empty title");
      if (!cleanStr(n.notice)) warn(T, n.id, "notice", "empty body");
      return [n.id, (n.title ?? "").trim(), n.notice ?? "", take(mapNoticeType(n.type), T, n.id, "type"), d ? `${d}T00:00:00Z` : null];
    });

    // ---- 3. Target transaction ---------------------------------------------------------------
    await target.query("BEGIN");
    await target.query("SET LOCAL TIME ZONE 'UTC'");
    if (flags.reset) {
      await target.query(
        `TRUNCATE "appraisals", "leave_requests", "notices", "sessions", "accounts", "verifications", "users", "employees", "departments", "positions" RESTART IDENTITY CASCADE`,
      );
    }

    const put = async (t: TableName, cols: Col[], rows: unknown[][], conflict: string[], immutable: string[] = ["id"]) => {
      const updateCols = cols.map((c) => c.name).filter((c) => !conflict.includes(c) && !immutable.includes(c));
      const r = await upsert(target, t, cols, rows, conflict, updateCols);
      report.tables[t].inserted = r.inserted;
      report.tables[t].updated = r.updated;
    };
    const C = (name: string, cast?: string): Col => ({ name, cast });

    await put("departments", [C("id", "int"), C("name")], depMerge.survivors.map((s) => [s.id, s.name]), ["id"]);
    await put("positions", [C("id", "int"), C("name")], posMerge.survivors.map((s) => [s.id, s.name]), ["id"]);
    await put("employees", [
      C("id", "int"), C("first_name"), C("middle_name"), C("last_name"), C("email"), C("contact_no"), C("country"),
      C("home_town"), C("gender", "gender"), C("marital_status", "marital_status"), C("date_of_birth", "date"),
      C("department_id", "int"), C("position_id", "int"), C("employment_status", "employment_status"),
      C("terminated_at", "timestamptz"), C("created_at", "timestamptz"),
    ], empRows, ["id"]);

    // ---- Users (Better Auth `user`) + credential accounts (Better Auth `account`) ----
    // Hashes from a previous run are reused when they still verify the legacy plaintext, so re-runs stay stable.
    const existingHash = new Map(
      (await target.query<{ legacy_person_id: string; password: string | null }>(
        `SELECT u.legacy_person_id, a.password FROM "users" u
           JOIN "accounts" a ON a.user_id = u.id AND a.provider_id = 'credential'
          WHERE u.legacy_person_id IS NOT NULL`,
      )).rows.map((r) => [r.legacy_person_id, r.password]),
    );

    const empById = new Map(employees.map((e) => [e.id, e]));
    const emailCount = new Map<string, number>();
    for (const e of employees) {
      const em = cleanStr(e.email)?.toLowerCase();
      if (em) emailCount.set(em, (emailCount.get(em) ?? 0) + 1);
    }
    const linkedEmp = (p: LPerson) => {
      const id = parseIntId(p.id);
      return id !== null ? empById.get(id) : undefined;
    };
    const names = assignUsernames(
      persons.map((p) => ({ key: p.id, firstName: linkedEmp(p)?.firstName, lastName: linkedEmp(p)?.lastName, loginName: p.Name })),
    );
    for (const s of names.suffixed) warn("person", s.key, "username", `"${s.base}" already taken; assigned "${s.username}"`);

    const userRows: unknown[][] = [];
    const passwordByPerson = new Map<string, string>();
    const mustChangeByPerson = new Map<string, boolean>();
    for (const p of persons) {
      const T = "person";
      const emp = linkedEmp(p);
      if (!emp) orphan("person without employee", T, p.id, p.id, "user migrated with employee_id = NULL");
      const username = names.byKey.get(p.id)!;
      const em = cleanStr(emp?.email)?.toLowerCase();
      let email = `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
      if (em && isPlausibleEmail(em) && (emailCount.get(em) ?? 0) === 1) {
        email = em;
      } else {
        const reason = !emp
          ? "no linked employee"
          : !em
            ? "employee has no email"
            : (emailCount.get(em) ?? 0) > 1
              ? `employee email "${em}" is shared by several employees`
              : `employee email "${em}" is invalid`;
        report.placeholderEmails.push({ legacyPersonId: p.id, username, email, reason });
      }

      const kind = classifyPassword(p.password);
      let mustChange = false;
      if (kind === "better-auth-scrypt") {
        // Not expected in legacy data; copied as-is (Better Auth verifies it natively).
        passwordByPerson.set(p.id, p.password!);
        report.passwords["better-auth-scrypt"]++;
        warn(T, p.id, "password", "already a Better Auth scrypt hash; copied verbatim");
      } else if (kind === "bcrypt") {
        // Written by the legacy app's lazy upgrade. Copied unchanged ($2y/$2x normalised to $2b).
        passwordByPerson.set(p.id, normaliseBcrypt(p.password!));
        report.passwords.bcrypt++;
      } else if (kind === "other-hash") {
        passwordByPerson.set(p.id, p.password!);
        report.passwords["other-hash"]++;
        warn(T, p.id, "password", "non-bcrypt hash copied verbatim; the v2 verify function must support it, or HR must reset this password");
      } else if (kind === "empty") {
        mustChange = true;
        report.passwords.empty++;
        warn(T, p.id, "password", "empty legacy password; no credential account created (HR must issue a password)");
      } else {
        const prev = existingHash.get(p.id);
        if (prev && classifyPassword(prev) === "bcrypt" && (await bcrypt.compare(p.password!, prev))) {
          passwordByPerson.set(p.id, prev);
          report.passwords["kept-existing-hash"]++;
        } else {
          passwordByPerson.set(p.id, await bcrypt.hash(p.password!, BCRYPT_COST));
          report.passwords.plaintext++;
        }
        mustChange = flags["must-change-plaintext"];
      }
      mustChangeByPerson.set(p.id, mustChange);

      const empName = emp ? [emp.firstName, emp.lastName].map((s) => (s ?? "").trim()).filter(Boolean).join(" ") : null;
      const role = take(mapRole(p.access), T, p.id, "access");
      userRows.push([randomUUID(), empName || cleanStr(p.Name) || username, email, false, username, username, role, mustChange, emp ? emp.id : null, p.id]);
      report.usernames.push({
        legacyPersonId: p.id, legacyLoginName: p.Name, employeeId: emp ? emp.id : null, employeeName: empName,
        username, email, emailIsSynthetic: email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`), role, canLogIn: passwordByPerson.has(p.id),
      });
    }
    await put("users", [
      C("id"), C("name"), C("email"), C("email_verified", "boolean"), C("username"), C("display_username"),
      C("role", "role"), C("must_change_password", "boolean"), C("employee_id", "int"), C("legacy_person_id"),
    ], userRows, ["legacy_person_id"]);

    const userIdByPerson = new Map(
      (await target.query<{ id: string; legacy_person_id: string }>(
        `SELECT id, legacy_person_id FROM "users" WHERE legacy_person_id IS NOT NULL`,
      )).rows.map((r) => [r.legacy_person_id, r.id]),
    );
    const accountRows = [...passwordByPerson].map(([pid, hash]) => {
      const uid = userIdByPerson.get(pid)!;
      return [randomUUID(), uid, "credential", uid, hash];
    });
    report.tables.accounts.synthesized = accountRows.length;
    await put("accounts", [C("id"), C("account_id"), C("provider_id"), C("user_id"), C("password")], accountRows, ["provider_id", "account_id"]);

    await put("leave_requests", [
      C("id", "int"), C("employee_id", "int"), C("leave_type"), C("start_date", "date"), C("end_date", "date"),
      C("reason"), C("status", "leave_status"), C("seen_by_employee", "boolean"), C("created_at", "timestamptz"),
    ], leaveRows, ["id"]);
    await put("notices", [C("id", "int"), C("title"), C("body"), C("type", "notice_type"), C("created_at", "timestamptz")], noticeRows, ["id"]);
    await put("appraisals", [
      C("id", "int"), C("employee_id", "int"), C("project_name"), C("project_start", "date"), C("project_end", "date"),
      C("rating", "smallint"), C("created_at", "timestamptz"),
    ], perfRows, ["id"]);

    // Move the sequences past the preserved ids (director decision 4).
    for (const t of ["departments", "positions", "employees", "leave_requests", "notices", "appraisals"]) {
      await target.query(`SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 0) + 1, false)`);
    }

    // ---- 4. Verification (inside the transaction, before COMMIT) -------------------------------
    report.tables.leave_requests.rejected = report.rejected.filter((r) => r.legacyTable === "empleave").length;
    report.tables.appraisals.rejected = report.rejected.filter((r) => r.legacyTable === "performance").length;
    const count = async (sql: string) => Number((await target.query<{ n: string }>(sql)).rows[0].n);
    for (const t of Object.keys(report.tables) as TableName[]) {
      const s = report.tables[t];
      s.targetRowsAfter = await count(`SELECT count(*) AS n FROM "${t}"`);
      const expected = t === "accounts" ? s.synthesized : s.legacyRows + s.synthesized - s.merged - s.rejected;
      const written = s.inserted + s.updated;
      report.verification.push({
        check: `${s.legacyTable} -> ${t}: written ${written} = legacy ${s.legacyRows} + synthesized ${s.synthesized} - merged ${s.merged} - rejected ${s.rejected}`,
        ok: written === expected,
        detail: written === expected ? "ok" : `expected ${expected}`,
      });
      if (s.targetRowsAfter < expected) {
        report.verification.push({ check: `${t} row count`, ok: false, detail: `target has ${s.targetRowsAfter} < ${expected}` });
      } else if (s.targetRowsAfter > expected) {
        report.verification.push({ check: `${t} row count`, ok: true, detail: `target has ${s.targetRowsAfter - expected} extra rows not in this legacy snapshot (use --reset for an exact copy)` });
      }
    }
    const expectedLinked = persons.filter((p) => linkedEmp(p)).length;
    const linked = await count(`SELECT count(*) AS n FROM "users" u JOIN "employees" e ON e.id = u.employee_id WHERE u.legacy_person_id = e.id::text`);
    report.verification.push({ check: "users linked to the employee with the same legacy id", ok: linked === expectedLinked, detail: `${linked}/${expectedLinked}` });
    const plain = await count(`SELECT count(*) AS n FROM "accounts" WHERE provider_id = 'credential' AND (password IS NULL OR (password !~ '^\\$(2[abxy]|argon2|scrypt|pbkdf2)' AND password !~ '^[0-9a-f]{32}:[0-9a-f]{128}$'))`);
    report.verification.push({ check: "no plaintext or NULL credential passwords", ok: plain === 0, detail: `${plain} suspicious rows` });
    const nonBcrypt = await count(
      `SELECT count(*) AS n FROM "accounts" a JOIN "users" u ON u.id = a.user_id
        WHERE a.provider_id = 'credential' AND u.legacy_person_id IS NOT NULL AND a.password !~ '^\\$2[ab]\\$'`,
    );
    const expectedNonBcrypt = report.passwords["better-auth-scrypt"] + report.passwords["other-hash"];
    report.verification.push({
      check: "migrated credential passwords are bcrypt ($2a/$2b)",
      ok: nonBcrypt === expectedNonBcrypt,
      detail: `${nonBcrypt} non-bcrypt (expected ${expectedNonBcrypt}: hashes copied verbatim from legacy, see warnings)`,
    });
    const badDept = await count(`SELECT count(*) AS n FROM (SELECT lower(name) FROM "departments" GROUP BY 1 HAVING count(*) > 1) x`);
    report.verification.push({ check: "department names unique (case-insensitive)", ok: badDept === 0, detail: `${badDept} duplicates` });
    const seqOk = await count(
      `SELECT count(*) AS n FROM "employees" WHERE id >= (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM "employees_id_seq")`,
    );
    report.verification.push({ check: "employees id sequence is past MAX(id)", ok: seqOk === 0, detail: seqOk === 0 ? "ok" : `${seqOk} ids would collide` });

    const failed = report.verification.filter((v) => !v.ok);
    if (flags["dry-run"]) {
      await target.query("ROLLBACK");
    } else if (failed.length) {
      await target.query("ROLLBACK");
      report.mode = "aborted (verification failed, rolled back)";
    } else {
      await target.query("COMMIT");
    }
  } catch (err) {
    await target.query("ROLLBACK").catch(() => {});
    await legacy.query("ROLLBACK").catch(() => {});
    report.mode = "failed (rolled back)";
    const e = err as { message?: string; detail?: string; constraint?: string };
    console.error(`\nFATAL: ${e.message ?? err}${e.detail ? `\n  detail: ${e.detail}` : ""}${e.constraint ? `\n  constraint: ${e.constraint}` : ""}`);
    if (e.constraint?.startsWith("users_") || e.constraint?.includes("name_lower")) {
      console.error("  hint: the target already holds rows that were not migrated (for example seed data). Re-run with --reset.");
    }
  } finally {
    legacy.release();
    target.release();
    await legacyPool.end();
    await targetPool.end();
  }

  report.finishedAt = new Date().toISOString();
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  writeFileSync(USERNAMES_CSV, toCsv(report.usernames));
  printReport();

  if (report.mode.startsWith("failed") || report.mode.startsWith("aborted")) process.exit(1);
  if (report.verification.some((v) => !v.ok)) process.exit(1);
  if (flags.strict && report.rejected.length) process.exit(2);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

function printReport() {
  const line = "-".repeat(78);
  console.log(`\n${line}\nLegacy -> v2 migration report   mode: ${report.mode}\n${line}`);
  console.table(
    Object.entries(report.tables).map(([t, s]) => ({
      legacy: s.legacyTable, target: t, legacyRows: s.legacyRows, synthesized: s.synthesized, merged: s.merged,
      rejected: s.rejected, inserted: s.inserted, updated: s.updated, targetAfter: s.targetRowsAfter ?? "-",
    })),
  );
  console.log(`Dropped: message (${report.dropped.message} rows, table not migrated)`);
  console.log("Passwords:", report.passwords);
  console.log("Dates:", report.dates);
  console.log(`Usernames: ${report.usernames.length} generated (${report.usernames.filter((u) => u.emailIsSynthetic).length} with synthetic auth email). Mapping: ${USERNAMES_CSV}`);
  if (report.placeholderEmails.length) {
    console.log(`\nPlaceholder auth emails (@${SYNTHETIC_EMAIL_DOMAIN}): ${report.placeholderEmails.length}`);
    for (const p of report.placeholderEmails.slice(0, 20)) console.log(`  person#${p.legacyPersonId} ${p.email}  (${p.reason})`);
    if (report.placeholderEmails.length > 20) console.log(`  ... ${report.placeholderEmails.length - 20} more in the JSON report`);
  }
  if (report.merges.length) {
    console.log("\nMerged duplicate names:");
    for (const m of report.merges) console.log(`  ${m.table} #${m.mergedId} "${m.mergedName}" -> #${m.survivorId} "${m.survivorName}" (${m.employeesReassigned} employees reassigned)`);
  }
  if (report.placeholderEmployees.length) {
    console.log(`\nPlaceholder TERMINATED employees created for orphaned history: ${report.placeholderEmployees.map((p) => p.employeeId).join(", ")}`);
  }

  const group = <T,>(items: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const i of items) m.set(key(i), [...(m.get(key(i)) ?? []), i]);
    return m;
  };
  const show = <T,>(title: string, m: Map<string, T[]>, fmt: (x: T) => string) => {
    console.log(`\n${title}: ${[...m.values()].reduce((a, v) => a + v.length, 0)}`);
    for (const [k, v] of m) {
      console.log(`  [${v.length}] ${k}`);
      for (const x of v.slice(0, 5)) console.log(`        ${fmt(x)}`);
      if (v.length > 5) console.log(`        ... ${v.length - 5} more in the JSON report`);
    }
  };
  show("Orphaned references in legacy data", group(report.orphans, (o) => `${o.check} -> ${o.action}`),
    (o) => `${o.legacyTable}#${o.legacyId} ref=${JSON.stringify(o.ref)}`);
  show("Rejected rows", group(report.rejected, (r) => r.legacyTable), (r) => `#${r.legacyId}: ${r.reasons.join("; ")}`);
  show("Warnings", group(report.warnings, (w) => `${w.legacyTable}.${w.field}`), (w) => `#${w.legacyId}: ${w.message}`);
  console.log("\nVerification:");
  for (const v of report.verification) console.log(`  ${v.ok ? "PASS" : "FAIL"}  ${v.check}  (${v.detail})`);
  console.log(`\nFull report: ${REPORT_PATH}\nUsernames:   ${USERNAMES_CSV}\n(Both files contain employee PII. Do not commit them or share them widely.)\n${line}`);
}

function fatal(msg: string): never {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

await main();
