import { test, expect } from '../support/fixtures';
import { john, uid } from '../support/data';
import { knownDefect } from '../support/defects';

test.describe('Performance appraisals (HR)', () => {
  test('HR adds an appraisal and sees it in the list', async ({ hr }) => {
    const project = uid('Project Apollo');
    await hr.performance.add({ employee: john.fullName, project, start: '2026-01-01', end: '2026-06-30', rating: 4 });
    await hr.performance.expectSaved();
    await hr.performance.openList();
    const row = hr.performance.row(project);
    await expect(row).toContainText(john.fullName);
    await expect(row).toContainText('2026-01-01');
    await expect(row).toContainText('2026-06-30');
    await expect(row).toContainText('4/5');
  });

  test('HR deletes an appraisal', async ({ hr }) => {
    const project = uid('Project Delete');
    await hr.performance.add({ employee: john.fullName, project, start: '2026-02-01', end: '2026-03-01', rating: 2 });
    await hr.performance.openList();
    await expect(hr.performance.row(project)).toBeVisible();
    await hr.performance.delete(project);
    await expect(hr.performance.row(project)).toHaveCount(0);
  });

  test('appraisal without an employee is rejected with an error', async ({ hr }) => {
    knownDefect('BUG-11', 'missing employee makes the insert throw; user is bounced back with no message');
    const project = uid('Project Nobody');
    await hr.performance.add({ project, start: '2026-01-01', end: '2026-02-01', rating: 3 });
    await expect(hr.page.getByText(/appraisal saved successfully/i)).toHaveCount(0);
    await expect(hr.page.getByText(/select an employee|employee is required|required/i)).toBeVisible();
  });
});
