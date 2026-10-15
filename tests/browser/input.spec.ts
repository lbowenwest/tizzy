import { expect, test, type Page } from '@playwright/test';
import { enterWord } from './entry';

async function fixture(page: Page) {
  await page.route('**/words/answers/5.txt', (route) => route.fulfill({ body: 'chair\n' }));
  await page.route('**/words/5.txt', (route) => route.fulfill({ body: 'chair\ncargo\ncivic\n' }));
  await page.goto('/');
}
const input = (page: Page) => page.getByRole('group', { name: 'Your guess', exact: true });
async function submit(page: Page, word: string) {
  await enterWord(page, word);
  await input(page).press('Enter');
}

test('type the entire word without skipping the clue letter', async ({ page }) => {
  await fixture(page);
  await enterWord(page, 'chair');
  await expect(input(page)).toHaveText('CHAIR');
  const row = page.getByRole('group', { name: 'Guess 1', exact: true });
  await expect(row.getByRole('img')).toHaveCount(5);
  await expect(row.getByRole('img', { name: 'C: supplied letter; right place' })).toBeVisible();
  await expect(row.getByRole('img', { name: 'H', exact: true })).toBeVisible();
  await input(page).press('Enter');
  await expect(page.getByRole('status')).toContainText('Nicely found');
});

test('the first letter is a hint, not an undeletable input prefix', async ({ page }) => {
  await fixture(page);
  await enterWord(page, 'C');
  await input(page).press('Backspace');
  await expect(input(page)).toHaveText('Tap letters below');
  await expect(page.getByRole('img', { name: 'C: supplied letter; right place' })).toBeVisible();
  await submit(page, 'SHARE');
  await expect(page.getByRole('status')).toContainText('Start with C');
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  // A whole word that doesn't count is cleared so the next guess can be typed at once.
  await expect(input(page)).toHaveText('Tap letters below');
  await expect(page.getByRole('img', { name: 'C: supplied letter; right place' })).toBeVisible();
  await submit(page, 'CHAI');
  await expect(page.getByRole('status')).toContainText('Enter all 5');
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  await expect(input(page)).toHaveText('CHAI');
});

for (const theme of ['letterpress', 'afterhours', 'club']) {
  test(`${theme} grays only proven absent letters and resets them for the next word`, async ({ page }) => {
    await fixture(page);
    await submit(page, 'CARGO');
    const g = page.getByRole('button', { name: 'G', exact: true });
    await expect(g).toHaveClass(/unavailable/);
    await expect(g).toHaveAccessibleDescription('Not in word. You can still type this letter.');
    await expect(page.getByRole('button', { name: 'O', exact: true })).toHaveClass(/unavailable/);
    await expect(page.getByRole('button', { name: 'A', exact: true })).not.toHaveClass(/unavailable/);
    await submit(page, 'CIVIC');
    for (const letter of ['C', 'I']) await expect(page.getByRole('button', { name: letter, exact: true })).not.toHaveClass(/unavailable/);
    await expect(page.getByRole('button', { name: 'V', exact: true })).toHaveClass(/unavailable/);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Appearance', { exact: true }).selectOption(theme);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(g).toHaveClass(/unavailable/);
    await g.click();
    await expect(input(page)).toHaveText('G');
    await submit(page, 'CHAIR');
    await page.getByRole('button', { name: 'Next word', exact: true }).click();
    await expect(g).not.toHaveClass(/unavailable/);
  });
}

test('unknown words use an unscored guess in Final sprint, persist with the preset, and end ITV-style words', async ({ page }) => {
  await page.route('**/words/answers/4.txt', (route) => route.fulfill({ body: 'camp\n' }));
  await page.route('**/words/4.txt', (route) => route.fulfill({ body: 'camp\ncoat\n' }));
  await fixture(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Preset').selectOption('final');
  await page.getByRole('button', { name: 'Apply now' }).click();
  await page.reload();
  await expect(input(page)).toBeVisible();
  await submit(page, 'CHA');
  await expect(page.getByText('Guess 1 · Unlimited')).toBeVisible();
  await submit(page, 'CZZZ');
  await expect(page.getByText('Guess 2 · Unlimited')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('No letter clues awarded');
  const row = page.getByRole('group', { name: 'Guess 1: not in word list', exact: true });
  await expect(row.getByRole('img', { name: 'Z: unscored; word not in list' })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Z', exact: true })).not.toHaveClass(/unavailable/);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Preset').selectOption('itv-five');
  await page.getByRole('button', { name: 'Apply now' }).click();
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  await submit(page, 'CZZZZ');
  await expect(page.getByRole('status')).toContainText('Unknown submitted word: this word has ended');
  await expect(page.getByText('0 of 5 guesses used')).toBeVisible();
});

test.describe('touch entry', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('on-screen keys enter a complete word including its first letter', async ({ page }, testInfo) => {
    await fixture(page);
    for (const letter of 'CARGO') await page.getByRole('button', { name: letter, exact: true }).tap();
    await page.getByRole('button', { name: 'Check guess' }).tap();
    await expect(page.getByRole('button', { name: 'G', exact: true })).toHaveClass(/unavailable/);
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: testInfo.outputPath('gray-keys-mobile.png'), fullPage: true });
    for (const letter of 'CHAIR') await page.getByRole('button', { name: letter, exact: true }).tap();
    await expect(input(page)).toHaveText('CHAIR');
    expect(await input(page).evaluate((element) => element.tagName === 'DIV' && !(element as HTMLElement).isContentEditable)).toBe(true);
    await expect(page.locator('.keyboard')).toBeVisible();
    await page.getByRole('button', { name: 'Check guess' }).tap();
    await expect(page.getByRole('status')).toContainText('Nicely found');
  });
});
