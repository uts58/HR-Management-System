/**
 * Pure value mappings from legacy magic ints and free strings to v2 values.
 * Each mapping is derived from legacy routes and views. See docs/data/schema-decisions.md.
 * The value-mapping functions return { value, warn? }. A warning never stops the migration.
 */

export type Mapped<T> = { value: T; warn?: string };

export type Role = "EMPLOYEE" | "HR_ADMIN";
export type Gender = "MALE" | "FEMALE";
export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
export type NoticeType = "GENERAL" | "URGENT" | "HOLIDAY";

/** person.access: routes/index.js `user.access === 1` -> HR view, otherwise employee view. */
export function mapRole(access: number | null): Mapped<Role> {
  if (access === 1) return { value: "HR_ADMIN" };
  if (access === 0) return { value: "EMPLOYEE" };
  return { value: "EMPLOYEE", warn: `unknown access value ${access}; defaulted to EMPLOYEE` };
}

/** employee.gender: views/addEmployee.ejs radio sex: value="1" Male, value="0" Female. */
export function mapGender(g: number | null): Mapped<Gender | null> {
  if (g === null || g === undefined) return { value: null };
  if (g === 1) return { value: "MALE" };
  if (g === 0) return { value: "FEMALE" };
  return { value: null, warn: `unknown gender value ${g}; set to NULL` };
}

/** employee.maritalStatus: <select> values single/married/divorced. The add form's placeholder option posts "0". */
export function mapMaritalStatus(s: string | null): Mapped<MaritalStatus | null> {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "" || v === "0" || v.startsWith("---")) return { value: null };
  if (v === "single") return { value: "SINGLE" };
  if (v === "married") return { value: "MARRIED" };
  if (v === "divorced") return { value: "DIVORCED" };
  return { value: null, warn: `unknown marital status "${s}"; set to NULL` };
}

/** empleave.status: views/viewLeave.ejs 0 Pending, 1 Approved, 2 Rejected (routes /assignLeave?status=1|2). */
export function mapLeaveStatus(st: number | null): Mapped<LeaveStatus> {
  if (st === 0) return { value: "PENDING" };
  if (st === 1) return { value: "APPROVED" };
  if (st === 2) return { value: "REJECTED" };
  return { value: "PENDING", warn: `unknown leave status ${st}; set to PENDING for HR re-review` };
}

/**
 * empleave.read -> seen_by_employee. Legacy sets read=0 on every new request and
 * whenever HR decides. /viewLeave sets read=1 only on decided rows. The contract
 * says seenByEmployee is always true while PENDING.
 */
export function mapSeenByEmployee(status: LeaveStatus, read: number | null): boolean {
  return status === "PENDING" ? true : read === 1;
}

export type LeaveType = "SICK" | "ANNUAL" | "CASUAL" | "MATERNITY" | "UNPAID" | "OTHER";

/** views/addLeave.ejs fixed <select> option values -> LeaveType enum (director ruling). */
export const LEAVE_TYPE_LABELS: Record<Exclude<LeaveType, "OTHER">, string> = {
  SICK: "Sick Leave",
  ANNUAL: "Annual Leave",
  CASUAL: "Casual Leave",
  MATERNITY: "Maternity Leave",
  UNPAID: "Unpaid Leave",
};
const LEAVE_KEY = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const LEAVE_BY_KEY = new Map(Object.entries(LEAVE_TYPE_LABELS).map(([k, label]) => [LEAVE_KEY(label), k as LeaveType]));

/**
 * Matches one of the five labels, ignoring case and all whitespace ("SICK  leave" -> SICK).
 * Anything else, including NULL, "" and "sick" without "Leave", becomes OTHER. `legacy` then
 * holds the original text (or "" for NULL) for leave_requests.legacy_leave_type, plus a warning.
 */
export function mapLeaveType(t: string | null): Mapped<LeaveType> & { legacy: string | null } {
  const hit = LEAVE_BY_KEY.get(LEAVE_KEY(t ?? ""));
  if (hit) return { value: hit, legacy: null };
  return { value: "OTHER", legacy: t ?? "", warn: `leave type ${t === null ? "NULL" : `"${t}"`} matches none of the five legacy options; set to OTHER` };
}

/** notice.type: views/addNotice.ejs 0 General, 1 Urgent, 2 Holiday. saveNotice stores parseInt(type) || 0. */
export function mapNoticeType(t: number | null): Mapped<NoticeType> {
  if (t === null || t === undefined || t === 0) return { value: "GENERAL" };
  if (t === 1) return { value: "URGENT" };
  if (t === 2) return { value: "HOLIDAY" };
  return { value: "GENERAL", warn: `unknown notice type ${t}; set to GENERAL` };
}

/** performance.rating: views/addPerformance.ejs select 1..5. */
export function mapRating(r: number | null): Mapped<number | null> {
  if (r === null || r === undefined) return { value: null };
  if (Number.isInteger(r) && r >= 1 && r <= 5) return { value: r };
  return { value: null, warn: `rating ${r} outside 1-5; set to NULL` };
}

