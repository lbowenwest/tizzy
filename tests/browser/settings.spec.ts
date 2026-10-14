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

test('unlimited practice can give up by keyboard without clearing guesses or applying pending rules early', async ({ page }) => {
  await fixture(page);
  await expect(page.getByRole('button', { name: 'Give up', exact: true })).toHaveCount(0);
  let dialog = await settings(page);
  await dialog.getByLabel('Guesses per word').selectOption('unlimited');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await expect(page.getByRole('button', { name: 'Give up', exact: true })).toHaveCount(0);
  await guess(page, 'CHAIR');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Give up', exact: true })).toBeVisible();
  await guess(page, 'CARGO');
  await enterWord(page, 'CHA');
  dialog = await settings(page);
  await dialog.getByLabel('Guesses per word').selectOption('3');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await page.getByRole('button', { name: 'Give up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Word given up');
  await expect(page.getByRole('status')).toContainText('CHAIR');
  await expect(page.getByRole('group', { name: 'Guess 1', exact: true })).toContainText('C');
  await expect(page.getByRole('group', { name: 'Guess 2: not scored', exact: true })).toHaveText('C✓HA');
  await expect(page.getByText('1 guess used', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Give up', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.getByText('Guess 1 of 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Give up', exact: true })).toHaveCount(0);
});

test('preset selection is a preview and Apply now explicitly starts those rules', async ({ page }) => {
  await fixture(page);
  await enterWord(page, 'CHA');
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('itv-four');
  const preview = dialog.getByRole('region', { name: 'Settings preview' });
  await expect(preview).toContainText('4 letters');
  await expect(preview).toContainText('5 guesses per word');
  await expect(preview).toContainText('10 seconds per guess');
  await expect(preview).toContainText('Unknown words end the word');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'Find the five.' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your guess', exact: true })).toHaveText('CHA');
  dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('itv-four');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Guess time remaining' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Your guess', exact: true })).toHaveText('Tap letters below');
});

test('saving a guess limit preserves current play, signals the pending rules and persists them', async ({ page }) => {
  await fixture(page);
  await guess(page, 'CARGO');
  const dialog = await settings(page);
  await dialog.getByLabel('Guesses per word').selectOption('3');
  await dialog.getByLabel('Unknown submitted word').selectOption('consume');
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('custom');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await expect(page.locator('.pending-settings')).toContainText('3 guesses per word');
  await expect(page.getByText('Guess 2 of 5')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Guess board' }).locator('.board-row')).toHaveCount(5);
  await guess(page, 'CHAIR');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.locator('.pending-settings')).toHaveCount(0);
  await expect(page.getByText('Guess 1 of 3')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Guess board' }).locator('.board-row')).toHaveCount(3);
  await page.reload();
  for (let index = 0; index < 3; index++) await guess(page, 'CZZZZ');
  await expect(page.getByText('3 of 3 guesses used')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('That one got away');
});

test('the final previews, saves and restores unlimited guesses without changing the other presets', async ({ page }) => {
  await fixture(page);
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('final');
  await expect(dialog.getByLabel('Guesses per word')).toHaveValue('unlimited');
  await expect(dialog.getByRole('region', { name: 'Settings preview' })).toContainText('Unlimited guesses per word');
  await expect(dialog.getByRole('region', { name: 'Settings preview' })).toContainText('90 seconds overall');
  await expect(dialog.getByRole('region', { name: 'Settings preview' })).toContainText('Unknown words are unscored');
  await dialog.getByLabel('Guesses per word').selectOption('3');
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('custom');
  await dialog.getByLabel('Preset', { exact: true }).selectOption('final');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  await expect(page.locator('.pending-settings')).toContainText('Unlimited guesses per word');
  await page.reload();
  await expect(page.getByText('Guess 1 · Unlimited', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer', { name: 'Round time remaining' })).toBeVisible();
  dialog = await settings(page);
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('final');
  await expect(dialog.getByLabel('Guesses per word')).toHaveValue('unlimited');
  await dialog.getByLabel('Preset', { exact: true }).selectOption('itv-five');
  await expect(dialog.getByLabel('Guesses per word')).toHaveValue('5');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
});

test('editing a preset marks it custom and selecting another restores its default guess budget', async ({ page }) => {
  await fixture(page);
  const dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('itv-five');
  await dialog.getByLabel('Guesses per word').selectOption('6');
  await expect(dialog.getByLabel('Preset', { exact: true })).toHaveValue('custom');
  await expect(dialog.getByRole('region', { name: 'Settings preview' })).toContainText('6 guesses per word');
  await dialog.getByLabel('Preset', { exact: true }).selectOption('practice');
  await expect(dialog.getByLabel('Guesses per word')).toHaveValue('5');
  await expect(dialog.getByRole('region', { name: 'Settings preview' })).toContainText('Untimed');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);
});

test('a saved guess count waits for sequence completion, including same-length retries', async ({ page }) => {
  await fixture(page);
  let dialog = await settings(page);
  await dialog.getByLabel('Preset', { exact: true }).selectOption('sequence');
  await dialog.getByLabel('Guesses per word').selectOption('1');
  await dialog.getByRole('button', { name: 'Apply now', exact: true }).click();
  dialog = await settings(page);
  await dialog.getByLabel('Guesses per word').selectOption('6');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await guess(page, 'COAT');
  await expect(page.getByText('1 of 1 guesses used')).toBeVisible();
  await page.getByRole('button', { name: 'Another 4-letter word' }).click();
  for (const word of ['CAMP', 'CHAIR', 'CASTLE']) {
    await expect(page.getByText('Guess 1 of 1')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Guess board' }).locator('.board-row')).toHaveCount(1);
    await guess(page, word);
    await page.getByRole('button', { name: word === 'CASTLE' ? 'New round' : 'Next length', exact: true }).click();
  }
  await expect(page.getByText('Guess 1 of 6')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Guess board' }).locator('.board-row')).toHaveCount(6);
  await expect(page.locator('.pending-settings')).toHaveCount(0);
});

test.describe('mobile settings', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 667 } });
  for (const theme of ['letterpress', 'afterhours', 'club']) {
    test(`${theme} apply actions stay visible and ten-guess play remains scrollable without text entry`, async ({ page }, testInfo) => {
      await fixture(page);
      const dialog = await settings(page);
      await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
      await expect(dialog.getByRole('region', { name: 'Settings preview' })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath(`preset-${theme}-320.png`), fullPage: true });
      await dialog.getByLabel('Guesses per word').scrollIntoViewIfNeeded();
      await dialog.getByLabel('Guesses per word').selectOption('10');
      const apply = dialog.getByRole('button', { name: 'Apply now', exact: true });
      await expect(apply).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`settings-${theme}-320.png`), fullPage: true });
      await apply.tap();
      await expect(page.getByRole('group', { name: 'Guess board' }).locator('.board-row')).toHaveCount(10);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('.play-area input, .play-area textarea, .play-area [contenteditable="true"]')).toHaveCount(0);
      for (const letter of 'CHAIR') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.getByRole('button', { name: 'Check guess' }).tap();
      await expect(page.getByRole('status')).toContainText('Nicely found');
    });
  }
});
