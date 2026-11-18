import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Records every native dialog (alert/confirm) and answers it.
 * The legacy UI uses alert() for validation and confirm() for deletes; the new UI
 * will likely use inline messages and modal buttons. Page objects hide that difference.
 */
export class Dialogs {
  readonly messages: string[] = [];
  /** What to answer to the next confirm(): true = OK, false = Cancel. */
  acceptConfirms = true;

  constructor(page: Page) {
    page.on('dialog', async (dialog) => {
      this.messages.push(dialog.message());
      if (dialog.type() === 'confirm' && !this.acceptConfirms) await dialog.dismiss();
      else await dialog.accept();
    });
  }

  last(): string | undefined {
    return this.messages[this.messages.length - 1];
  }
}

/**
 * Locate a form control by its visible label, falling back to a CSS selector.
 * Several legacy labels are not wired to their inputs (for="dep" on a select without id),
 * so the fallback keeps the test readable while still working on legacy.
 */
export function field(page: Page, label: RegExp, fallback: string): Locator {
  return page.getByLabel(label).or(page.locator(fallback)).first();
}

export function rowWith(page: Page, text: string | RegExp): Locator {
  return page.getByRole('row').filter({ hasText: text });
}

/** Asserts a visible message, or (legacy) a native dialog, matching `text`. */
export async function expectMessage(page: Page, dialogs: Dialogs, text: RegExp) {
  await expect
    .poll(
      async () =>
        dialogs.messages.some((m) => text.test(m)) ||
        (await page.getByText(text).first().isVisible().catch(() => false)),
      { message: `expected a message matching ${text}` }
    )
    .toBe(true);
}

export class Nav {
  constructor(private readonly page: Page) {}

  /**
   * Click a menu link by its visible text. Legacy menus are CSS hover drop-downs,
   * so hover the top-level item first if the link is hidden.
   */
  async click(linkText: string | RegExp) {
    const link = this.link(linkText).first();
    if (!(await link.isVisible())) {
      await link.locator('xpath=ancestor::li[last()]').hover();
    }
    await link.click();
  }

  async logout() {
    await this.click('Log out');
  }

  /** Menu link, including ones currently collapsed inside a drop-down. */
  link(linkText: string | RegExp): Locator {
    return this.page.getByRole('link', { name: linkText, exact: typeof linkText === 'string', includeHidden: true });
  }
}
