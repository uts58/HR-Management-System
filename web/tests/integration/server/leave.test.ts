import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor, IsoDate } from "@/contracts/common";
import type { ApplyForLeaveInput } from "@/contracts/leave";
import { SELF_DECISION_MESSAGE, leaveService } from "@/server/leave/service";
import { lockHrAdminSet } from "@/server/shared";
import { db, makePerson, makeUser, rejection, resetDatabase } from "./helpers";

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

const request: ApplyForLeaveInput = {
  leaveType: "SICK",
  startDate: "2026-11-20" as IsoDate,
  endDate: "2026-11-21" as IsoDate,
  reason: "Flu",
};

async function setup() {
  const hr = await makePerson("HR_ADMIN");
  const emp = await makePerson("EMPLOYEE", { firstName: "Ada", lastName: "L" });
  return { hr: hr.actor, emp: emp.actor, empId: emp.employee.id };
}

describe("leaveService", () => {
  it("an employee applies; the request is PENDING for their own employee id", async () => {
    const { emp, empId } = await setup();
    const r = await leaveService.applyForLeave(emp, {
      ...request,
      employeeId: 999,
    } as typeof request);
    expect(r).toMatchObject({
      employee: { id: empId, name: "Ada L" },
      leaveType: "SICK",
      startDate: "2026-11-20",
      endDate: "2026-11-21",
      reason: "Flu",
      status: "PENDING",
      seenByEmployee: true,
      decidedAt: null,
    });
  });

  it("bad dates and OTHER are rejected before anything is stored", async () => {
    const { emp } = await setup();
    for (const bad of [
      { ...request, startDate: "" },
      { ...request, endDate: "2026-11-19" },
      { ...request, leaveType: "OTHER" },
    ]) {
      expect(
        (await rejection(leaveService.applyForLeave(emp, bad as never))).name,
      ).toBe("ZodError");
    }
    expect(await db.leaveRequest.count()).toBe(0);
  });

  it("an account without an employee is FORBIDDEN from applying", async () => {
    const { emp } = await setup();
    expect(
      (
        await rejection(
          leaveService.applyForLeave({ ...emp, employeeId: null }, request),
        )
      ).code,
    ).toBe("FORBIDDEN");
  });

  it("decides only from PENDING; a second decision is CONFLICT", async () => {
    const { hr, emp } = await setup();
    const r = await leaveService.applyForLeave(emp, request);
    const decided = await leaveService.decideLeaveRequest(hr, r.id, "APPROVED");
    expect(decided).toMatchObject({
      status: "APPROVED",
      seenByEmployee: false,
    });
    expect(decided.decidedAt).toMatch(/Z$/);
    const row = await db.leaveRequest.findUniqueOrThrow({
      where: { id: r.id },
    });
    expect(row.decidedById).toBe(hr.userId);

    const again = await rejection(
      leaveService.decideLeaveRequest(hr, r.id, "REJECTED"),
    );
    expect(again).toMatchObject({
      code: "CONFLICT",
      message: "This leave request has already been decided.",
    });
    expect(
      (await rejection(leaveService.decideLeaveRequest(hr, 9999, "APPROVED")))
        .code,
    ).toBe("NOT_FOUND");
  });

  it("concurrent decisions: exactly one wins", async () => {
    const { hr, emp } = await setup();
    const r = await leaveService.applyForLeave(emp, request);
    const results = await Promise.allSettled([
      leaveService.decideLeaveRequest(hr, r.id, "APPROVED"),
      leaveService.decideLeaveRequest(hr, r.id, "REJECTED"),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("unseen decisions are counted and only cleared by markMyLeaveDecisionsSeen", async () => {
    const { hr, emp } = await setup();
    const a = await leaveService.applyForLeave(emp, request);
    await leaveService.applyForLeave(emp, request);
    await leaveService.decideLeaveRequest(hr, a.id, "REJECTED");

    expect(await leaveService.countMyUnseenDecisions(emp)).toBe(1);
    await leaveService.listMyLeaveRequests(emp);
    expect(await leaveService.countMyUnseenDecisions(emp)).toBe(1);
    expect(await leaveService.markMyLeaveDecisionsSeen(emp)).toBe(1);
    expect(await leaveService.countMyUnseenDecisions(emp)).toBe(0);
    expect(await leaveService.markMyLeaveDecisionsSeen(emp)).toBe(0);
  });

  it("orders history by creation time; null dates pass through", async () => {
    const { hr, emp, empId } = await setup();
    const undated = await db.leaveRequest.create({
      data: {
        employeeId: empId,
        leaveType: "CASUAL",
        startDate: null,
        endDate: null,
        createdAt: new Date("2020-01-01T00:00:00Z"),
        status: "PENDING",
      },
    });
    const fresh = await leaveService.applyForLeave(emp, request);

    const mine = await leaveService.listMyLeaveRequests(emp);
    expect(mine.map((r) => r.id)).toEqual([fresh.id, undated.id]);
    expect(mine[1]).toMatchObject({
      startDate: null,
      endDate: null,
      leaveType: "CASUAL",
    });

    const all = await leaveService.listAllLeaveRequests(hr);
    expect(all.map((r) => r.id)).toEqual([fresh.id, undated.id]);

    const queue = await leaveService.listPendingLeaveRequests(hr);
    expect(queue.map((r) => r.id)).toEqual([undated.id, fresh.id]);
    expect(await leaveService.countPendingLeaveRequests(hr)).toBe(2);
  });
});

type MatrixRole = "EMPLOYEE" | "HR_ADMIN";
const BOTH: MatrixRole[] = ["EMPLOYEE", "HR_ADMIN"];
const HR: MatrixRole[] = ["HR_ADMIN"];

describe("leaveService authorization matrix", () => {
  const calls: Record<
    keyof typeof leaveService,
    [(a: Actor) => Promise<unknown>, MatrixRole[]]
  > = {
    applyForLeave: [(a) => leaveService.applyForLeave(a, request), BOTH],
    listMyLeaveRequests: [(a) => leaveService.listMyLeaveRequests(a), BOTH],
    markMyLeaveDecisionsSeen: [
      (a) => leaveService.markMyLeaveDecisionsSeen(a),
      BOTH,
    ],
    countMyUnseenDecisions: [
      (a) => leaveService.countMyUnseenDecisions(a),
      BOTH,
    ],
    listPendingLeaveRequests: [
      (a) => leaveService.listPendingLeaveRequests(a),
      HR,
    ],
    listAllLeaveRequests: [(a) => leaveService.listAllLeaveRequests(a), HR],
    countPendingLeaveRequests: [
      (a) => leaveService.countPendingLeaveRequests(a),
      HR,
    ],
    canDecideOwnLeave: [(a) => leaveService.canDecideOwnLeave(a), HR],
    decideLeaveRequest: [
      (a) => leaveService.decideLeaveRequest(a, 999, "APPROVED"),
      HR,
    ],
  };

  for (const [name, [call, allowed]] of Object.entries(calls)) {
    for (const role of BOTH) {
      const expected = allowed.includes(role) ? "allowed" : "FORBIDDEN";
      it(`${name} as ${role}: ${expected}`, async () => {
        const { actor } = await makePerson(role);
        const result = await call(actor).then(
          () => "allowed",
          (e: { code?: string }) =>
            e.code === "NOT_FOUND" ? "allowed" : e.code,
        );
        expect(result).toBe(expected);
      });
    }
  }
});

describe("leaveService: HR admins' own leave (rule 7a)", () => {
  async function twoAdmins() {
    const a = await makePerson("HR_ADMIN", { firstName: "Ana", lastName: "A" });
    const b = await makePerson("HR_ADMIN", { firstName: "Ben", lastName: "B" });
    return { a, b };
  }

  it("an HR admin applies and sees the request in their history", async () => {
    const { a } = await twoAdmins();
    const r = await leaveService.applyForLeave(a.actor, request);
    expect(r).toMatchObject({
      employee: { id: a.employee.id },
      status: "PENDING",
      selfApproved: false,
    });
    const mine = await leaveService.listMyLeaveRequests(a.actor);
    expect(mine.map((x) => x.id)).toEqual([r.id]);
  });

  it("another HR admin can decide it; it is not self-approved", async () => {
    const { a, b } = await twoAdmins();
    const r = await leaveService.applyForLeave(a.actor, request);
    const decided = await leaveService.decideLeaveRequest(
      b.actor,
      r.id,
      "APPROVED",
    );
    expect(decided).toMatchObject({ status: "APPROVED", selfApproved: false });
    expect(await leaveService.countMyUnseenDecisions(a.actor)).toBe(1);
  });

  it("deciding your own request with another active admin is FORBIDDEN and changes nothing", async () => {
    const { a } = await twoAdmins();
    const r = await leaveService.applyForLeave(a.actor, request);
    expect(await leaveService.canDecideOwnLeave(a.actor)).toBe(false);
    for (const d of ["APPROVED", "REJECTED"] as const) {
      const err = await rejection(
        leaveService.decideLeaveRequest(a.actor, r.id, d),
      );
      expect(err).toMatchObject({
        code: "FORBIDDEN",
        message: SELF_DECISION_MESSAGE,
      });
    }
    const row = await db.leaveRequest.findUniqueOrThrow({
      where: { id: r.id },
    });
    expect(row).toMatchObject({
      status: "PENDING",
      decidedById: null,
      selfApproved: false,
    });
  });

  it("the sole active HR admin can decide their own request; it is marked self-approved", async () => {
    const a = await makePerson("HR_ADMIN");
    await makePerson("EMPLOYEE");
    const r = await leaveService.applyForLeave(a.actor, request);
    expect(await leaveService.canDecideOwnLeave(a.actor)).toBe(true);
    const decided = await leaveService.decideLeaveRequest(
      a.actor,
      r.id,
      "APPROVED",
    );
    expect(decided).toMatchObject({ status: "APPROVED", selfApproved: true });
    const row = await db.leaveRequest.findUniqueOrThrow({
      where: { id: r.id },
    });
    expect(row).toMatchObject({ decidedById: a.user.id, selfApproved: true });
    const [mine] = await leaveService.listMyLeaveRequests(a.actor);
    expect(mine).toMatchObject({ id: r.id, selfApproved: true });
  });

  it("a terminated or disabled second admin doesn't count", async () => {
    const { a, b } = await twoAdmins();
    const r = await leaveService.applyForLeave(a.actor, request);
    await db.employee.update({
      where: { id: b.employee.id },
      data: { employmentStatus: "TERMINATED", terminatedAt: new Date() },
    });
    const c = await makePerson("HR_ADMIN");
    await db.user.update({
      where: { id: c.user.id },
      data: { disabledAt: new Date() },
    });
    expect(await leaveService.canDecideOwnLeave(a.actor)).toBe(true);
    const decided = await leaveService.decideLeaveRequest(
      a.actor,
      r.id,
      "REJECTED",
    );
    expect(decided).toMatchObject({ status: "REJECTED", selfApproved: true });
  });

  it("an HR admin login without an employee record counts as another admin", async () => {
    const a = await makePerson("HR_ADMIN");
    await makeUser(null, "HR_ADMIN");
    const r = await leaveService.applyForLeave(a.actor, request);
    const err = await rejection(
      leaveService.decideLeaveRequest(a.actor, r.id, "APPROVED"),
    );
    expect(err.code).toBe("FORBIDDEN");
  });

  it("a self-decision waits for a concurrent admin change and then sees it", async () => {
    const a = await makePerson("HR_ADMIN");
    const r = await leaveService.applyForLeave(a.actor, request);
    let locked = false;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    const holder = db.$transaction(
      async (tx) => {
        await lockHrAdminSet(tx);
        locked = true;
        const second = await tx.employee.create({
          data: { firstName: "New", lastName: "Admin" },
        });
        await tx.user.create({
          data: {
            id: "second-admin",
            name: "second",
            email: "second@users.invalid",
            emailIsPlaceholder: true,
            username: "second",
            role: "HR_ADMIN",
            employeeId: second.id,
          },
        });
        await gate;
      },
      { timeout: 20_000 },
    );
    while (!locked) await new Promise((t) => setTimeout(t, 10));
    const decision = rejection(
      leaveService.decideLeaveRequest(a.actor, r.id, "APPROVED"),
    );
    await new Promise((t) => setTimeout(t, 300));
    release();
    await holder;
    expect((await decision).code).toBe("FORBIDDEN");
  });
});
