import { expect, test, type Page } from '@playwright/test';
import { enterWord } from './entry';

async function fixture(page: Page) {
  for (const [length, answer, guesses] of [[4, 'camp', 'camp\ncoat\n'], [5, 'chair', 'chair\ncargo\n'], [6, 'castle', 'castle\ncandle\n']] as const) {
    await page.route(`**/words/answers/${length}.txt`, (route) => route.fulfill({ body: answer + '\n' }));
    await page.route(`**/words/${length}.txt`, (route) => route.fulfill({ body: guesses }));
  }
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Your guess', exact: true })).toBeVisible();
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog');
}
async function guess(page: Page, word: string) {
  await enterWord(page, word);
  await page.keyboard.press('Enter');
}

test('the final can give up by keyboard without clearing guesses or applying pending rules early', async ({ page }) => {
  await fixture(page);
  await expect(page.getByRole('button', { name: 'Give up', exact: true })).toHaveCount(0);
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('sprint');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  await guess(page, 'COAT');
  await enterWord(page, 'CA');
  dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('practice');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await page.getByRole('button', { name: 'Give up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Word given up');
  await expect(page.getByRole('status')).toContainText('CAMP');
  await expect(page.getByRole('group', { name: 'Guess 1', exact: true })).toContainText('C');
  await expect(page.getByRole('group', { name: 'Guess 2: not scored', exact: true })).toHaveText('C✓A');
  await expect(page.getByText('1 guess used', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Give up', exact: true })).toHaveCount(0);
  // The saved preset waits for the sequence to finish.
  await page.getByRole('button', { name: 'Another 4-letter word', exact: true }).click();
  await expect(page.getByText('Guess 1 · Unlimited', { exact: true })).toBeVisible();
  await expect(page.locator('.pending-settings')).toContainText('5 letters');
});

test('preset selection is a preview and Apply now explicitly starts those rules', async ({ page }) => {
  await fixture(page);
  await enterWord(page, 'CHA');
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('quickfire-four');
  const preview = dialog.getByRole('region', { name: 'Settings preview' });
  await expect(preview).toContainText('4 letters');
  await expect(preview).toContainText('5 guesses per word');
  await expect(preview).toContainText('10 seconds per guess');
  await expect(preview).toContainText('Unknown words end the word');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'Find the five.' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your guess', exact: true })).toHaveText('CHA');
  dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('quickfire-four');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Guess time remaining' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your guess', exact: true })).toHaveText('Tap letters below');
});

test('saving a preset preserves current play, signals the pending rules and persists them', async ({ page }) => {
  await fixture(page);
  await guess(page, 'CARGO');
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('practice-six');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await expect(page.locator('.pending-settings')).toContainText('6 letters');
  await expect(page.getByRole('heading', { name: 'Find the five.' })).toBeVisible();
  await expect(page.getByText('Guess 2 of 5')).toBeVisible();
  await guess(page, 'CHAIR');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.locator('.pending-settings')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Find the six.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Find the six.' })).toBeVisible();
  dialog = await settings(page);
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('practice-six');
});

test('the final previews, saves and restores unlimited guesses without changing the other presets', async ({ page }) => {
  await fixture(page);
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('sprint');
  const preview = dialog.getByRole('region', { name: 'Settings preview' });
  await expect(preview).toContainText('Unlimited guesses per word');
  await expect(preview).toContainText('90 seconds overall');
  await expect(preview).toContainText('Unknown words are unscored');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  await expect(page.locator('.pending-settings')).toContainText('Unlimited guesses per word');
  await page.reload();
  await expect(page.getByText('Guess 1 · Unlimited', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Round time remaining' })).toBeVisible();
  dialog = await settings(page);
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('sprint');
  await dialog.getByLabel('Preset', { exact: true }).selectOption('quickfire-five');
  await expect(dialog.getByRole('region', { name: 'Settings preview' })).toContainText('5 guesses per word');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
});

test('settings offer presets only, including practice at every length', async ({ page }) => {
  await fixture(page);
  const dialog = await settings(page);
  await expect(dialog.getByRole('combobox')).toHaveCount(2);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await expect(dialog.getByRole('spinbutton')).toHaveCount(0);
  await expect(dialog.getByLabel('Preset', { exact: true }).getByRole('option')).toHaveText([
    'Practice · 4 letters', 'Practice · 5 letters', 'Practice · 6 letters', 'Climb · 4 → 5 → 6',
    'Practice · 4 letters · No first letter', 'Practice · 5 letters · No first letter', 'Practice · 6 letters · No first letter', 'Climb · 4 → 5 → 6 · No first letter',
    'Quickfire · 4 letters', 'Quickfire · 5 letters', 'Sprint · 90 seconds', 'In one · 5 letters',
  ]);
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('practice');
  await dialog.getByLabel('Preset', { exact: true }).selectOption('practice-four');
  await expect(dialog.getByRole('region', { name: 'Settings preview' })).toHaveText(/4 letters · 5 guesses per word · Untimed/);
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
});

test('a saved preset waits for sequence completion, including same-length retries', async ({ page }) => {
  await fixture(page);
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('sequence');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('sprint');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  for (let index = 0; index < 5; index++) await guess(page, 'COAT');
  await expect(page.getByText('5 of 5 guesses used')).toBeVisible();
  await page.getByRole('button', { name: 'Another 4-letter word' }).click();
  for (const word of ['CAMP', 'CHAIR', 'CASTLE']) {
    await expect(page.getByText('Guess 1 of 5')).toBeVisible();
    await expect(page.locator('.pending-settings')).toBeVisible();
    await guess(page, word);
    await page.getByRole('button', { name: word === 'CASTLE' ? 'New round' : 'Next length', exact: true }).click();
  }
  await expect(page.getByText('Guess 1 · Unlimited', { exact: true })).toBeVisible();
  await expect(page.locator('.pending-settings')).toHaveCount(0);
});

test.describe('mobile settings', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 667 } });
  for (const theme of ['letterpress', 'afterhours', 'club']) {
    test(`${theme} apply actions stay visible and play continues without text entry`, async ({ page }, testInfo) => {
      await fixture(page);
      const dialog = await settings(page);
      await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
      await expect(dialog.getByRole('region', { name: 'Settings preview' })).toBeInViewport({ ratio: 1 });
      await dialog.getByLabel('Preset', { exact: true }).selectOption('practice-six');
      const apply = dialog.getByRole('button', { name: 'Apply now', exact: true });
      await expect(apply).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`settings-${theme}-320.png`), fullPage: true });
      await apply.tap();
      await expect(page.getByRole('group', { name: 'Guess board' }).locator('.board-row')).toHaveCount(5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('.play-area input, .play-area textarea, .play-area [contenteditable="true"]')).toHaveCount(0);
      for (const letter of 'CASTLE') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.getByRole('button', { name: 'Check guess' }).tap();
      await expect(page.getByRole('status')).toContainText('Nicely found');
    });
  }
});
