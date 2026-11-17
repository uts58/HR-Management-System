/**
 * Notice domain contract. Implemented by Backend in web/src/server/notice/.
 * Business rules: docs/architecture/contracts.md#notice
 */

import type { Actor, NoticeId, Timestamp } from './common';

/** Legacy `notice.type`: 0 = general, 1 = urgent, 2 = holiday. */
export const NOTICE_TYPES = ['GENERAL', 'URGENT', 'HOLIDAY'] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export interface Notice {
  id: NoticeId;
  title: string;
  body: string;
  type: NoticeType;
  /** Legacy `date` was a locale string; migrated values are parsed or left null. */
  createdAt: Timestamp | null;
}

export interface CreateNoticeInput {
  title: string; // trimmed, 1..200
  body: string; // trimmed, 1..5000
  type: NoticeType; // default GENERAL in the form
}

/** Default number of notices on the dashboard (legacy showed 5). */
export const RECENT_NOTICE_LIMIT = 5;

export interface NoticeService {
  // No anonymous access: notices are internal and live behind login.
  // Legacy showed them on the public login page (intentional change).

  /** Any signed-in role. Dashboard list, newest first, at most `limit` (default RECENT_NOTICE_LIMIT). */
  listRecentNotices(actor: Actor, limit?: number): Promise<Notice[]>;

  /** HR_ADMIN. All notices, newest first. */
  listNotices(actor: Actor): Promise<Notice[]>;

  /** HR_ADMIN. Throws VALIDATION. */
  createNotice(actor: Actor, input: CreateNoticeInput): Promise<Notice>;

  /** HR_ADMIN. Throws NOT_FOUND. */
  deleteNotice(actor: Actor, id: NoticeId): Promise<void>;
}
