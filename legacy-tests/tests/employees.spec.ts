import { test, expect, users } from '../support/fixtures';
import { john, uid } from '../support/data';
import { knownDefect } from '../support/defects';
import { rowAction } from '../support/pages/base';

test.describe('Employees (HR)', () => {
  test('employee list shows name, position and email', async ({ hr }) => {
    await hr.employees.openList();
    const row = hr.employees.row(john.displayName);
    await expect(row).toBeVisible();
    await expect(row).toContainText(john.position);
    await expect(row).toContainText(john.email);
    await expect(row.getByRole('link', { name: /view details/i })).toBeVisible();
    await expect(row.getByRole('link', { name: /edit/i })).toBeVisible();
    await expect(rowAction(row, /delete/i)).toBeVisible();
  });

  test('HR can view an employee\'s details', async ({ hr }) => {
    await hr.employees.openList();
    await hr.employees.openDetails(john.displayName);
    await hr.employees.expectDetails([
      john.displayName, String(john.id), john.department, john.position, john.country,
      john.homeTown, john.contact, john.email, 'Male', 'single', '01 Jan 1990',
    ]);
  });

  test('add employee form offers the current departments and positions', async ({ hr }) => {
    await hr.employees.openAdd();
    const dep = hr.page.locator('select[name="department"]');
    const pos = hr.page.locator('select[name="position"]');
    await expect(dep.locator('option', { hasText: 'Engineering' })).toHaveCount(1);
    await expect(pos.locator('option', { hasText: 'Software Engineer' })).toHaveCount(1);
  });

  test('HR can add an employee and it appears in the list', async ({ hr }) => {
    knownDefect('BUG-01', 'add-employee form posts multipart/form-data which the server never parses; nothing is saved');
    const last = uid('Newhire').replace(' ', '');
    await hr.employees.add({
      firstName: 'Nina', lastName: last, department: 'Finance', position: 'Accountant',
      country: 'Canada', homeTown: 'Ottawa', contact: '5550199', email: 'nina@company.com',
      gender: 'Female', maritalStatus: 'Single', dateOfBirth: '10 Oct 1995',
    });
    await hr.employees.expectSaved();
    await hr.employees.openList();
    await expect(hr.employees.row(last)).toContainText('Accountant');
  });

  test('a newly added employee can log in with the credentials HR is shown', async ({ hr, app }) => {
    knownDefect('BUG-03', 'new employees get a random password nobody is ever shown, so they cannot log in');
    const first = `Quinn${Date.now().toString(36)}`;
    await hr.employees.add({
      firstName: first, lastName: 'Starter', department: 'Engineering', position: 'Software Engineer',
      country: 'USA', homeTown: 'Austin', contact: '5550142', email: 'quinn@company.com',
      gender: 'Male', maritalStatus: 'Single', dateOfBirth: '11 Nov 1996',
    });
    await hr.employees.expectSaved();
    const creds = await hr.employees.readInitialCredentials();
    expect(creds.username.toLowerCase()).toBe(first.toLowerCase());

    await app.login.loginAs(creds);
    await expect(app.nav.link('Leave Request')).toHaveCount(1);
    await expect(app.nav.link('Manage Employee')).toHaveCount(0);
  });

  test("renaming an employee does not change their login", async ({ hr, app }) => {
    knownDefect('BUG-04', 'editing the first name silently changes the login username');
    await hr.employees.openList();
    await hr.employees.openEdit(users.olive.fullName);
    await hr.page.getByLabel(/first name/i).fill('Olivia');
    await hr.employees.submit();
    await hr.employees.openList();
    await expect(hr.employees.row('Olivia')).toBeVisible();

    await app.login.loginAs(users.olive);
  });

  test('HR can edit an employee and the change is shown', async ({ hr }) => {
    knownDefect('BUG-02', 'edit form requires a photo upload and posts multipart/form-data which the server never parses');
    const town = uid('Town');
    await hr.employees.openList();
    await hr.employees.openEdit(users.mary.fullName);
    await hr.page.getByLabel(/home town/i).fill(town);
    await hr.employees.submit();
    await hr.employees.openList();
    await hr.employees.openDetails(users.mary.fullName);
    await hr.employees.expectDetails([town]);
  });

  test('HR can delete an employee; they disappear and can no longer log in', async ({ hr, app }) => {
    await hr.employees.openList();
    await expect(hr.employees.row(users.temp.fullName)).toBeVisible();
    await hr.employees.delete(users.temp.fullName);
    await expect(hr.employees.row(users.temp.fullName)).toHaveCount(0);

    await app.login.attempt(users.temp.username, users.temp.password);
    await app.login.expectRejected();
  });

  test("a deleted employee's open session ends instead of erroring", async ({ hr, as }) => {
    knownDefect('BUG-10', "a deleted user's open session crashes /home with HTTP 500 instead of ending");
    const gone = await as(users.gone); // logged in while HR deletes them
    await hr.employees.openList();
    await hr.employees.delete(users.gone.fullName);
    await expect(hr.employees.row(users.gone.fullName)).toHaveCount(0);

    const res = await gone.page.goto('/home');
    expect(res?.status()).not.toBe(500);
    await gone.login.expectOnLoginPage();
  });

  test('viewing a non-existent employee shows a not-found page, not a server error', async ({ hr }) => {
    knownDefect('BUG-09', 'unknown employee id crashes the template and returns HTTP 500');
    const res = await hr.page.goto('/hr/viewDetails?id=999999');
    expect(res?.status()).not.toBe(500);
    await expect(hr.page.getByText(/not found/i)).toBeVisible();
  });
});

test.describe('Profile (employee)', () => {
  test('employee can view their own profile', async ({ employee }) => {
    await employee.nav.click('View Profile');
    await expect(employee.page.getByRole('heading', { name: /employee details/i })).toBeVisible();
    await employee.employees.expectDetails([john.displayName, john.department, john.position, john.email]);
  });

  test('HR can view their own profile from the user menu', async ({ hr }) => {
    await hr.nav.click('View Profile');
    await expect(hr.page.getByRole('heading', { name: /employee details/i })).toBeVisible();
    await hr.employees.expectDetails([users.hr.fullName, 'Human Resources', 'HR Manager']);
  });
});
