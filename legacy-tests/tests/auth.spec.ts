import { test, expect, users } from '../support/fixtures';
import { routes } from '../support/routes';

test.describe('Authentication', () => {
  test('HR can log in and sees the HR dashboard and menu', async ({ app }) => {
    await app.login.loginAs(users.hr);
    for (const link of ['Add new employee', 'Manage Employee', 'Manage Department', 'Manage Position', 'Manage Notice', 'Assign', 'View Leave Dates', 'Add Appraisal', 'Manage Appraisal']) {
      await expect(app.nav.link(link), `HR menu should contain "${link}"`).toHaveCount(1);
    }
  });

  test('employee can log in and sees only the employee menu', async ({ app }) => {
    await app.login.loginAs(users.john);
    await expect(app.nav.link('Leave Request')).toHaveCount(1);
    await expect(app.nav.link('View Leave History')).toHaveCount(1);
    await expect(app.nav.link('View Profile')).toHaveCount(1);
    for (const link of ['Add new employee', 'Manage Employee', 'Manage Notice', 'Assign', 'Add Appraisal']) {
      await expect(app.nav.link(link), `employee menu must not contain "${link}"`).toHaveCount(0);
    }
  });

  test('username match is case-insensitive', async ({ app }) => {
    await app.login.attempt('ADMIN', users.hr.password);
    await app.login.expectLoggedIn('ADMIN');
  });

  test('wrong password is rejected', async ({ app }) => {
    await app.login.attempt(users.hr.username, 'not-the-password');
    await app.login.expectRejected();
  });

  test('unknown user is rejected', async ({ app }) => {
    await app.login.attempt('nobody-here', 'whatever');
    await app.login.expectRejected();
  });

  test('password is case-sensitive', async ({ app }) => {
    await app.login.attempt(users.hr.username, users.hr.password.toUpperCase());
    await app.login.expectRejected();
  });

  test('empty username or password shows a validation message', async ({ app }) => {
    await app.login.attempt('', 'x');
    await app.login.expectRejected(/enter the username|username is required/i);
    await app.login.attempt(users.hr.username, '');
    await app.login.expectRejected(/enter the password|password is required/i);
  });

  test('logout ends the session', async ({ app }) => {
    await app.login.loginAs(users.john);
    await app.nav.logout();
    await app.login.expectOnLoginPage();
    await app.page.goto(routes.home);
    await app.login.expectOnLoginPage();
  });

  test('anonymous visitors are sent to the login page', async ({ app }) => {
    for (const path of [routes.home, routes.employeeList, routes.departments, routes.notices, routes.pendingLeave, routes.appraisals, routes.myLeaveHistory, routes.changePassword, routes.myProfile]) {
      await app.page.goto(path);
      await expect(app.page, `${path} should redirect anonymous users`).toHaveURL(/\/(login)?$/);
      await app.login.expectOnLoginPage();
    }
  });
});
