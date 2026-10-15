import { expect, test, type Page } from '@playwright/test';
import { enterWord } from './entry';

async function fixture(page: Page, preset = 'practice-four', theme = 'letterpress') {
  await page.addInitScript(({ preset, theme }) => {
    localStorage.setItem('word-practice-preferences-v1', JSON.stringify({ preset, theme }));
    Math.random = () => 0;
  }, { preset, theme });
  await page.route('**/words/answers/4.txt', (route) => route.fulfill({ body: 'bale\nbake\nbane\nbare\ncare\n' }));
  await page.route('**/words/4.txt', (route) => route.fulfill({ body: 'bale\nbake\nbane\nbare\nbark\ncare\n' }));
  await page.route('**/words/answers/5.txt', (route) => route.fulfill({ body: 'chair\n' }));
  await page.route('**/words/5.txt', (route) => route.fulfill({ body: 'chair\ncargo\nstair\n' }));
  await page.route('**/words/clues/5.txt', (route) => route.fulfill({ body: 'chair cargo\n' }));
  await page.goto('/');
  await expect(page.getByLabel('Your guess', { exact: true })).toBeVisible();
}
async function guess(page: Page, word: string) {
  await enterWord(page, word);
  await page.getByLabel('Your guess', { exact: true }).press('Enter');
}
async function openAnalysis(page: Page) {
  await page.getByRole('button', { name: 'Analyse guesses' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your guesses.' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('analysis is post-word only, explains choices, restores focus and resets on continuation', async ({ page }) => {
  await fixture(page);
  await expect(page.getByRole('button', { name: 'Analyse guesses' })).toHaveCount(0);
  await guess(page, 'BAKE');
  await expect(page.getByRole('button', { name: 'Analyse guesses' })).toHaveCount(0);
  await guess(page, 'BALE');
  const dialog = await openAnalysis(page);
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  const first = dialog.getByRole('region', { name: 'Guess 1 review' });
  await expect(first).toContainText('4 → 3');
  await expect(dialog.getByLabel('Information score: 54', { exact: true })).toBeVisible();
  await expect(first).toContainText('2.5 on average');
  await expect(first.getByRole('region', { name: 'Remaining answers' }).getByRole('listitem')).toHaveText(['BALE', 'BANE', 'BARE']);
  await first.locator('summary').filter({ hasText: 'Compare the choices' }).click();
  const table = first.getByRole('table');
  await expect(table).toContainText('0.81 bits');
  await expect(table).toContainText('25%');
  await expect(table).toContainText('BARK');
  await expect(dialog.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Next guess' }).click();
  const second = dialog.getByRole('region', { name: 'Guess 2 review' });
  await expect(second).toContainText('3 → 1');
  await expect(second).toContainText('You found it.');
  await expect(second.getByRole('region', { name: 'Remaining answers' }).getByRole('listitem')).toHaveText(['BALE']);
  await expect(dialog.getByRole('button', { name: 'Next guess' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Review guess 1: BAKE' }).click();
  await expect(first).toBeVisible();
  await expect(first.getByRole('table')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Analyse guesses' })).toBeFocused();
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analyse guesses' })).toHaveCount(0);
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
});

test('a loss can be reviewed and repeated guesses add no information', async ({ page }) => {
  await fixture(page);
  for (let index = 0; index < 5; index++) await guess(page, 'BAKE');
  const dialog = await openAnalysis(page);
  await expect(dialog.getByRole('list', { name: 'Guess analysis' }).locator(':scope > li')).toHaveCount(5);
  await dialog.getByRole('button', { name: 'Review guess 5: BAKE' }).click();
  const last = dialog.getByRole('region', { name: 'Guess 5 review' });
  await expect(last).toContainText('This added no new information.');
  await expect(last).toContainText('This was your last try');
  await expect(last).toContainText('33.33% chance');
});

test('expiry with an unfinished entry has no invented guess to analyse', async ({ page }) => {
  await page.clock.install();
  await fixture(page, 'quickfire-four');
  await enterWord(page, 'BAL');
  await page.clock.fastForward(11000);
  const dialog = await openAnalysis(page);
  await expect(dialog).toContainText('No scored or consumed guesses to analyse');
  await expect(dialog.getByRole('list', { name: 'Guess analysis' })).toHaveCount(0);
});

test('Sprint review preserves unscored attempts and the paused round timer', async ({ page }) => {
  await page.clock.install();
  await fixture(page, 'sprint');
  await guess(page, 'BZZZ');
  await guess(page, 'BAKE');
  await page.getByRole('button', { name: 'Give up' }).click();
  const time = await page.getByRole('timer', { name: 'Round time remaining' }).textContent();
  const dialog = await openAnalysis(page);
  await expect(dialog).toContainText('This attempt was not scored');
  await expect(dialog).toContainText('4 → 4');
  await page.clock.fastForward(120000);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('timer', { name: 'Round time remaining' })).toHaveText(time!);
});

test('In one explains the clue and rejected guess without an information score', async ({ page }) => {
  await fixture(page, 'in-one');
  await guess(page, 'STAIR');
  const dialog = await openAnalysis(page);
  await expect(dialog).toContainText('Only CHAIR fits every mark on CARGO');
  await expect(dialog).toContainText('1st letter must be C.');
  await expect(dialog.getByRole('meter')).toHaveCount(0);
});

for (const theme of ['letterpress', 'afterhours', 'club']) {
  for (const width of [320, 390, 1280]) {
    test(`${theme} analysis fits ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await fixture(page, 'practice-four', theme);
      await guess(page, 'BAKE');
      await guess(page, 'BALE');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const dialog = await openAnalysis(page);
      await page.evaluate(() => document.fonts.ready);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('analysis.png') });
      await dialog.locator('summary').filter({ hasText: 'Compare the choices' }).click();
      await dialog.getByRole('table').scrollIntoViewIfNeeded();
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('comparison.png') });
      await dialog.locator('summary').filter({ hasText: 'About the analysis' }).click();
      await expect(dialog.getByText('Bits', { exact: true })).toBeVisible();
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    });
  }
}

test('six-letter feedback and comparison fit a narrow touch screen', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.route('**/words/answers/6.txt', (route) => route.fulfill({ body: 'bottle\nbattle\nbeetle\nbustle\n' }));
  await page.route('**/words/6.txt', (route) => route.fulfill({ body: 'bottle\nbattle\nbeetle\nbustle\nbaffle\n' }));
  await fixture(page, 'practice-six');
  await guess(page, 'BATTLE');
  await guess(page, 'BOTTLE');
  await page.getByRole('button', { name: 'Analyse guesses' }).tap();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Review guess 1: BATTLE' })).toHaveAttribute('aria-current', 'step');
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('six-letter-review.png') });
  await dialog.getByRole('button', { name: 'Next guess' }).tap();
  await expect(dialog.getByRole('region', { name: 'Guess 2 review' })).toContainText('You played the only remaining answer');
  await dialog.getByRole('button', { name: 'Previous' }).tap();
  await expect(dialog.getByRole('region', { name: 'Guess 1 review' })).toBeVisible();
  await context.close();
});
