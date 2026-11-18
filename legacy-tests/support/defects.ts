import { test } from '@playwright/test';

/**
 * Status of each known legacy defect (IDs from docs/qa/feature-inventory.md, section 11).
 *
 * - open:    test asserts the correct behaviour and is expected to FAIL on legacy (test.fail).
 * - fixed:   fixed in legacy by the Security lead's hardening (merge ab2c98d); test must PASS.
 * - partial: mitigated only; any test for the fixed part must PASS, and the remaining gap is
 *            documented in the inventory.
 *
 * Only defects with an E2E test call knownDefect(); the rest are listed for completeness.
 */
export const defectStatus: Record<string, 'open' | 'fixed' | 'partial'> = {
  'SEC-01': 'fixed', 'SEC-02': 'fixed', 'SEC-03': 'fixed', 'SEC-04': 'fixed',
  'SEC-05': 'fixed', 'SEC-06': 'fixed', 'SEC-07': 'fixed',
  'BUG-01': 'fixed', 'BUG-02': 'fixed', 'BUG-03': 'fixed', 'BUG-04': 'fixed',
  'BUG-05': 'fixed', 'BUG-07': 'fixed', 'BUG-09': 'fixed', 'BUG-10': 'fixed',
  'BUG-21': 'fixed',
  'BUG-15': 'partial', // broken scripts removed; login labels still not linked to inputs
  'BUG-17': 'partial', // welcome now shows the stored name (side effect of the session fix)
  'BUG-24': 'partial', // multi-candidate login, capped at 10 same-named accounts; names still not unique
  'BUG-06': 'open', 'BUG-08': 'open', 'BUG-11': 'open', 'BUG-12': 'open', 'BUG-13': 'open',
  'BUG-14': 'open', 'BUG-16': 'open', 'BUG-18': 'open', 'BUG-19': 'open', 'BUG-20': 'open',
  'BUG-22': 'open', 'BUG-23': 'open',
};

/**
 * Marks the current test as asserting the CORRECT behaviour for a known legacy defect.
 * Open defects are expected to fail (Playwright `test.fail`); if one starts passing,
 * Playwright reports it as a failure, which means: update defectStatus.
 *
 * Env overrides:
 *   FIXED_DEFECTS=BUG-06,BUG-12  also treat these as fixed.
 *   FIXED_DEFECTS=all            no expected failures (target for web/ parity runs).
 *   LEGACY_BASELINE=unpatched    ignore defectStatus and expect every defect to fail
 *                                (to run against the pre-hardening legacy code, commit 4f8c6bc).
 */
export function knownDefect(id: string, summary: string) {
  const key = id.toUpperCase();
  const extra = (process.env.FIXED_DEFECTS || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const unpatched = process.env.LEGACY_BASELINE === 'unpatched';
  const status = unpatched ? 'open' : defectStatus[key] ?? 'open';
  test.info().annotations.push({ type: 'defect', description: `${id} [${status}]: ${summary}` });
  if (status !== 'open' || extra.includes('ALL') || extra.includes(key)) return;
  test.fail(true, `${id}: ${summary}`);
}
