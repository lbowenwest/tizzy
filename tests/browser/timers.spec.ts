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
async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog');
}
async function preset(page: Page, key: string) {
  const dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption(key);
  await dialog.getByRole('button', { name: 'Apply now' }).click();
}
async function guess(page: Page, word: string) {
  await enterWord(page, word);
  await page.getByLabel('Your guess', { exact: true }).press('Enter');
}
const guessClock = (page: Page) => page.getByRole('timer', { name: 'Guess time remaining' });
const wordClock = (page: Page) => page.getByRole('timer', { name: 'Word time remaining' });
const roundClock = (page: Page) => page.getByRole('timer', { name: 'Round time remaining' });
const bar = (page: Page, label: string) => page.getByRole('progressbar', { name: label + ' time remaining' });

for (const scope of ['guess', 'word', 'round'] as const) {
  test(`${scope} expiry preserves checked and unknown guesses plus the unfinished row until continuation`, async ({ page }) => {
    await fixture(page);
    const dialog = await openSettings(page);
    await dialog.getByLabel('Preset').selectOption('sequence');
    await dialog.getByLabel('Unknown submitted word').selectOption('consume');
    if (scope !== 'round') {
      await dialog.getByLabel('Word clock', { exact: true }).selectOption(scope);
      await dialog.getByLabel('Word / guess seconds').fill('10');
    } else {
      await dialog.getByLabel('Overall sequence clock').check();
      await dialog.getByLabel('Round seconds').fill('10');
    }
    await dialog.getByRole('button', { name: 'Apply now' }).click();
    await guess(page, 'COAT');
    await guess(page, 'CZZZ');
    await enterWord(page, 'CAM');
    const checked = page.getByRole('group', { name: 'Guess 1', exact: true });
    const unknown = page.getByRole('group', { name: 'Guess 2: not in word list', exact: true });
    await expect(checked.getByRole('img', { name: 'C: right place', exact: true })).toBeVisible();
    await expect(unknown.getByRole('img', { name: 'Z: unscored; word not in list' })).toHaveCount(3);
    await page.clock.fastForward(10000);
    await expect(page.getByRole('status')).toContainText(scope === 'round' ? 'Round time is up' : 'Word time is up');
    await expect(checked.getByRole('img', { name: 'C: right place', exact: true })).toBeVisible();
    await expect(checked.getByRole('img', { name: 'A: elsewhere in word', exact: true })).toBeVisible();
    await expect(unknown.getByRole('img', { name: 'Z: unscored; word not in list' })).toHaveCount(3);
    const unfinished = page.getByRole('group', { name: 'Guess 3: not scored', exact: true });
    await expect(unfinished).toHaveText('C✓AM');
    await expect(unfinished.getByRole('img', { name: 'A: not scored', exact: true })).toBeVisible();
    await expect(page.getByText('2 of 5 guesses used')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Last entry was not scored');
    await page.clock.runFor(20000);
    await expect(unfinished).toHaveText('C✓AM');
    await page.getByRole('button', { name: scope === 'round' ? 'New round' : 'Another 4-letter word', exact: true }).click();
    await expect(page.getByText('Guess 1 of 5')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Guess 3', exact: true })).toHaveText('');
  });
}

test('round expiry after an unknown word ends the word does not show that word as an unfinished entry', async ({ page }) => {
  await fixture(page);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption('sequence');
  await dialog.getByLabel('Unknown submitted word').selectOption('fail');
  await dialog.getByLabel('Overall sequence clock').check();
  await dialog.getByLabel('Round seconds').fill('10');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await guess(page, 'CZZZ');
  await expect(page.getByRole('status')).toContainText('Unknown submitted word: this word has ended');
  await page.clock.fastForward(10000);
  await expect(page.getByRole('status')).toContainText('Round time is up');
  await expect(page.getByRole('status')).not.toContainText('Last entry was not scored');
  await expect(page.getByRole('group', { name: 'Guess 1', exact: true })).toHaveText('');
});

test('giving up pauses the final until a same-length retry, without refilling its budget', async ({ page }) => {
  await fixture(page);
  await preset(page, 'final');
  await guess(page, 'COAT');
  await enterWord(page, 'CAM');
  await page.clock.runFor(5000);
  await page.getByRole('button', { name: 'Give up', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Word given up');
  await expect(page.getByRole('status')).toContainText('CAMP');
  await expect(page.getByRole('group', { name: 'Guess 2: not scored', exact: true })).toHaveText('C✓AM');
  await expect(roundClock(page)).toHaveText('1:25');
  await page.clock.runFor(120000);
  await expect(roundClock(page)).toHaveText('1:25');
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 85);
  await expect(page.getByRole('status')).toContainText('Round timer paused');
  await page.getByRole('button', { name: 'Another 4-letter word', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
  await expect(roundClock(page)).toHaveText('1:25');
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 85);
  await page.clock.runFor(5000);
  await expect(roundClock(page)).toHaveText('1:20');
  await expect(page.getByText('Guess 1 · Unlimited', { exact: true })).toBeVisible();
  await enterWord(page, 'CA');
  // The still-visible action cannot evade expiry while interval callbacks are suspended.
  await page.clock.setSystemTime(new Date(await page.evaluate(() => Date.now()) + 90000));
  await page.getByRole('button', { name: 'Give up', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Round time is up');
  await expect(page.getByRole('status')).not.toContainText('Word given up');
  await expect(page.getByRole('group', { name: 'Guess 1: not scored', exact: true })).toHaveText('C✓A');
});

test('solved lengths pause numbers and progress through dialogs and background wake-ups, then resume exactly', async ({ page }) => {
  await fixture(page);
  await preset(page, 'final');
  await page.clock.runFor(4500);
  await guess(page, 'CAMP');
  await expect(roundClock(page)).toHaveText('1:26');
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 85.5);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Appearance', { exact: true }).selectOption('afterhours');
  await page.clock.fastForward(180000);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('focus'));
  });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('status')).toContainText('Nicely found');
  await expect(page.getByRole('status')).toContainText('Round timer paused');
  await expect(roundClock(page)).toHaveText('1:26');
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 85.5);
  await page.getByRole('button', { name: 'Next length' }).click();
  await expect(page.getByRole('heading', { name: 'Find the five.' })).toBeVisible();
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 85.5);
  await page.clock.runFor(5500);
  await guess(page, 'CHAIR');
  await page.clock.fastForward(120000);
  await expect(roundClock(page)).toHaveText('1:20');
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 80);
  await page.getByRole('button', { name: 'Next length' }).click();
  await expect(page.getByRole('heading', { name: 'Find the six.' })).toBeVisible();
  await expect(roundClock(page)).toHaveText('1:20');
  await enterWord(page, 'CAS');
  await page.clock.runFor(80000);
  await expect(page.getByRole('status')).toContainText('Round time is up');
});

