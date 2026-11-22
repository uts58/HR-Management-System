import "server-only";

import { Role } from "@/contracts/auth";
import type { NoticeId } from "@/contracts/common";
import {
  RECENT_NOTICE_LIMIT,
  type Notice,
  type NoticeService,
} from "@/contracts/notice";
import type { Prisma } from "@/generated/prisma/client";
import { toIsoInstantOrNull } from "@/lib/dates";
import { entityIdSchema } from "@/lib/validation/common";
import { createNoticeSchema } from "@/lib/validation/notice";
import { db } from "../db";
import { notFoundError } from "../errors";
import { assertRole, newestFirst } from "../shared";

export const MAX_RECENT_NOTICES = 50;

const noticeSelect = {
  id: true,
  title: true,
  body: true,
  type: true,
  createdAt: true,
} as const satisfies Prisma.NoticeSelect;

type NoticeRow = Prisma.NoticeGetPayload<{ select: typeof noticeSelect }>;

function toNotice(r: NoticeRow): Notice {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type,
    createdAt: toIsoInstantOrNull(r.createdAt),
  };
}

export const noticeService: NoticeService = {
  async listRecentNotices(actor, limit = RECENT_NOTICE_LIMIT) {
    assertRole(actor, Role.HR_ADMIN, Role.EMPLOYEE);
    const take = Number.isInteger(limit)
      ? Math.min(Math.max(limit, 1), MAX_RECENT_NOTICES)
      : RECENT_NOTICE_LIMIT;
    const rows = await db.notice.findMany({
      select: noticeSelect,
      orderBy: newestFirst(),
      take,
    });
    return rows.map(toNotice);
  },

  async listNotices(actor) {
    assertRole(actor, Role.HR_ADMIN);
    const rows = await db.notice.findMany({
      select: noticeSelect,
      orderBy: newestFirst(),
    });
    return rows.map(toNotice);
  },

  async createNotice(actor, input) {
    assertRole(actor, Role.HR_ADMIN);
    const data = createNoticeSchema.parse(input);
    return toNotice(await db.notice.create({ data, select: noticeSelect }));
  },

  async deleteNotice(actor, rawId: NoticeId) {
    assertRole(actor, Role.HR_ADMIN);
    const id = entityIdSchema.parse(rawId);
    const { count } = await db.notice.deleteMany({ where: { id } });
    if (count === 0) throw notFoundError("This notice was not found.");
  },
};
