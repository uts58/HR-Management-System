import { z } from "zod";
import { NOTICE_TYPES, type CreateNoticeInput } from "@/contracts/notice";
import { enumField, idInputSchema, requiredText } from "./common";

export const NOTICE_TITLE_MAX = 200;
export const NOTICE_BODY_MAX = 5000;

export const createNoticeSchema = z.object({
  title: requiredText("Title", NOTICE_TITLE_MAX),
  body: requiredText("Notice text", NOTICE_BODY_MAX),
  type: enumField(NOTICE_TYPES, "Select a notice type"),
}) satisfies z.ZodType<CreateNoticeInput>;

export const deleteNoticeSchema = idInputSchema;
