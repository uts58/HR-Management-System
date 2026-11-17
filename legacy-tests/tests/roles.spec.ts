import { test, expect } from '../support/fixtures';
import { uid, users } from '../support/data';
import { knownDefect } from '../support/defects';
import { hrOnlyPages, routes } from '../support/routes';

/**
 * Correct behaviour: HR-only screens and actions are unavailable to employees.
 * The legacy app only checks "is logged in", so these are expected failures (SEC-01/02)
 * until the Security lead's role checks land; then run with FIXED_DEFECTS=SEC-01,SEC-02.
 */
test.describe('Role enforcement', () => {
  for (const p of hrOnlyPages) {
    test(`employee cannot open HR page: ${p.name}`, async ({ employee }) => {
      knownDefect('SEC-01', 'no role checks: any logged-in employee can use every HR page and action');
      await employee.page.goto(p.path);
      await expect(employee.page.getByRole('heading', { name: p.heading })).toHaveCount(0);
    });
  }

  test('employee cannot create a department by submitting the form directly', async ({ employee, hr }) => {
    knownDefect('SEC-01', 'no role checks: any logged-in employee can use every HR page and action');
    const name = uid('Hacked dept');
    await employee.page.request.post(routes.api.saveDepartment, { form: { depName: name }, maxRedirects: 0 });
    await hr.departments.open();
    await expect(hr.departments.row(name)).toHaveCount(0);
  });

  test("employee cannot view another employee's details", async ({ employee }) => {
    knownDefect('SEC-02', 'IDOR: /hr/viewDetails?id=N shows any employee to any logged-in user');
    await employee.page.goto(routes.employeeDetails(users.mary.id));
    await expect(employee.page.getByText(users.mary.fullName)).toHaveCount(0);
  });

  test('employee can still view their own profile', async ({ employee }) => {
    await employee.page.goto(routes.myProfile);
    await expect(employee.page.getByRole('heading', { name: /employee details/i })).toBeVisible();
    await expect(employee.page.getByText('John A Doe')).toBeVisible();
  });
});
