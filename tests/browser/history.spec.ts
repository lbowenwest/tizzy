import { expect, test, type Page } from '@playwright/test';
import { enterWord } from './entry';

async function fixture(page: Page) {
  for (const [length, answer, guesses] of [
    [4, 'camp', 'camp\ncoat\n'], [5, 'chair', 'chair\ncargo\n'], [6, 'castle', 'castle\ncandle\n'],
  ] as const) {
    await page.route(`**/words/answers/${length}.txt`, (route) => route.fulfill({ body: answer + '\n' }));
    await page.route(`**/words/${length}.txt`, (route) => route.fulfill({ body: guesses }));
  }
  await page.clock.install({ time: new Date('2026-03-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-03-01T12:00:01Z'));
  await page.goto('/');
  await expect(page.getByLabel('Your guess', { exact: true })).toBeVisible();
}
async function guess(page: Page, word: string) {
  await enterWord(page, word);
  await page.getByLabel('Your guess', { exact: true }).press('Enter');
}
async function openHistory(page: Page) {
  await page.getByRole('button', { name: 'History', exact: true }).click();
  return page.getByRole('dialog', { name: 'Your history.' });
}
async function applyPreset(page: Page, key: string) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Preset').selectOption(key);
  await page.getByRole('button', { name: 'Apply now' }).click();
}
const stat = (page: Page, name: string) => page.getByRole('dialog').locator('.history-stats div')
  .filter({ has: page.getByText(name, { exact: true }) }).locator('dd');
const recent = (page: Page) => page.getByRole('list', { name: 'Recent words' }).getByRole('listitem');

