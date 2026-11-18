/** Users and reference data loaded by fixtures/seed.sql. Keep the two in sync. */

export interface TestUser {
  username: string;
  password: string;
  fullName: string;
  id: number;
}

export const users = {
  hr: { id: 1, username: 'admin', password: 'admin123', fullName: 'Admin User' },
  john: { id: 2, username: 'john', password: 'emp123', fullName: 'John Doe' },
  mary: { id: 3, username: 'mary', password: 'mary123', fullName: 'Mary Major' },
  temp: { id: 4, username: 'temp', password: 'temp123', fullName: 'Temp Worker' },
  paula: { id: 5, username: 'paula', password: 'paula123', fullName: 'Paula Weak' },
  olive: { id: 6, username: 'olive', password: 'olive123', fullName: 'Olive Occupant' },
  gone: { id: 7, username: 'gone', password: 'gone123', fullName: 'Gone Soon' },
} satisfies Record<string, TestUser>;

export const john = {
  ...users.john,
  displayName: 'John A Doe',
  department: 'Engineering',
  position: 'Software Engineer',
  email: 'john.doe@company.com',
  country: 'USA',
  homeTown: 'New York',
  contact: '555-0100',
};

export const occupied = {
  department: 'QA Occupied Department',
  position: 'QA Occupied Position',
};

export const seedNoticeTitle = 'Welcome to the HR Portal';

/** Unique suffix so data created by one run/test never collides with another. */
export function uid(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}