/** Trim; empty -> null. */
export function cleanStr(s: string | null | undefined): string | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isPlausibleEmail(s: string): boolean {
  return EMAIL_RE.test(s) && s.length <= 254;
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

/**
 * better-auth-scrypt: Better Auth's native format "<32 hex salt>:<128 hex key>" (better-auth/crypto hashPassword).
 * bcrypt: what the legacy app's lazy upgrade on login writes (Security lead), e.g. "$2b$12$...".
 */
export type PasswordKind = "better-auth-scrypt" | "bcrypt" | "other-hash" | "plaintext" | "empty";

const BETTER_AUTH_SCRYPT_RE = /^[0-9a-f]{32}:[0-9a-f]{128}$/;
const BCRYPT_RE = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const OTHER_HASH_RE = /^\$(argon2(id|i|d)|scrypt|pbkdf2[-\w]*)\$/;

export function classifyPassword(pw: string | null): PasswordKind {
  if (pw === null || pw === undefined || pw === "") return "empty";
  if (BETTER_AUTH_SCRYPT_RE.test(pw)) return "better-auth-scrypt";
  if (BCRYPT_RE.test(pw)) return "bcrypt";
  if (OTHER_HASH_RE.test(pw)) return "other-hash";
  return "plaintext";
}

/** $2y$ (PHP) and $2x$ use the same algorithm as $2b$. bcryptjs only accepts $2a$/$2b$. */
export function normaliseBcrypt(hash: string): string {
  return hash.replace(/^\$2[xy]\$/, "$2b$");
}

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

/** Better Auth username plugin defaults: 3-30 chars, [a-z0-9_.]. The contract allows [a-z0-9._-]. We use the intersection. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** ASCII-fold and lower-case; keep [a-z0-9] runs and join the words with ".". */
export function slugPart(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(".");
}

export const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

export type UsernameReason =
  | "kept-legacy" // lower(legacy login) is valid and unique, so the user's login is unchanged (apart from case)
  | "legacy-invalid" // legacy login breaks the username rules (length, spaces, other characters)
  | "legacy-duplicate" // several legacy logins are the same case-insensitively
  | "legacy-empty";

export interface UsernameAssignment {
  username: string;
  /** true when the user must be told a new login name (anything other than kept-legacy) */
  changed: boolean;
  reason: UsernameReason;
}

/**
 * Deterministic username assignment (director ruling 2):
 *  1. KEEP lower(legacy login) when it matches ^[a-z0-9._]{3,30}$ and no other legacy login
 *     has the same lower-case value. These are reserved first, so generated names never take them.
 *  2. Otherwise generate first.last (ASCII-folded) -> else slug(login) -> else "user<id>",
 *     padded to 3 chars, max 27 + suffix. Collisions get base2, base3, ... in input order
 *     (callers sort by legacy person id ascending).
 * Every result matches USERNAME_RE.
 */
export function assignUsernames(
  people: { key: string; firstName?: string | null; lastName?: string | null; loginName?: string | null }[],
): Map<string, UsernameAssignment> {
  const out = new Map<string, UsernameAssignment>();
  const taken = new Set<string>();
  const lowerCount = new Map<string, number>();
  for (const p of people) {
    const l = (p.loginName ?? "").toLowerCase();
    lowerCount.set(l, (lowerCount.get(l) ?? 0) + 1);
  }
  const pending: { p: (typeof people)[number]; reason: UsernameReason }[] = [];
  for (const p of people) {
    const l = (p.loginName ?? "").toLowerCase();
    if (l.trim() === "") pending.push({ p, reason: "legacy-empty" });
    else if (!USERNAME_RE.test(l)) pending.push({ p, reason: "legacy-invalid" });
    else if ((lowerCount.get(l) ?? 0) > 1) pending.push({ p, reason: "legacy-duplicate" });
    else {
      out.set(p.key, { username: l, changed: false, reason: "kept-legacy" });
      taken.add(l);
    }
  }
  for (const { p, reason } of pending) {
    const full = [slugPart(p.firstName), slugPart(p.lastName)].filter(Boolean).join(".");
    let base = full || slugPart(p.loginName) || `user${slugPart(p.key)}`;
    base = base.slice(0, USERNAME_MAX - 3).replace(/\.+$/, "");
    if (base.length < USERNAME_MIN) base = `${base}${base ? "." : ""}user`.slice(0, USERNAME_MAX - 3);
    let u = base;
    for (let n = 2; taken.has(u); n++) u = `${base}${n}`;
    taken.add(u);
    out.set(p.key, { username: u, changed: true, reason });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Department / position name merging
// ---------------------------------------------------------------------------

/**
 * Names must be unique case-insensitively (director decision 3). Case-insensitive
 * duplicates (after trimming) merge into the LOWEST id, and employees are reassigned
 * to that survivor. An empty name becomes "<prefix> <id>".
 */
export function mergeByName(
  rows: { id: number; name: string | null }[],
  fallbackPrefix: string,
): {
  survivors: { id: number; name: string }[];
  remap: Map<number, number>;
  merges: { survivorId: number; survivorName: string; mergedId: number; mergedName: string }[];
} {
  const survivors: { id: number; name: string }[] = [];
  const remap = new Map<number, number>();
  const merges: { survivorId: number; survivorName: string; mergedId: number; mergedName: string }[] = [];
  const byKey = new Map<string, { id: number; name: string }>();
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    const name = (cleanStr(r.name) ?? `${fallbackPrefix} ${r.id}`).replace(/\s+/g, " ");
    const key = name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      remap.set(r.id, existing.id);
      merges.push({ survivorId: existing.id, survivorName: existing.name, mergedId: r.id, mergedName: name });
    } else {
      const s = { id: r.id, name };
      byKey.set(key, s);
      survivors.push(s);
      remap.set(r.id, r.id);
    }
  }
  return { survivors, remap, merges };
}

/** Legacy string ids that hold a plain non-negative integer, e.g. person.id or empleave.empid. */
export function parseIntId(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!/^\d{1,9}$/.test(s)) return null;
  return Number(s);
}
