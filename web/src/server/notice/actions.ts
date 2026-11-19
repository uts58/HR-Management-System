"use server";

import { Role } from "@/contracts/auth";
import {
  createNoticeSchema,
  deleteNoticeSchema,
} from "@/lib/validation/notice";
import { defineAction } from "@/server/action";
import { revalidateApp } from "../revalidate";
import { noticeService } from "./service";

export const createNotice = defineAction({
  role: Role.HR_ADMIN,
  schema: createNoticeSchema,
  handler: async (actor, input) => {
    const notice = await noticeService.createNotice(actor, input);
    revalidateApp();
    return notice;
  },
});

export const deleteNotice = defineAction({
  role: Role.HR_ADMIN,
  schema: deleteNoticeSchema,
  handler: async (actor, { id }) => {
    await noticeService.deleteNotice(actor, id);
    revalidateApp();
  },
});