test('guess progress shrinks precisely, refills on a spent guess and empties on expiry', async ({ page }) => {
  await fixture(page);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await preset(page, 'itv-five');
  await expect(bar(page, 'Guess')).toHaveJSProperty('max', 10);
  await expect(bar(page, 'Guess')).toHaveJSProperty('value', 10);
  await page.clock.runFor(4500);
  await expect(guessClock(page)).toHaveText('0:06');
  await expect(bar(page, 'Guess')).toHaveJSProperty('value', 5.5);
  await expect(bar(page, 'Guess')).toHaveAttribute('aria-valuetext', '6 of 10 seconds remaining');
  await guess(page, 'CARGO');
  await expect(bar(page, 'Guess')).toHaveJSProperty('value', 10);
  await page.clock.runFor(10000);
  await expect(bar(page, 'Guess')).toHaveJSProperty('value', 0);
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(bar(page, 'Guess')).toHaveJSProperty('value', 10);
});

test('word and round bars follow their independent clocks and freeze with the right result', async ({ page }) => {
  await fixture(page);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption('final');
  await dialog.getByLabel('Word clock', { exact: true }).selectOption('word');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await expect(bar(page, 'Word')).toHaveJSProperty('max', 10);
  await expect(bar(page, 'Round')).toHaveJSProperty('max', 90);
  await page.clock.runFor(4000);
  await guess(page, 'COAT');
  await expect(bar(page, 'Word')).toHaveJSProperty('value', 6);
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 86);
  await guess(page, 'CAMP');
  await page.clock.runFor(2000);
  await expect(bar(page, 'Word')).toHaveJSProperty('value', 6);
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 86);
  await page.getByRole('button', { name: 'Next length' }).click();
  await expect(bar(page, 'Word')).toHaveJSProperty('value', 10);
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 86);
  await page.clock.fastForward(86000);
  await expect(bar(page, 'Word')).toHaveJSProperty('value', 0);
  await expect(bar(page, 'Round')).toHaveJSProperty('value', 0);
});

