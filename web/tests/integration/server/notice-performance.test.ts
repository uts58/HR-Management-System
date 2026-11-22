import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { IsoDate } from "@/contracts/common";
import { noticeService } from "@/server/notice/service";
import { performanceService } from "@/server/performance/service";
import {
  db,
  makeEmployee,
  makePerson,
  rejection,
  resetDatabase,
} from "./helpers";

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("noticeService", () => {
  it("HR creates; everyone signed in sees recent notices newest first", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    const emp = (await makePerson("EMPLOYEE")).actor;
    await db.notice.create({
      data: { title: "Legacy", body: "old", type: "GENERAL", createdAt: null },
    });
    const first = await noticeService.createNotice(hr, {
      title: " Holiday ",
      body: "Office closed",
      type: "HOLIDAY",
    });
    expect(first).toMatchObject({ title: "Holiday", type: "HOLIDAY" });
    expect(first.createdAt).toMatch(ISO_Z);
    await new Promise((r) => setTimeout(r, 5));
    await noticeService.createNotice(hr, {
      title: "Urgent",
      body: "Fire drill",
      type: "URGENT",
    });

    const recent = await noticeService.listRecentNotices(emp);
    expect(recent.map((n) => n.title)).toEqual(["Urgent", "Holiday", "Legacy"]);
    expect(recent[2]?.createdAt).toBeNull();
    expect(
      (await noticeService.listRecentNotices(emp, 1)).map((n) => n.title),
    ).toEqual(["Urgent"]);
    expect(await noticeService.listNotices(hr)).toHaveLength(3);
  });

  it("limits the dashboard to 5 by default", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    for (let i = 0; i < 7; i++) {
      await noticeService.createNotice(hr, {
        title: `N${i}`,
        body: "b",
        type: "GENERAL",
      });
    }
    expect(await noticeService.listRecentNotices(hr)).toHaveLength(5);
  });

  it("employees can't manage notices; deleting an unknown notice is NOT_FOUND", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    const emp = (await makePerson("EMPLOYEE")).actor;
    expect(
      (
        await rejection(
          noticeService.createNotice(emp, {
            title: "x",
            body: "y",
            type: "GENERAL",
          }),
        )
      ).code,
    ).toBe("FORBIDDEN");
    expect((await rejection(noticeService.listNotices(emp))).code).toBe(
      "FORBIDDEN",
    );
    expect((await rejection(noticeService.deleteNotice(hr, 999))).code).toBe(
      "NOT_FOUND",
    );
  });

  it("deletes a notice", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    const n = await noticeService.createNotice(hr, {
      title: "Bye",
      body: "b",
      type: "GENERAL",
    });
    await noticeService.deleteNotice(hr, n.id);
    expect(await noticeService.listNotices(hr)).toEqual([]);
  });
});

describe("performanceService", () => {
  const valid = {
    projectName: "Apollo",
    projectStart: "2026-01-01" as IsoDate,
    projectEnd: "2026-06-30" as IsoDate,
    rating: 4 as const,
  };

  it("creates an appraisal for an active employee", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    const target = await makeEmployee({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    const a = await performanceService.createAppraisal(hr, {
      ...valid,
      employeeId: target.id,
    });
    expect(a).toMatchObject({
      employee: {
        id: target.id,
        name: "Ada Lovelace",
        status: "ACTIVE",
      },
      projectName: "Apollo",
      projectStart: "2026-01-01",
      projectEnd: "2026-06-30",
      rating: 4,
    });
    expect(a.createdAt).toMatch(ISO_Z);
  });

  it("BUG-11: unknown or terminated employee is VALIDATION on employeeId", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    const terminated = await makeEmployee({
      employmentStatus: "TERMINATED",
      terminatedAt: new Date(),
    });
    for (const employeeId of [9999, terminated.id]) {
      const e = await rejection(
        performanceService.createAppraisal(hr, { ...valid, employeeId }),
      );
      expect(e).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { employeeId: ["Select an active employee"] },
      });
    }
    expect(await db.appraisal.count()).toBe(0);
  });

  it("lists terminated employees' history newest first, null dates kept", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    const gone = await makeEmployee({
      firstName: "Gone",
      lastName: "Away",
      employmentStatus: "TERMINATED",
      terminatedAt: new Date(),
    });
    await db.appraisal.create({
      data: {
        employeeId: gone.id,
        projectName: null,
        projectStart: null,
        projectEnd: null,
        rating: 3,
        createdAt: null,
      },
    });
    const target = await makeEmployee();
    await performanceService.createAppraisal(hr, {
      ...valid,
      employeeId: target.id,
    });
    const list = await performanceService.listAppraisals(hr);
    expect(list.map((a) => a.employee.name)).toEqual([
      "Test Person",
      "Gone Away",
    ]);
    expect(list[1]).toMatchObject({
      projectStart: null,
      projectEnd: null,
      createdAt: null,
      employee: { status: "TERMINATED" },
    });
  });

  it("is HR-only; deleting an unknown appraisal is NOT_FOUND", async () => {
    const hr = (await makePerson("HR_ADMIN")).actor;
    const emp = (await makePerson("EMPLOYEE")).actor;
    expect((await rejection(performanceService.listAppraisals(emp))).code).toBe(
      "FORBIDDEN",
    );
    expect(
      (await rejection(performanceService.deleteAppraisal(hr, 42))).code,
    ).toBe("NOT_FOUND");
  });
});