test('records finished words and summarises them by preset across reloads', async ({ page }) => {
  await fixture(page);
  // Real words start at distinct times; the paused test clock must move between them.
  for (const word of ['CARGO', 'CHAIR']) {
    await page.clock.runFor(1000);
    await guess(page, word);
  }
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  for (let index = 0; index < 5; index++) {
    await page.clock.runFor(1000);
    await guess(page, 'CARGO');
  }
  await expect(page.getByRole('status')).toContainText('That one got away');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await page.clock.runFor(4000);
  await guess(page, 'CHAIR');
  await expect(page.getByRole('status')).toContainText('Nicely found');
  for (const reloaded of [false, true]) {
    if (reloaded) {
      await page.reload();
      await expect(page.getByLabel('Your guess', { exact: true })).toBeVisible();
    }
    const dialog = await openHistory(page);
    await expect(dialog.getByLabel('Group')).toHaveValue('practice');
    await expect(stat(page, 'Played')).toHaveText('3');
    await expect(stat(page, 'Solved')).toHaveText('67%');
    await expect(stat(page, 'Current streak')).toHaveText('1');
    await expect(stat(page, 'Best streak')).toHaveText('1');
    await expect(stat(page, 'Average solve')).toHaveText('0:03');
    await expect(stat(page, 'Rounds completed')).toHaveCount(0);
    const distribution = dialog.getByRole('list', { name: 'Guesses to solve' }).getByRole('listitem');
    await expect(distribution).toHaveCount(2);
    await expect(distribution.first()).toHaveAccessibleName('1 guess: 1 word');
    await expect(distribution.last()).toHaveAccessibleName('2 guesses: 1 word');
    await expect(recent(page)).toHaveCount(3);
    await expect(recent(page).first()).toHaveText(/CHAIR.*Solved.*1 guess.*Practice · 5 letters/);
    await expect(recent(page).nth(1)).toHaveText(/CHAIR.*Out of guesses.*5 guesses/);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
});

test('groups presets separately and skips words left unfinished by Apply now or reload', async ({ page }) => {
  await fixture(page);
  await guess(page, 'CARGO');
  await applyPreset(page, 'sprint');
  await guess(page, 'COAT');
  await guess(page, 'CAMP');
  await expect(page.getByRole('status')).toContainText('Nicely found');
  await page.getByRole('button', { name: 'Next length', exact: true }).click();
  await guess(page, 'CARGO');
  await page.reload();
  await expect(page.getByLabel('Your guess', { exact: true })).toBeVisible();
  const dialog = await openHistory(page);
  await expect(dialog.getByLabel('Group').getByRole('option')).toHaveText(['Sprint · 90 seconds']);
  await expect(stat(page, 'Played')).toHaveText('1');
  await expect(stat(page, 'Rounds completed')).toHaveText('0');
  await expect(stat(page, 'Round time ran out')).toHaveText('0');
  await expect(recent(page)).toHaveCount(1);
  await expect(recent(page).first()).toHaveText(/CAMP.*Solved.*2 guesses.*Sprint/);
});

test('words recorded under custom settings are deleted', async ({ page }) => {
  const record = (endedAt: number, group: string, answer: string) => ({ id: `${endedAt}:${answer}`, roundId: endedAt, answer,
    length: 5, format: 'single', group, result: 'solved', reason: null, guesses: 2, unknown: 0, durationMs: 1000, endedAt });
  const seeded = JSON.stringify({ version: 1, records: [record(1, 'custom', 'cargo'), record(2, 'practice', 'chair')] });
  await page.addInitScript((value) => window.localStorage.setItem('word-practice-history-v1', value), seeded);
  await fixture(page);
  const dialog = await openHistory(page);
  await expect(dialog.getByLabel('Group').getByRole('option')).toHaveText(['Practice · 5 letters']);
  await expect(stat(page, 'Played')).toHaveText('1');
  await expect(recent(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  // The next finished word rewrites storage without them.
  await guess(page, 'CHAIR');
  await expect(page.getByRole('status')).toContainText('Nicely found');
  const groups = await page.evaluate(() => JSON.parse(window.localStorage.getItem('word-practice-history-v1')!).records
    .map(({ group }: { group: string }) => group));
  expect(groups).toEqual(['practice', 'practice']);
});

test('clearing history needs confirmation', async ({ page }) => {
  await fixture(page);
  await guess(page, 'CHAIR');
  let dialog = await openHistory(page);
  await dialog.getByRole('button', { name: 'Clear history' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(recent(page)).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Clear history' }).click();
  await dialog.getByRole('button', { name: 'Confirm clear' }).click();
  await expect(dialog).toContainText('No finished words yet.');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  dialog = await openHistory(page);
  await expect(dialog).toContainText('No finished words yet.');
});

test('corrupt history storage shows the empty state without blocking play', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('word-practice-history-v1', '{'));
  await fixture(page);
  const dialog = await openHistory(page);
  await expect(dialog).toContainText('No finished words yet.');
  await page.keyboard.press('Escape');
  await guess(page, 'CHAIR');
  await expect(page.getByRole('status')).toContainText('Nicely found');
  await openHistory(page);
  await expect(stat(page, 'Played')).toHaveText('1');
});

for (const width of [320, 390]) {
  test.describe(`${width}px history`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width, height: 700 } });
    for (const theme of ['letterpress', 'afterhours', 'club'] as const) {
      test(`${theme} header and dialog fit without horizontal overflow`, async ({ page }, testInfo) => {
        await page.addInitScript((value) => window.localStorage.setItem('word-practice-preferences-v1', value),
          JSON.stringify({ theme, rules: { format: 'sequence', length: 5, invalid: 'reject', maxGuesses: 5, wordClock: { mode: 'off', seconds: 10 }, roundSeconds: null } }));
        await fixture(page);
        await guess(page, 'COAT');
        await guess(page, 'CAMP');
        const buttons = ['How to play', 'History', 'Settings'].map((name) => page.getByRole('button', { name, exact: true }));
        for (const button of buttons) await expect(button).toBeInViewport({ ratio: 1 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.locator('.masthead').screenshot({ path: testInfo.outputPath(`header-${theme}-${width}.png`) });
        const dialog = await openHistory(page);
        await expect(stat(page, 'Rounds completed')).toHaveText('0');
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`history-${theme}-${width}.png`) });
      });
    }
  });
}