test('ITV main-round preset has a ten-second guess clock and fails only the word', async ({ page }) => {
  await fixture(page);
  await preset(page, 'itv-five');
  await expect(guessClock(page)).toHaveText('0:10');
  await page.clock.runFor(4000);
  await expect(guessClock(page)).toHaveText('0:06');
  await guess(page, 'CARGO');
  await expect(guessClock(page)).toHaveText('0:10');
  await page.clock.runFor(10000);
  await expect(page.getByRole('status')).toContainText('Word time is up');
  await expect(page.getByRole('status')).toContainText('CHAIR');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(guessClock(page)).toHaveText('0:10');
});

test('final sprint has unlimited guesses and one ninety-second clock across lengths', async ({ page }) => {
  await fixture(page);
  await preset(page, 'final');
  await expect(roundClock(page)).toHaveText('1:30');
  await expect(guessClock(page)).not.toBeVisible();
  for (let attempt = 0; attempt < 12; attempt++) await guess(page, attempt % 2 ? 'COAT' : 'CZZZ');
  await expect(page.getByText('Guess 13 · Unlimited', { exact: true })).toBeVisible();
  const board = page.getByRole('group', { name: 'Guess board' });
  await expect(board.locator('.board-row')).toHaveCount(13);
  await expect(board.getByRole('group', { name: 'Guess 13', exact: true })).toBeInViewport();
  expect(await board.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect(page.getByRole('group', { name: 'On-screen keyboard' })).toBeVisible();
  await page.clock.runFor(5000);
  await guess(page, 'CAMP');
  await page.clock.runFor(5000);
  await expect(roundClock(page)).toHaveText('1:25');
  await page.getByRole('button', { name: 'Next length' }).click();
  await expect(page.getByText('Guess 1 · Unlimited', { exact: true })).toBeVisible();
  for (let attempt = 0; attempt < 12; attempt++) await guess(page, attempt % 2 ? 'CARGO' : 'CZZZZ');
  await page.clock.runFor(5000);
  await expect(roundClock(page)).toHaveText('1:20');
  await enterWord(page, 'CHA');
  await page.clock.runFor(80000);
  await expect(page.getByRole('status')).toContainText('Round time is up');
  await expect(page.getByText('12 guesses used', { exact: true })).toBeVisible();
  await expect(board.getByRole('group', { name: 'Guess 13: not scored', exact: true })).toHaveText('C✓HA');
  await expect(board.locator('.board-row')).toHaveCount(13);
  await board.evaluate((element) => { element.scrollTop = 0; });
  await expect(board.getByRole('group', { name: 'Guess 1: not in word list', exact: true })).toBeInViewport();
  await expect(board.getByRole('group', { name: 'Guess 2', exact: true }).getByRole('img', { name: 'G: not in word' })).toBeVisible();
  await page.getByRole('button', { name: 'New round', exact: true }).click();
  await expect(page.getByText('Guess 1 · Unlimited', { exact: true })).toBeVisible();
  await expect(board.locator('.board-row')).toHaveCount(5);
});

test('per-word time continues across guesses and a timeout retries the same sequence length', async ({ page }) => {
  await fixture(page);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption('sequence');
  await dialog.getByLabel('Word clock', { exact: true }).selectOption('word');
  await dialog.getByLabel('Word / guess seconds').fill('12');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await page.clock.runFor(5000);
  await guess(page, 'COAT');
  await expect(wordClock(page)).toHaveText('0:07');
  await page.clock.runFor(7000);
  await expect(page.getByRole('status')).toContainText('Word time is up');
  await page.getByRole('button', { name: 'Another 4-letter word' }).click();
  await expect(wordClock(page)).toHaveText('0:12');
});

test('free rejections do not reset a clock, spent unknown guesses do, and changes wait for a new round', async ({ page }) => {
  await fixture(page);
  let dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption('itv-five');
  await dialog.getByLabel('Unknown submitted word').selectOption('reject');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await page.clock.runFor(4000);
  await guess(page, 'CZZZZ');
  await expect(guessClock(page)).toHaveText('0:06');
  dialog = await openSettings(page);
  await dialog.getByLabel('Unknown submitted word').selectOption('consume');
  await dialog.getByLabel('Word / guess seconds').fill('20');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await expect(guessClock(page)).toHaveText('0:06');
  await guess(page, 'CZZZZ');
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  await guess(page, 'CHAIR');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await page.clock.runFor(4000);
  await guess(page, 'CZZZZ');
  await expect(page.getByText('Guess 2 of 5')).toBeVisible();
  await expect(guessClock(page)).toHaveText('0:20');
});

test('clocks keep running with settings open, and the round wins simultaneous expiry', async ({ page }) => {
  await fixture(page);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption('final');
  await dialog.getByLabel('Word clock', { exact: true }).selectOption('guess');
  await dialog.getByLabel('Word / guess seconds').fill('10');
  await dialog.getByLabel('Round seconds').fill('10');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await openSettings(page);
  await page.clock.fastForward(10000);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('status')).toContainText('Round time is up');
  await expect(page.getByRole('status')).not.toContainText('Word time is up');
});

