import type { Actor, NoticeId, UtcTimestamp } from "./common";

export const NOTICE_TYPES = ["GENERAL", "URGENT", "HOLIDAY"] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export interface Notice {
  id: NoticeId;
  title: string;
  body: string;
  type: NoticeType;
  createdAt: UtcTimestamp;
}

export interface CreateNoticeInput {
  title: string;
  body: string;
  type: NoticeType;
}

export const RECENT_NOTICE_LIMIT = 5;

export interface NoticeService {
  listRecentNotices(actor: Actor, limit?: number): Promise<Notice[]>;

  listNotices(actor: Actor): Promise<Notice[]>;

  createNotice(actor: Actor, input: CreateNoticeInput): Promise<Notice>;

  deleteNotice(actor: Actor, id: NoticeId): Promise<void>;
}
