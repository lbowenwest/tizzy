import type { Page } from '@playwright/test';

/** Replace an in-progress guess using real physical-keyboard events, not a text field. */
export async function enterWord(page: Page, word: string) {
  await page.getByRole('group', { name: 'Your guess', exact: true }).focus();
  for (let index = 0; index < 6; index++) await page.keyboard.press('Backspace');
  await page.keyboard.type(word);
}
