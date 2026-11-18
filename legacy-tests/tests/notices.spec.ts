import { test, expect } from '../support/fixtures';
import { seedNoticeTitle, uid } from '../support/data';
import { routes } from '../support/routes';

test.describe('Notices', () => {
  test('seeded notice is shown on the dashboard', async ({ employee }) => {
    await expect(employee.notices.recentNotices()).toContainText(seedNoticeTitle);
  });

  test('HR posts an urgent notice: listed, on both dashboards and on the public login page', async ({ hr, employee, app }) => {
    const title = uid('Urgent: fire drill');
    await hr.notices.open();
    await hr.notices.post(title, 'Fire drill at 3pm, assemble in the car park.', 'Urgent');
    await hr.notices.expectPosted();
    await expect(hr.notices.row(title)).toContainText('Fire drill at 3pm');

    await hr.notices.gotoDashboard();
    await expect(hr.notices.recentNotices()).toContainText(title);

    await employee.notices.gotoDashboard();
    await expect(employee.notices.recentNotices()).toContainText(title);

    await app.page.goto(routes.login);
    await expect(app.notices.recentNotices()).toContainText(title);
  });

  test('a general notice is shown to logged-in users but not on the public login page', async ({ hr, employee, app }) => {
    const title = uid('General: new coffee machine');
    await hr.notices.open();
    await hr.notices.post(title, 'Second floor kitchen.', 'General');
    await hr.notices.expectPosted();

    await employee.notices.gotoDashboard();
    await expect(employee.notices.recentNotices()).toContainText(title);

    await app.page.goto(routes.login);
    await expect(app.notices.recentNotices()).not.toContainText(title);
  });

  test('notice body can be expanded from the dashboard', async ({ hr, employee }) => {
    const title = uid('Holiday: office closed');
    const body = 'The office is closed on Friday.';
    await hr.notices.open();
    await hr.notices.post(title, body, 'Holiday');
    await employee.notices.gotoDashboard();
    const panel = employee.notices.recentNotices();
    await panel.getByText(title).click();
    await expect(panel.getByText(body)).toBeVisible();
  });

  test('HR deletes a notice and it disappears everywhere', async ({ hr, employee }) => {
    const title = uid('Urgent: delete me');
    await hr.notices.open();
    await hr.notices.post(title, 'Temporary.', 'Urgent');
    await expect(hr.notices.row(title)).toBeVisible();
    await hr.notices.delete(title);
    await expect(hr.notices.row(title)).toHaveCount(0);

    await employee.notices.gotoDashboard();
    await expect(employee.notices.recentNotices()).not.toContainText(title);
  });
});
