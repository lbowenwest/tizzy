import { expect, test, type Page } from '@playwright/test';
import { enterWord } from './entry';

async function fixture(page: Page, time = '2026-10-16T12:00:00Z', theme = 'letterpress', expectLobby = true) {
  await page.addInitScript((theme) => {
    localStorage.setItem('word-practice-preferences-v1', JSON.stringify({ theme, preset: 'practice-four' }));
    Math.random = () => 0;
  }, theme);
  for (const [length, words] of [[4, 'flat\nfoot\noust\ncare\n'], [5, 'jeans\ncorns\n'], [6, 'tutors\nsplint\n']] as const) {
    await page.route(`**/words/${length}.txt`, (route) => route.fulfill({ body: words }));
    await page.route(`**/words/answers/${length}.txt`, (route) => route.fulfill({ body: words }));
  }
  await page.clock.install({ time: new Date(time) });
  await page.clock.pauseAt(new Date(time));
  await page.goto('/#daily/given');
  if (expectLobby) await expect(page.getByRole('button', { name: 'Start daily climb' })).toBeVisible();
  else await expect(page.getByRole('group', { name: 'Guess board', exact: true })).toBeVisible();
}
const timer = (page: Page) => page.getByRole('timer', { name: 'Total elapsed time' });
async function guess(page: Page, word: string) {
  await enterWord(page, word);
  await page.getByLabel('Your guess', { exact: true }).press('Enter');
}
async function start(page: Page) { await page.getByRole('button', { name: 'Start daily climb' }).click(); }
async function finish(page: Page, words = ['flat', 'jeans', 'tutors']) {
  for (const [index, word] of words.entries()) {
    await page.clock.runFor(2000);
    await guess(page, word);
    if (index < 2) {
      await page.clock.runFor(10000);
      await page.getByRole('button', { name: 'Next length' }).click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Climb complete.' })).toBeVisible();
}

test('daily climb allows unlimited guesses, resumes after reload and sums only word time', async ({ page }) => {
  await fixture(page);
  await page.clock.runFor(60000);
  await start(page);
  await expect(timer(page)).toHaveText('0:00');
  await expect(page.getByRole('button', { name: 'Give up' })).toHaveCount(0);
  for (let index = 0; index < 6; index++) await guess(page, 'foot');
  await expect(page.getByText('Guess 7 · Unlimited', { exact: true })).toBeVisible();
  await guess(page, 'fzzz');
  await expect(page.getByText('Guess 7 · Unlimited', { exact: true })).toBeVisible();
  await page.clock.runFor(15000);
  await page.reload();
  await expect(page.getByText('Guess 7 · Unlimited', { exact: true })).toBeVisible();
  await expect(timer(page)).toHaveText('0:15');
  await guess(page, 'flat');
  await page.clock.runFor(30000);
  await expect(timer(page)).toHaveText('0:15');
  await expect(page.getByRole('button', { name: 'Analyse guesses' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next length' }).click();
  await page.clock.runFor(7000);
  await guess(page, 'jeans');
  await page.reload();
  await expect(timer(page)).toHaveText('0:22');
  await page.clock.runFor(30000);
  await page.getByRole('button', { name: 'Next length' }).click();
  await page.clock.runFor(11000);
  await guess(page, 'tutors');
  const result = page.getByRole('region', { name: 'Daily result' });
  await expect(result.locator('.daily-total')).toContainText('0:33');
  await expect(result.getByRole('row').nth(1)).toContainText('0:15');
  await expect(result.getByRole('row').nth(2)).toContainText('0:07');
  await expect(result.getByRole('row').nth(3)).toContainText('0:11');
  await page.reload();
  await expect(result.locator('.daily-total')).toContainText('0:33');
  await expect(page.getByRole('button', { name: 'Start daily climb' })).toHaveCount(0);
  await result.getByRole('button', { name: 'Analyse 4-letter word' }).click();
  await expect(page.getByRole('dialog').getByRole('list', { name: 'Guess analysis' }).locator(':scope > li')).toHaveCount(7);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  const stats = page.getByRole('dialog', { name: 'Daily record.' });
  await expect(stats).toContainText('0:33');
  await stats.getByRole('button', { name: '2026-10-16' }).click();
  await expect(stats.getByRole('heading', { name: 'Climb complete.' })).toBeVisible();
});

test('hint variants use different courses, keep their own progress and remember the choice on reload', async ({ page }) => {
  await fixture(page);
  await start(page);
  await guess(page, 'flat');
  await page.getByRole('button', { name: 'No first letter', exact: true }).click();
  await start(page);
  await expect(page.getByRole('img', { name: /supplied letter/ })).toHaveCount(0);
  await guess(page, 'care');
  await expect(page.getByText('Guess 2 · Unlimited', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'No first letter', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await guess(page, 'oust');
  await expect(page.getByRole('status')).toContainText('OUST');
  await page.getByRole('button', { name: 'First letter given', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('FLAT');
  await expect(page.getByText('1 guess used', { exact: true })).toBeVisible();
});

test('an open course stays on its puzzle date across midnight, including after reload', async ({ page }) => {
  await fixture(page, '2026-10-16T23:59:50Z');
  await start(page);
  await page.reload();
  await expect(timer(page)).toHaveText('0:00');
  await page.clock.runFor(20000);
  await expect(timer(page)).toHaveText('0:20');
  await expect(page.getByText('You’re finishing the 2026-10-16 climb.', { exact: false })).toBeVisible();
  await guess(page, 'flat');
  await page.getByRole('button', { name: 'Go to today’s climb' }).click();
  await expect(page.getByRole('button', { name: 'Start daily climb' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume 2026-10-16' })).toBeVisible();
});

test('completed results copy without answers and are separate from practice stats', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fixture(page);
  await start(page);
  await finish(page);
  await page.getByRole('button', { name: 'Copy result' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Tizzy Daily Climb · 2026-10-16');
  expect(copied).toContain('Total: 0:06');
  for (const answer of ['flat', 'jeans', 'tutors']) expect(copied.toLowerCase()).not.toContain(answer);
  await page.getByRole('navigation', { name: 'Play mode' }).getByRole('button', { name: 'Practice' }).click();
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your stats.' })).toContainText('No finished words yet.');
});

test('practice and regular climb can play without a first-letter hint', async ({ page }) => {
  await fixture(page);
  for (const key of ['practice-4-hidden', 'sequence-hidden']) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Preset', { exact: true }).selectOption(key);
    await page.getByRole('button', { name: 'Apply now' }).click();
    await expect(page.getByRole('img', { name: /supplied letter/ })).toHaveCount(0);
    await guess(page, 'care');
    await expect(page.getByText('Guess 2 of 5', { exact: true })).toBeVisible();
    await guess(page, 'flat');
    await page.getByRole('button', { name: 'Analyse guesses' }).click();
    await expect(page.getByRole('region', { name: 'Guess 1 review' })).toContainText('4 possible answers');
    await page.keyboard.press('Escape');
    if (key === 'sequence-hidden') {
      await page.getByRole('button', { name: 'Next length' }).click();
      await expect(page.getByRole('img', { name: /supplied letter/ })).toHaveCount(0);
    }
  }
});

test('blocked storage leaves the course playable and reports that it cannot save', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  await start(page);
  await expect(page.getByRole('alert')).toContainText('Progress could not be saved');
  await finish(page);
  await expect(page.getByText('Copy your result to keep it.', { exact: false })).toBeVisible();
});

test('another tab follows the saved course without restarting its clock or losing guesses', async ({ page, context }) => {
  await fixture(page);
  await start(page);
  await page.clock.runFor(3000);
  await guess(page, 'foot');
  const other = await context.newPage();
  await fixture(other, '2026-10-16T12:00:03Z', 'letterpress', false);
  await expect(other.getByText('Guess 2 · Unlimited', { exact: true })).toBeVisible();
  await expect(timer(other)).toHaveText('0:03');
  await guess(other, 'flat');
  await expect(page.getByRole('status')).toContainText('FLAT');
  await expect(timer(page)).toHaveText('0:03');
  await other.getByRole('button', { name: 'Next length' }).click();
  await expect(page.getByRole('heading', { name: 'Find the five.' })).toBeVisible();
  await other.close();
});

for (const theme of ['letterpress', 'afterhours', 'club']) for (const width of [320, 390, 1280]) {
  test(`daily lobby, race and result fit ${theme} at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : width === 390 ? 667 : 900 });
    await fixture(page, '2026-10-16T12:00:00Z', theme);
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await noOverflow();
    await page.screenshot({ path: testInfo.outputPath('daily-lobby.png'), fullPage: true });
    await start(page);
    await noOverflow();
    if (width < 600) {
      const inView = async () => {
        const keyboard = await page.getByRole('group', { name: 'On-screen keyboard' }).boundingBox();
        const board = await page.getByRole('group', { name: 'Guess board', exact: true }).boundingBox();
        expect(keyboard!.y + keyboard!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        expect(board!.y).toBeGreaterThanOrEqual(0);
        expect(board!.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => scrollY)).toBe(0);
      };
      await inView();
      for (let index = 0; index < 6; index++) await guess(page, 'foot');
      await inView();
      await expect(page.getByRole('group', { name: 'Guess 7', exact: true })).toBeInViewport({ ratio: 1 });
      await page.getByRole('group', { name: 'Guess board', exact: true }).evaluate((board) => { board.scrollTop = 0; });
      await expect(page.getByRole('group', { name: 'Guess 1', exact: true })).toBeInViewport({ ratio: 1 });
      await page.getByRole('group', { name: 'Guess board', exact: true }).evaluate((board) => { board.scrollTop = board.scrollHeight; });
    }
    await page.screenshot({ path: testInfo.outputPath('daily-race.png'), fullPage: true });
    await finish(page);
    await noOverflow();
    await page.screenshot({ path: testInfo.outputPath('daily-result.png'), fullPage: true });
  });
}
