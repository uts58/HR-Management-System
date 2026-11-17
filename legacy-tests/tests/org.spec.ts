import { test, expect } from '../support/fixtures';
import type { App } from '../support/fixtures';
import { occupied, uid } from '../support/data';
import { knownDefect } from '../support/defects';
import type { LookupPage } from '../support/pages/org';

const areas: { name: string; page: (a: App) => LookupPage; select: string; inUse: string }[] = [
  { name: 'Departments', page: (a) => a.departments, select: 'department', inUse: occupied.department },
  { name: 'Positions', page: (a) => a.positions, select: 'position', inUse: occupied.position },
];

for (const area of areas) {
  test.describe(area.name, () => {
    test(`HR can add a ${area.select} and it is offered on the employee form`, async ({ hr }) => {
      const name = uid(`QA ${area.select}`);
      const p = area.page(hr);
      await p.open();
      await p.add(name);
      await p.expectSaved();
      await expect(p.row(name)).toBeVisible();

      await hr.employees.openAdd();
      await expect(hr.page.locator(`select[name="${area.select}"] option`, { hasText: name })).toHaveCount(1);
    });

    test(`blank ${area.select} name is rejected`, async ({ hr }) => {
      const p = area.page(hr);
      await p.open();
      const before = await hr.page.getByRole('row').count();
      await p.add('   ');
      await p.expectError(/name required|required/i);
      await expect(hr.page.getByRole('row')).toHaveCount(before);
    });

    test(`HR can delete a ${area.select}`, async ({ hr }) => {
      const name = uid(`QA del ${area.select}`);
      const p = area.page(hr);
      await p.open();
      await p.add(name);
      await expect(p.row(name)).toBeVisible();
      await p.delete(name);
      await expect(p.row(name)).toHaveCount(0);
    });

    test(`a ${area.select} that is assigned to employees cannot be deleted`, async ({ hr }) => {
      knownDefect('BUG-07', `deleting an in-use ${area.select} is allowed and leaves employees pointing at nothing`);
      const p = area.page(hr);
      await p.open();
      await p.delete(area.inUse);
      await expect(p.row(area.inUse)).toBeVisible();
    });
  });
}
