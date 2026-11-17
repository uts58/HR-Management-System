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

/** The contract's LEAVE_TYPES. These are the views/addLeave.ejs option values, stored verbatim. */
export const LEAVE_TYPES = ["Sick Leave", "Annual Leave", "Casual Leave", "Maternity Leave", "Unpaid Leave"] as const;

/** Snaps near-misses ("sick", "SICK LEAVE ") to the canonical label. Unknown values are kept verbatim (trimmed). */
export function normaliseLeaveType(t: string | null): Mapped<string> {
  const v = (t ?? "").trim().replace(/\s+/g, " ");
  if (v === "") return { value: "Unspecified", warn: 'empty leave type; stored as "Unspecified"' };
  const key = v.toLowerCase().replace(/ ?leave$/, "");
  const hit = LEAVE_TYPES.find((l) => l.toLowerCase().replace(/ leave$/, "") === key);
  if (hit) return hit === v ? { value: hit } : { value: hit, warn: `leave type "${t}" normalised to "${hit}"` };
  return { value: v, warn: `leave type "${v}" is not one of LEAVE_TYPES; stored verbatim` };
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

/**
 * Deterministic username generation (director decision: stable usernames, not first names).
 *   base = first.last (contract default) -> else slug(legacy login name) -> else "user<id>"
 *   collisions: base, base2, base3, ... in input order (callers sort by legacy person id ascending)
 * Every result matches ^[a-z0-9._]{3,30}$.
 */
export function assignUsernames(
  people: { key: string; firstName?: string | null; lastName?: string | null; loginName?: string | null }[],
): { byKey: Map<string, string>; suffixed: { key: string; base: string; username: string }[] } {
  const byKey = new Map<string, string>();
  const taken = new Set<string>();
  const suffixed: { key: string; base: string; username: string }[] = [];
  for (const p of people) {
    const full = [slugPart(p.firstName), slugPart(p.lastName)].filter(Boolean).join(".");
    let base = full || slugPart(p.loginName) || `user${slugPart(p.key)}`;
    base = base.slice(0, USERNAME_MAX - 3).replace(/\.+$/, "");
    if (base.length < USERNAME_MIN) base = `${base}${base ? "." : ""}user`.slice(0, USERNAME_MAX - 3);
    let u = base;
    for (let n = 2; taken.has(u); n++) u = `${base}${n}`;
    if (u !== base) suffixed.push({ key: p.key, base, username: u });
    taken.add(u);
    byKey.set(p.key, u);
  }
  return { byKey, suffixed };
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