test('late submission after a suspended clock cannot turn expiry into a win', async ({ page }) => {
  await fixture(page);
  await preset(page, 'itv-five');
  // Advance Date without running timers: emulate JS suspended in a background tab.
  await page.clock.setSystemTime(new Date('2026-03-01T12:00:12Z'));
  await guess(page, 'CHAIR');
  await expect(page.getByRole('status')).toContainText('Word time is up');
  await expect(page.getByRole('status')).not.toContainText('Nicely found');
  await expect(page.getByRole('group', { name: 'Guess 1: not scored', exact: true })).toHaveText('C✓HAIR');
  await expect(page.getByText('0 of 5 guesses used')).toBeVisible();
});

test('returning to a suspended tab immediately reconciles the round deadline', async ({ page }) => {
  await fixture(page);
  await preset(page, 'final');
  await page.clock.setSystemTime(new Date('2026-03-01T12:02:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('status')).toContainText('Round time is up');
});

test('a completed final stops its clock instead of expiring on the result screen', async ({ page }) => {
  await fixture(page);
  await preset(page, 'final');
  for (const word of ['CAMP', 'CHAIR']) {
    await guess(page, word);
    await page.getByRole('button', { name: 'Next length' }).click();
  }
  await guess(page, 'CASTLE');
  await expect(page.getByRole('status')).toContainText('Round complete');
  await page.clock.runFor(120000);
  await expect(page.getByRole('status')).toContainText('Round complete');
  await expect(roundClock(page)).toHaveText('1:30');
});

test('timer controls validate durations, persist choices and restore the preset', async ({ page }) => {
  await fixture(page);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption('itv-four');
  await dialog.getByLabel('Word / guess seconds').fill('0');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Word / guess seconds').fill('10');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await page.reload();
  await expect(guessClock(page)).toHaveText('0:10');
  const reopened = await openSettings(page);
  await expect(reopened.getByLabel('Preset')).toHaveValue('itv-four');
  await expect(reopened.getByLabel('Unknown submitted word')).toHaveValue('fail');
});

test('turning a word clock off preserves a valid duration and discards incomplete disabled edits', async ({ page }) => {
  await fixture(page);
  let dialog = await openSettings(page);
  await dialog.getByLabel('Preset').selectOption('itv-five');
  await dialog.getByLabel('Word / guess seconds').fill('20');
  await dialog.getByLabel('Word clock', { exact: true }).selectOption('off');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await page.reload();
  dialog = await openSettings(page);
  await expect(dialog.getByLabel('Word / guess seconds')).toHaveValue('20');
  await dialog.getByLabel('Word clock', { exact: true }).selectOption('guess');
  await dialog.getByLabel('Word / guess seconds').fill('');
  await dialog.getByLabel('Word clock', { exact: true }).selectOption('off');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await page.reload();
  dialog = await openSettings(page);
  await expect(dialog.getByLabel('Word / guess seconds')).toHaveValue('20');
});

test('changing appearance does not restart a live clock or discard the entry', async ({ page }) => {
  await fixture(page);
  await preset(page, 'itv-five');
  await enterWord(page, 'CH');
  await page.clock.runFor(4000);
  const dialog = await openSettings(page);
  await dialog.getByLabel('Appearance', { exact: true }).selectOption('club');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(guessClock(page)).toHaveText('0:06');
  await expect(page.getByLabel('Your guess', { exact: true })).toHaveText('CH');
  await page.clock.runFor(6000);
  await expect(page.getByRole('status')).toContainText('Word time is up');
});

test.describe('mobile timed play', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 844 } });
  for (const theme of ['letterpress', 'afterhours', 'club']) {
    test(`${theme} can give up by touch and explicitly retry the same length`, async ({ page }, testInfo) => {
      await fixture(page);
      const dialog = await openSettings(page);
      await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
      await dialog.getByLabel('Preset').selectOption('final');
      await dialog.getByRole('button', { name: 'Apply now' }).tap();
      for (const letter of 'COAT') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.getByRole('button', { name: 'Check guess' }).tap();
      for (const letter of 'CAM') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.clock.runFor(5000);
      const button = page.getByRole('button', { name: 'Give up', exact: true });
      const size = await button.boundingBox();
      expect(size!.width).toBeGreaterThanOrEqual(44);
      expect(size!.height).toBeGreaterThanOrEqual(44);
      await button.tap();
      await expect(page.getByRole('status')).toContainText('Word given up');
      await expect(page.getByRole('status')).toContainText('CAMP');
      await expect(page.getByRole('group', { name: 'Guess 1', exact: true }).getByRole('img', { name: 'C: right place', exact: true })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Guess 2: not scored', exact: true })).toHaveText('C✓AM');
      await expect(roundClock(page)).toHaveText('1:25');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`give-up-${theme}-320.png`), fullPage: true });
      await page.clock.runFor(2500);
      await page.getByRole('button', { name: 'Another 4-letter word', exact: true }).tap();
      await expect(roundClock(page)).toHaveText('1:25');
      await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Your guess', exact: true })).toHaveText('Tap letters below');
      await expect(page.locator('.play-area input, .play-area textarea, .play-area [contenteditable="true"]')).toHaveCount(0);
      await page.clock.runFor(5000);
      for (const letter of 'CAMP') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.getByRole('button', { name: 'Check guess' }).tap();
      await page.clock.fastForward(90000);
      await expect(page.getByRole('status')).toContainText('Nicely found');
      await expect(page.getByRole('status')).toContainText('Round timer paused');
      await expect(roundClock(page)).toHaveText('1:20');
      await expect(bar(page, 'Round')).toHaveJSProperty('value', 80);
      await page.getByRole('button', { name: 'Next length', exact: true }).tap();
      await expect(page.getByRole('heading', { name: 'Find the five.' })).toBeVisible();
      await expect(roundClock(page)).toHaveText('1:20');
    });
    test(`${theme} final keeps unlimited touch guesses in a scrollable board through expiry`, async ({ page }, testInfo) => {
      await fixture(page);
      const dialog = await openSettings(page);
      await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
      await dialog.getByLabel('Preset').selectOption('final');
      await dialog.getByRole('button', { name: 'Apply now' }).tap();
      const board = page.getByRole('group', { name: 'Guess board' });
      const initialHeight = await board.evaluate((element) => element.clientHeight);
      for (let attempt = 0; attempt < 12; attempt++) {
        for (const letter of attempt % 2 ? 'COAT' : 'CZZZ') await page.getByRole('button', { name: letter, exact: true }).tap();
        await page.getByRole('button', { name: 'Check guess' }).tap();
      }
      await expect(page.getByText('Guess 13 · Unlimited', { exact: true })).toBeVisible();
      await expect(board.locator('.board-row')).toHaveCount(13);
      expect(await board.evaluate((element) => element.clientHeight)).toBeLessThanOrEqual(initialHeight + 1);
      await expect(board.getByRole('group', { name: 'Guess 13', exact: true })).toBeInViewport();
      await expect(page.getByRole('group', { name: 'On-screen keyboard' })).toBeInViewport({ ratio: 1 });
      for (const letter of 'CAM') await page.getByRole('button', { name: letter, exact: true }).tap();
      await expect(board.getByRole('group', { name: 'Guess 13', exact: true })).toBeInViewport({ ratio: 1 });
      expect(await board.evaluate((element) => {
        const latest = element.lastElementChild!.querySelector('.tile')!.getBoundingClientRect();
        const viewport = element.getBoundingClientRect();
        return latest.top >= viewport.top - 1 && latest.bottom <= viewport.bottom + 1;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.locator('.play-area input, .play-area textarea, .play-area [contenteditable="true"]')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`unlimited-viewport-${theme}-320.png`) });
      await page.screenshot({ path: testInfo.outputPath(`unlimited-${theme}-320.png`), fullPage: true });
      await page.clock.fastForward(90000);
      await expect(page.getByRole('status')).toContainText('Round time is up');
      await expect(board.getByRole('group', { name: 'Guess 13: not scored', exact: true })).toHaveText('C✓AM');
      await expect(board.getByRole('group', { name: 'Guess 13: not scored', exact: true })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath(`unlimited-expiry-draft-${theme}-320.png`) });
      await board.evaluate((element) => { element.scrollTop = 0; });
      await expect(board.getByRole('group', { name: 'Guess 1: not in word list', exact: true })).toBeInViewport();
      await expect(board.getByRole('group', { name: 'Guess 2', exact: true }).getByRole('img', { name: 'C: right place', exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`unlimited-expiry-${theme}-320.png`), fullPage: true });
    });
    test(`${theme} shows both clocks without overflow`, async ({ page }, testInfo) => {
      await fixture(page);
      const dialog = await openSettings(page);
      await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
      await dialog.getByLabel('Preset').selectOption('final');
      await dialog.getByLabel('Word clock', { exact: true }).selectOption('guess');
      await dialog.getByRole('button', { name: 'Apply now' }).tap();
      await expect(guessClock(page)).toHaveText('0:10');
      await expect(roundClock(page)).toHaveText('1:30');
      await page.clock.runFor(3000);
      await expect(bar(page, 'Guess')).toHaveJSProperty('value', 7);
      await expect(bar(page, 'Round')).toHaveJSProperty('value', 87);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.evaluate(async () => { await document.fonts.ready; });
      expect(await page.getByRole('heading', { name: 'Find the four.' }).evaluate((heading) =>
        heading.getBoundingClientRect().height <= parseFloat(getComputedStyle(heading).lineHeight) + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`clocks-${theme}-320.png`), fullPage: true });
      for (const letter of 'CAMP') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.getByRole('button', { name: 'Check guess' }).tap();
      await expect(page.getByRole('status')).toContainText('Nicely found');
      await page.getByRole('button', { name: 'Next length' }).tap();
      for (const letter of 'CARGO') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.getByRole('button', { name: 'Check guess' }).tap();
      for (const letter of 'CHA') await page.getByRole('button', { name: letter, exact: true }).tap();
      await page.clock.fastForward(10000);
      await expect(page.getByRole('status')).toContainText('Word time is up');
      await expect(page.getByRole('group', { name: 'Guess 1', exact: true }).getByRole('img', { name: 'G: not in word', exact: true })).toBeVisible();
      await expect(page.getByRole('group', { name: 'Guess 2: not scored', exact: true })).toHaveText('C✓HA');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`expiry-${theme}-320.png`), fullPage: true });
    });
  }
});
