import { test, users } from '../support/fixtures';
import { knownDefect } from '../support/defects';

test.describe('Change password', () => {
  test('user can change password; old one stops working, new one works', async ({ app }) => {
    const next = 'mary-new-456';
    await app.login.loginAs(users.mary);
    await app.password.open();
    await app.password.change(users.mary.password, next);
    await app.password.expectSuccess();

    await app.nav.logout();
    await app.login.attempt(users.mary.username, users.mary.password);
    await app.login.expectRejected();
    await app.login.loginAs({ username: users.mary.username, password: next });
  });

  test('HR can open change password from the HR menu', async ({ hr }) => {
    await hr.password.open();
  });

  test('mismatched confirmation is rejected', async ({ employee }) => {
    await employee.password.open();
    await employee.password.change(users.john.password, 'abc12345', 'different1');
    await employee.password.expectError(/do not match/i);
  });

  test('wrong current password is rejected', async ({ employee }) => {
    await employee.password.open();
    await employee.password.change('wrong-current', 'abc12345');
    await employee.password.expectError(/current password is incorrect/i);
  });

  test('empty new password is rejected', async ({ as }) => {
    knownDefect('BUG-05', 'empty new password is accepted and locks the user out');
    const paula = await as(users.paula);
    await paula.password.open();
    await paula.password.change(users.paula.password, '');
    await paula.password.expectError(/required|empty|at least|too short/i);
  });
});
