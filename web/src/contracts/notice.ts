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

/** Default number of notices on the login page and dashboard (legacy showed 5). */
export const RECENT_NOTICE_LIMIT = 5;

export interface NoticeService {
  /**
   * PUBLIC, no actor: the login page shows recent notices to anonymous
   * visitors (legacy parity; Security to confirm this stays public).
   * Newest first, at most `limit` (default RECENT_NOTICE_LIMIT).
   */
  listPublicNotices(limit?: number): Promise<Notice[]>;

  /** Any signed-in role. Dashboard list, newest first. */
  listRecentNotices(actor: Actor, limit?: number): Promise<Notice[]>;

  /** HR_ADMIN. All notices, newest first. */
  listNotices(actor: Actor): Promise<Notice[]>;

  /** HR_ADMIN. Throws VALIDATION. */
  createNotice(actor: Actor, input: CreateNoticeInput): Promise<Notice>;

  /** HR_ADMIN. Throws NOT_FOUND. */
  deleteNotice(actor: Actor, id: NoticeId): Promise<void>;
}
