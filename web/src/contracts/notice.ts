/**
 * Notice domain contract. Implemented in web/src/server/notice/.
 * Business rules: docs/architecture/contracts.md#notice
 */

import type { Actor, NoticeId, UtcTimestamp } from "./common";

export const NOTICE_TYPES = ["GENERAL", "URGENT", "HOLIDAY"] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export interface Notice {
  id: NoticeId;
  title: string;
  body: string;
  type: NoticeType;
  createdAt: UtcTimestamp | null;
}

export interface CreateNoticeInput {
  title: string; // trimmed, 1..200
  body: string; // trimmed, 1..5000
  type: NoticeType; // default GENERAL in the form
}

/** Default number of notices on the dashboard. */
export const RECENT_NOTICE_LIMIT = 5;

export interface NoticeService {
  // No anonymous access: notices are internal and live behind login.

  /**
   * Any signed-in role. Dashboard list, newest first, at most `limit`
   * (default RECENT_NOTICE_LIMIT).
   */
  listRecentNotices(actor: Actor, limit?: number): Promise<Notice[]>;

  /** HR_ADMIN. All notices, newest first. */
  listNotices(actor: Actor): Promise<Notice[]>;

  /** HR_ADMIN. Throws VALIDATION. */
  createNotice(actor: Actor, input: CreateNoticeInput): Promise<Notice>;

  /** HR_ADMIN. Throws NOT_FOUND. */
  deleteNotice(actor: Actor, id: NoticeId): Promise<void>;
}
