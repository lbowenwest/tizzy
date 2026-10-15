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
async function openStats(page: Page) {
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  return page.getByRole('dialog', { name: 'Your stats.' });
}
const tab = (page: Page, group: string, name: string) => page.getByRole('dialog').getByRole('group', { name: group }).getByRole('button', { name, exact: true });
const distribution = (page: Page) => page.getByRole('list', { name: 'Guess distribution' }).getByRole('listitem');
async function applyPreset(page: Page, key: string) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Preset').selectOption(key);
  await page.getByRole('button', { name: 'Apply now' }).click();
}
const stat = (page: Page, name: string) => page.getByRole('dialog').locator('.stats dl div')
  .filter({ has: page.getByText(name, { exact: true }) }).locator('dd');
const recent = (page: Page) => page.getByRole('list', { name: 'Recent words' }).getByRole('listitem');

test('records finished words and summarises them by mode and variant across reloads', async ({ page }) => {
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
    const dialog = await openStats(page);
    await expect(tab(page, 'Mode', 'Practice')).toHaveAttribute('aria-pressed', 'true');
    await expect(tab(page, 'Practice variant', '5 letters')).toHaveAttribute('aria-pressed', 'true');
    await expect(stat(page, 'Played')).toHaveText('3');
    await expect(stat(page, 'Solved')).toHaveText('67%');
    await expect(stat(page, 'Current streak')).toHaveText('1');
    await expect(stat(page, 'Best streak')).toHaveText('1');
    await expect(stat(page, 'Average solve')).toHaveText('0:03');
    await expect(stat(page, 'Rounds completed')).toHaveCount(0);
    await expect.poll(() => distribution(page).evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual([
      '1 guess: 1 word', '2 guesses: 1 word', '3 guesses: 0 words', '4 guesses: 0 words', '5 guesses: 0 words', 'Not solved: 1 word']);
    // The latest word was solved in one guess.
    await expect(distribution(page).first()).toHaveAttribute('data-latest', 'true');
    await expect(recent(page)).toHaveCount(3);
    await expect(recent(page).first()).toHaveText(/CHAIR.*Solved.*1 guess/);
    await expect(recent(page).nth(1)).toHaveText(/CHAIR.*Out of guesses.*5 guesses/);
    await tab(page, 'Practice variant', '4 letters').click();
    await expect(dialog).toContainText('Not played yet.');
    await tab(page, 'Mode', 'Climb').click();
    await expect(dialog.getByRole('group', { name: 'Climb variant' })).toHaveCount(0);
    await expect(dialog).toContainText('Not played yet.');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
});

test('keeps each mode separate and skips words left unfinished by Apply now or reload', async ({ page }) => {
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
  const dialog = await openStats(page);
  await expect(tab(page, 'Mode', 'Sprint')).toHaveAttribute('aria-pressed', 'true');
  await expect(stat(page, 'Played')).toHaveText('1');
  await expect(stat(page, 'Rounds completed')).toHaveText('0');
  await expect(stat(page, 'Round time ran out')).toHaveText('0');
  // Unlimited guesses: at least five rows.
  await expect(distribution(page)).toHaveCount(6);
  await expect(distribution(page).nth(1)).toHaveAccessibleName('2 guesses: 1 word');
  await expect(recent(page)).toHaveCount(1);
  await expect(recent(page).first()).toHaveText(/CAMP.*Solved.*2 guesses/);
  // The unfinished Practice word was not recorded; Practice opens on the variant played last, if any.
  await tab(page, 'Mode', 'Practice').click();
  await expect(tab(page, 'Practice variant', '4 letters')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog).toContainText('Not played yet.');
});

test('words recorded under custom settings are deleted', async ({ page }) => {
  const record = (endedAt: number, group: string, answer: string) => ({ id: `${endedAt}:${answer}`, roundId: endedAt, answer,
    length: 5, format: 'single', group, result: 'solved', reason: null, guesses: 2, unknown: 0, durationMs: 1000, endedAt });
  const seeded = JSON.stringify({ version: 1, records: [record(1, 'custom', 'cargo'), record(2, 'practice', 'chair')] });
  await page.addInitScript((value) => window.localStorage.setItem('word-practice-history-v1', value), seeded);
  await fixture(page);
  await openStats(page);
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

test('In one charts recent solve times and fits a spread once two words are solved', async ({ page }) => {
  const record = (endedAt: number, durationMs: number, result = 'solved') => ({ id: `${endedAt}:chair`, roundId: endedAt, answer: 'chair',
    length: 5, format: 'single', group: 'in-one', result, reason: result === 'solved' ? null : 'attempts', guesses: 1, unknown: 0, durationMs, endedAt });
  const seeded = JSON.stringify({ version: 1, records: [record(1, 10_000), record(2, 40_000), record(3, 70_000, 'failed'), record(4, 20_000)] });
  await page.addInitScript((value) => {
    window.localStorage.setItem('word-practice-history-v1', value);
    window.localStorage.setItem('word-practice-preferences-v1', JSON.stringify({ theme: 'letterpress', preset: 'in-one' }));
  }, seeded);
  await fixture(page);
  const dialog = await openStats(page);
  await expect(stat(page, 'Average solve')).toHaveText('0:23');
  await expect(stat(page, 'Median')).toHaveText('0:20');
  await expect(stat(page, 'Fastest')).toHaveText('0:10');
  await expect(dialog.getByRole('img', { name: 'Last 4 words, oldest first: 0:10, 0:40, not solved (1:10), 0:20' })).toBeVisible();
  // ln(10, 20, 40 seconds) has mean ln 20 and spread ln 2 · √(2/3), so one sigma is about 0:11–0:35.
  await expect(dialog.getByText('About two-thirds of your solves take 0:11–0:35 (shaded).')).toBeVisible();
  await expect(recent(page).nth(1)).toHaveText(/CHAIR.*Out of guesses.*1:10/);
});

test('clearing stats needs confirmation', async ({ page }) => {
  await fixture(page);
  await guess(page, 'CHAIR');
  let dialog = await openStats(page);
  await dialog.getByRole('button', { name: 'Clear stats' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(recent(page)).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Clear stats' }).click();
  await dialog.getByRole('button', { name: 'Confirm clear' }).click();
  await expect(dialog).toContainText('No finished words yet.');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  dialog = await openStats(page);
  await expect(dialog).toContainText('No finished words yet.');
});

test('corrupt history storage shows the empty state without blocking play', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('word-practice-history-v1', '{'));
  await fixture(page);
  const dialog = await openStats(page);
  await expect(dialog).toContainText('No finished words yet.');
  await page.keyboard.press('Escape');
  await guess(page, 'CHAIR');
  await expect(page.getByRole('status')).toContainText('Nicely found');
  await openStats(page);
  await expect(stat(page, 'Played')).toHaveText('1');
});

for (const width of [320, 390]) {
  test.describe(`${width}px stats`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width, height: 700 } });
    for (const theme of ['letterpress', 'afterhours', 'club'] as const) {
      test(`${theme} header and dialog fit without horizontal overflow`, async ({ page }, testInfo) => {
        await page.addInitScript((value) => window.localStorage.setItem('word-practice-preferences-v1', value),
          JSON.stringify({ theme, rules: { format: 'sequence', length: 5, invalid: 'reject', maxGuesses: 5, wordClock: { mode: 'off', seconds: 10 }, roundSeconds: null } }));
        await fixture(page);
        await guess(page, 'COAT');
        await guess(page, 'CAMP');
        const buttons = ['How to play', 'Stats', 'Settings'].map((name) => page.getByRole('button', { name, exact: true }));
        for (const button of buttons) await expect(button).toBeInViewport({ ratio: 1 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.locator('.masthead').screenshot({ path: testInfo.outputPath(`header-${theme}-${width}.png`) });
        const dialog = await openStats(page);
        await expect(stat(page, 'Rounds completed')).toHaveText('0');
        for (const button of await dialog.getByRole('group', { name: 'Mode' }).getByRole('button').all()) await expect(button).toBeInViewport({ ratio: 1 });
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`stats-${theme}-${width}.png`) });
      });
    }
  });
}
