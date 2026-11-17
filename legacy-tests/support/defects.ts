import { test } from '@playwright/test';

/**
 * Marks the current test as asserting the CORRECT behaviour for a known legacy defect.
 * The test is expected to fail on the legacy app (Playwright `test.fail`); if it starts
 * passing, Playwright reports it as a failure so we notice the defect was fixed.
 *
 * IDs refer to docs/qa/feature-inventory.md ("Known defects").
 *
 * FIXED_DEFECTS=SEC-01,BUG-05  treat those defects as fixed (tests must pass normally).
 *                              Use this after the Security lead's patch lands.
 * FIXED_DEFECTS=all            no expected failures at all (target for web/ parity runs).
 */
export function knownDefect(id: string, summary: string) {
  const fixed = (process.env.FIXED_DEFECTS || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  test.info().annotations.push({ type: 'defect', description: `${id}: ${summary}` });
  if (fixed.includes('ALL') || fixed.includes(id.toUpperCase())) return;
  test.fail(true, `${id}: ${summary}`);
}
