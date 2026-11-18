import { test, expect } from '../support/fixtures';
import { john, uid } from '../support/data';
import { knownDefect } from '../support/defects';
import { routes } from '../support/routes';

test.describe('Leave', () => {
  test('employee applies; HR approves; employee sees Approved', async ({ employee, hr }) => {
    const reason = uid('Family trip');
    await employee.leave.apply({ type: 'Annual Leave', from: '2026-12-20', to: '2026-12-24', reason });
    await employee.leave.expectSubmitted();
    await employee.leave.openMyHistory();
    await employee.leave.expectStatus(reason, 'Pending');
    await expect(employee.leave.row(reason)).toContainText('Annual Leave');

    await hr.leave.openPending();
    const row = hr.leave.row(reason);
    await expect(row).toContainText(john.fullName);
    await expect(row).toContainText('2026-12-20');
    await expect(row).toContainText('2026-12-24');
    await hr.leave.decide(reason, 'Approve');
    await expect(hr.leave.row(reason)).toHaveCount(0);

    await hr.leave.openAll();
    await hr.leave.expectStatus(reason, 'Approved');

    await employee.page.goto(routes.home);
    // Dashboard tells the employee their request was decided (legacy text: "The admin views your Leave request").
    await expect(employee.page.locator('#main, main').first().getByRole('link', { name: /leave/i })).toBeVisible();
    await employee.leave.openMyHistory();
    await employee.leave.expectStatus(reason, 'Approved');
  });

  test('employee applies; HR rejects; employee sees Rejected', async ({ employee, hr }) => {
    const reason = uid('Long weekend');
    await employee.leave.apply({ type: 'Casual Leave', from: '2027-01-08', to: '2027-01-09', reason });
    await employee.leave.expectSubmitted();

    await hr.leave.openPending();
    await hr.leave.decide(reason, 'Reject');
    await expect(hr.leave.row(reason)).toHaveCount(0);
    await hr.leave.openAll();
    await hr.leave.expectStatus(reason, 'Rejected');

    await employee.leave.openMyHistory();
    await employee.leave.expectStatus(reason, 'Rejected');
  });

  test('decision notification clears once the employee has seen their history', async ({ employee, hr }) => {
    const reason = uid('Dentist');
    await employee.leave.apply({ type: 'Sick Leave', from: '2027-02-01', to: '2027-02-01', reason });
    await hr.leave.openPending();
    await hr.leave.decide(reason, 'Approve');

    const notification = employee.page.locator('#main, main').first().getByRole('link', { name: /leave/i });
    await employee.page.goto(routes.home);
    await expect(notification).toBeVisible();
    await employee.leave.openMyHistory();
    await employee.page.goto(routes.home);
    await expect(notification).toHaveCount(0);
  });

  test('HR dashboard shows a pending leave notification linking to pending requests', async ({ employee, hr }) => {
    knownDefect('BUG-06', 'HR dashboard shows the employee message "The admin views your Leave request" linking to /viewLeave');
    await employee.leave.apply({ type: 'Sick Leave', from: '2027-03-01', to: '2027-03-02', reason: uid('Flu') });
    await hr.page.goto(routes.home);
    const link = hr.page.locator('#main, main').first().getByRole('link', { name: /leave application|pending leave/i });
    await expect(link).toBeVisible();
    await link.click();
    await expect(hr.page.getByRole('heading', { name: /pending leave requests/i })).toBeVisible();
  });

  test('leave with end date before start date is rejected', async ({ employee }) => {
    knownDefect('BUG-12', 'leave dates are free text with no validation (empty, malformed, end < start all accepted)');
    const reason = uid('Backwards');
    await employee.leave.apply({ type: 'Annual Leave', from: '2027-05-10', to: '2027-05-01', reason });
    await expect(employee.page.getByText(/leave request submitted successfully/i)).toHaveCount(0);
    await employee.leave.openMyHistory();
    await expect(employee.leave.row(reason)).toHaveCount(0);
  });
});
