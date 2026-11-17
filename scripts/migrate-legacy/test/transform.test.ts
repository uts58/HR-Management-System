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
  normaliseLeaveType,
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

test("leave types", () => {
  assert.deepEqual(normaliseLeaveType("Sick Leave"), { value: "Sick Leave" });
  assert.equal(normaliseLeaveType("sick").value, "Sick Leave");
  assert.equal(normaliseLeaveType("ANNUAL LEAVE ").value, "Annual Leave");
  assert.equal(normaliseLeaveType("Study leave").value, "Study leave");
  assert.ok(normaliseLeaveType("Study leave").warn);
  assert.equal(normaliseLeaveType(null).value, "Unspecified");
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

test("usernames: first.last, Better Auth charset, deterministic collisions", () => {
  const { byKey, suffixed } = assignUsernames([
    { key: "1", firstName: "Admin", lastName: "User", loginName: "admin" },
    { key: "2", firstName: "John", lastName: "Doe" },
    { key: "3", firstName: "john", lastName: "DOE" },
    { key: "4", firstName: "José", lastName: "Núñez-O'Brien" },
    { key: "5", firstName: null, lastName: null, loginName: "Al" },
    { key: "6", firstName: "", lastName: "", loginName: "" },
    { key: "7", firstName: "Bartholomew-Maximilian", lastName: "Vanderbilt-Featherstonehaugh" },
    { key: "8", firstName: "李", lastName: "王" },
    { key: "9", firstName: "John", lastName: "Doe" },
  ]);
  assert.equal(byKey.get("1"), "admin.user");
  assert.equal(byKey.get("2"), "john.doe");
  assert.equal(byKey.get("3"), "john.doe2");
  assert.equal(byKey.get("9"), "john.doe3");
  assert.equal(byKey.get("4"), "jose.nunez.o.brien");
  assert.equal(byKey.get("5"), "al.user");
  assert.equal(byKey.get("6"), "user6");
  assert.equal(byKey.get("8"), "user8");
  for (const u of byKey.values()) assert.match(u, /^[a-z0-9._]{3,30}$/, u);
  assert.equal(suffixed.length, 2);
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
