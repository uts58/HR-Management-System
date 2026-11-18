import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignUsernames,
  classifyPassword,
  mapGender,
  mapLeaveStatus,
  mapMaritalStatus,
  mapNoticeType,
  mapRole,
  mapSeenByEmployee,
  mergeByName,
  normaliseBcrypt,
  mapLeaveType,
  parseIntId,
} from "../src/transform.js";

test("enum mappings", () => {
  assert.equal(mapRole(1).value, "HR_ADMIN");
  assert.equal(mapRole(0).value, "EMPLOYEE");
  assert.ok(mapRole(7).warn);
  assert.equal(mapGender(1).value, "MALE");
  assert.equal(mapGender(0).value, "FEMALE");
  assert.equal(mapGender(null).value, null);
  assert.equal(mapMaritalStatus("0").value, null);
  assert.equal(mapMaritalStatus(" Married ").value, "MARRIED");
  assert.ok(mapMaritalStatus("complicated").warn);
  assert.deepEqual([0, 1, 2].map((s) => mapLeaveStatus(s).value), ["PENDING", "APPROVED", "REJECTED"]);
  assert.ok(mapLeaveStatus(9).warn);
  assert.deepEqual([null, 0, 1, 2].map((t) => mapNoticeType(t).value), ["GENERAL", "GENERAL", "URGENT", "HOLIDAY"]);
});

test("seenByEmployee", () => {
  assert.equal(mapSeenByEmployee("PENDING", 0), true);
  assert.equal(mapSeenByEmployee("APPROVED", 0), false);
  assert.equal(mapSeenByEmployee("REJECTED", 1), true);
});

test("leave types -> enum, case- and whitespace-insensitive, OTHER keeps the raw text", () => {
  assert.deepEqual(mapLeaveType("Sick Leave"), { value: "SICK", legacy: null });
  assert.equal(mapLeaveType("ANNUAL LEAVE ").value, "ANNUAL");
  assert.equal(mapLeaveType(" casual  leave").value, "CASUAL");
  assert.equal(mapLeaveType("MaternityLeave").value, "MATERNITY");
  assert.equal(mapLeaveType("Unpaid Leave").value, "UNPAID");
  const other = mapLeaveType("Study leave");
  assert.equal(other.value, "OTHER");
  assert.equal(other.legacy, "Study leave");
  assert.ok(other.warn);
  assert.equal(mapLeaveType("sick").value, "OTHER"); // not one of the five labels
  assert.deepEqual([mapLeaveType(null).value, mapLeaveType(null).legacy], ["OTHER", ""]);
});

test("password classification", () => {
  const bcrypt = "$2b$12$" + "a".repeat(53);
  assert.equal(classifyPassword(bcrypt), "bcrypt");
  assert.equal(classifyPassword("$2y$10$" + "a".repeat(53)), "bcrypt");
  assert.equal(normaliseBcrypt("$2y$10$abc"), "$2b$10$abc");
  assert.equal(classifyPassword("0".repeat(32) + ":" + "f".repeat(128)), "better-auth-scrypt");
  assert.equal(classifyPassword("$argon2id$v=19$m=65536,t=3,p=4$abc"), "other-hash");
  assert.equal(classifyPassword("emp123"), "plaintext");
  assert.equal(classifyPassword("$2b$short"), "plaintext");
  assert.equal(classifyPassword(""), "empty");
  assert.equal(classifyPassword(null), "empty");
});

test("usernames: keep valid unique legacy login, else first.last with deterministic collisions", () => {
  const m = assignUsernames([
    { key: "1", firstName: "Admin", lastName: "User", loginName: "admin" }, // kept
    { key: "2", firstName: "John", lastName: "Doe", loginName: "john" }, // duplicate of #3 case-insensitively
    { key: "3", firstName: "john", lastName: "DOE", loginName: "John" },
    { key: "4", firstName: "José", lastName: "Núñez-O'Brien", loginName: "José" }, // invalid chars
    { key: "5", firstName: null, lastName: null, loginName: "Al" }, // too short
    { key: "6", firstName: "", lastName: "", loginName: "" }, // empty
    { key: "7", firstName: "Bartholomew-Maximilian", lastName: "Vanderbilt-Featherstonehaugh", loginName: "Bart Max" }, // space
    { key: "8", firstName: "李", lastName: "王", loginName: "李" },
    { key: "9", firstName: "Zed", lastName: "Q", loginName: "Mary_Jones.2" }, // kept, lower-cased
    { key: "10", firstName: "Admin", lastName: "User", loginName: "boss man" }, // first.last free? "admin.user"
    { key: "11", firstName: "Johnny", lastName: "Doe", loginName: "john.doe" }, // kept: reserved before generation
  ]);
  const u = (k: string) => m.get(k)!;
  assert.deepEqual(u("1"), { username: "admin", changed: false, reason: "kept-legacy" });
  assert.deepEqual(u("9"), { username: "mary_jones.2", changed: false, reason: "kept-legacy" });
  assert.deepEqual(u("11"), { username: "john.doe", changed: false, reason: "kept-legacy" });
  // the generated names for #2/#3 must skip "john.doe", which #11 kept
  assert.deepEqual(u("2"), { username: "john.doe2", changed: true, reason: "legacy-duplicate" });
  assert.equal(u("3").username, "john.doe3");
  assert.deepEqual([u("4").username, u("4").reason], ["jose.nunez.o.brien", "legacy-invalid"]);
  assert.deepEqual([u("5").username, u("5").reason], ["al.user", "legacy-invalid"]);
  assert.deepEqual([u("6").username, u("6").reason], ["user6", "legacy-empty"]);
  assert.equal(u("8").username, "user8");
  assert.equal(u("10").username, "admin.user");
  for (const a of m.values()) assert.match(a.username, /^[a-z0-9._]{3,30}$/, a.username);
  assert.equal(new Set([...m.values()].map((a) => a.username)).size, m.size);
});

test("department merge: case-insensitive, lowest id survives", () => {
  const m = mergeByName(
    [
      { id: 3, name: "engineering " },
      { id: 1, name: "Engineering" },
      { id: 2, name: "HR" },
      { id: 4, name: "" },
    ],
    "Department",
  );
  assert.deepEqual(m.survivors.map((s) => [s.id, s.name]), [[1, "Engineering"], [2, "HR"], [4, "Department 4"]]);
  assert.equal(m.remap.get(3), 1);
  assert.equal(m.remap.get(2), 2);
  assert.equal(m.merges.length, 1);
});

test("parseIntId", () => {
  assert.equal(parseIntId("12"), 12);
  assert.equal(parseIntId(" 7 "), 7);
  assert.equal(parseIntId("abc"), null);
  assert.equal(parseIntId("1.5"), null);
  assert.equal(parseIntId(null), null);
});
