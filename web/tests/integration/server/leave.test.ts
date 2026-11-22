import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { IsoDate } from "@/contracts/common";
import type { ApplyForLeaveInput } from "@/contracts/leave";
import { leaveService } from "@/server/leave/service";
import { db, makePerson, rejection, resetDatabase } from "./helpers";

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

  it("HR can't apply (parity) and an account without an employee is FORBIDDEN", async () => {
    const { hr, emp } = await setup();
    expect(
      (await rejection(leaveService.applyForLeave(hr, request))).code,
    ).toBe("FORBIDDEN");
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

  it("role gates: employees can't see the queue; HR has no 'my leave'", async () => {
    const { hr, emp } = await setup();
    expect(
      (await rejection(leaveService.listPendingLeaveRequests(emp))).code,
    ).toBe("FORBIDDEN");
    expect(
      (await rejection(leaveService.decideLeaveRequest(emp, 1, "APPROVED")))
        .code,
    ).toBe("FORBIDDEN");
    expect((await rejection(leaveService.listMyLeaveRequests(hr))).code).toBe(
      "FORBIDDEN",
    );
  });
});
