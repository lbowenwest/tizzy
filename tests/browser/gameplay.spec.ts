import { expect, test, type Page } from '@playwright/test';
import { enterWord } from './entry';

async function wordFixtures(page: Page) {
  const fixtures: Record<number, { answer: string; guesses: string }> = {
    4: { answer: 'camp', guesses: 'camp\ncoat\ncare\n' },
    5: { answer: 'chair', guesses: 'chair\ncargo\nclean\ncaper\ncater\n' },
    6: { answer: 'castle', guesses: 'castle\ncandle\ncarton\n' },
  };
  for (const [length, fixture] of Object.entries(fixtures)) {
    await page.route(`**/words/${length}.txt`, (route) => route.fulfill({ body: fixture.guesses }));
    await page.route(`**/words/answers/${length}.txt`, (route) => route.fulfill({ body: fixture.answer + '\n' }));
  }
}
const entry = (page: Page) => page.getByLabel('Your guess', { exact: true });
async function guess(page: Page, value: string) {
  await enterWord(page, value);
  await entry(page).press('Enter');
}
async function settings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog');
}

test('consecutive words work with physical typing and return focus to the non-editable entry', async ({ page }) => {
  await wordFixtures(page);
  await page.goto('/');
  await expect(entry(page)).toBeFocused();
  await page.keyboard.type('CHAIR');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Nicely found');
  await expect(page.getByRole('button', { name: 'Next word', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(entry(page)).toBeFocused();
  await page.keyboard.type('CHAIR');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Nicely found');
});

test('reject invalid and incomplete guesses, then exhaust five valid guesses', async ({ page }) => {
  await wordFixtures(page);
  await page.goto('/');
  await guess(page, 'HA');
  await expect(page.getByRole('status')).toContainText('Enter all 5');
  await guess(page, 'CZZZZ');
  await expect(page.getByRole('status')).toContainText('no guess used');
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  for (let attempt = 0; attempt < 5; attempt++) await guess(page, 'CARGO');
  await expect(page.getByRole('status')).toContainText('That one got away');
  await expect(page.getByRole('status')).toContainText('CHAIR');
  await expect(page.getByRole('img', { name: 'C: right place', exact: true })).toHaveCount(5);
  await expect(page.getByRole('img', { name: 'A: elsewhere in word', exact: true })).toHaveCount(5);
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
});

test('theme is live, rules wait for the next round and saved choices survive reload', async ({ page }) => {
  await wordFixtures(page);
  await page.goto('/');
  await guess(page, 'CARGO');
  await enterWord(page, 'CHA');
  const dialog = await settings(page);
  await dialog.getByLabel('Appearance', { exact: true }).selectOption('club');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'club');
  await dialog.getByLabel('Preset', { exact: true }).selectOption('practice-six');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  await expect(entry(page)).toHaveText('CHA');
  await expect(page.getByText('Guess 2 of 5')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find the five.' })).toBeVisible();
  await guess(page, 'CHAIR');
  await page.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find the six.' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'club');
  await expect(page.getByRole('heading', { name: 'Find the six.' })).toBeVisible();
});

test('a failed word retries the same length, solve advances, six completes the sequence', async ({ page }) => {
  await wordFixtures(page);
  await page.goto('/');
  const dialog = await settings(page);
  await dialog.getByLabel('Preset').selectOption('sequence');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
  for (let index = 0; index < 5; index++) await guess(page, 'COAT');
  await expect(page.getByRole('status')).toContainText('CAMP');
  await page.getByRole('button', { name: 'Another 4-letter word' }).click();
  await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
  await guess(page, 'CAMP');
  await page.getByRole('button', { name: 'Next length' }).click();
  await guess(page, 'CHAIR');
  await page.getByRole('button', { name: 'Next length' }).click();
  await guess(page, 'CASTLE');
  await expect(page.getByRole('status')).toContainText('Round complete');
  await page.getByRole('button', { name: 'New round', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find the four.' })).toBeVisible();
});

test('a sequence preserves its rules throughout replacements and advances', async ({ page }) => {
  await wordFixtures(page);
  await page.goto('/');
  let dialog = await settings(page);
  await dialog.getByLabel('Preset').selectOption('sequence');
  await dialog.getByRole('button', { name: 'Apply now' }).click();
  dialog = await settings(page);
  await dialog.getByLabel('Preset').selectOption('practice');
  await dialog.getByRole('button', { name: 'Save for next round' }).click();
  for (const word of ['CAMP', 'CHAIR', 'CASTLE']) {
    await guess(page, word);
    await page.getByRole('button', { name: word === 'CASTLE' ? 'New round' : 'Next length', exact: true }).click();
  }
  await expect(page.getByText('SINGLE WORD', { exact: true })).toBeVisible();
});

test('native modal blocks background focus, closes with Escape and restores the opener', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'How to play' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.getByRole('button', { name: 'Settings', exact: true }).evaluate((element) => (element as HTMLButtonElement).focus());
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('play and theme fonts make no requests to external hosts', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (request) => hosts.add(new URL(request.url()).hostname));
  await page.goto('/');
  await expect(entry(page)).toBeVisible();
  for (const theme of ['afterhours', 'club', 'letterpress']) {
    const dialog = await settings(page);
    await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await page.evaluate(() => document.fonts.ready);
  }
  expect([...hosts]).toEqual(['127.0.0.1']);
});

test('blocked and corrupt storage do not prevent play', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('word-practice-preferences-v1', '{bad json');
    Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  });
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'letterpress');
  await expect(entry(page)).toBeVisible();
});

for (const theme of ['letterpress', 'afterhours', 'club']) {
  test(`${theme} desktop presentation`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await wordFixtures(page);
    await page.goto('/');
    const dialog = await settings(page);
    await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await page.evaluate(async () => { await document.fonts.ready; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-desktop.png`), fullPage: true });
    await guess(page, 'CHAIR');
    await expect(page.getByRole('status')).toContainText('Nicely found');
  });
}

test.describe('touch presentation', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('play a word by touch, then continue without opening the native keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await wordFixtures(page);
    await page.goto('/');
    await expect(page.getByRole('img', { name: 'C: supplied letter; right place' })).toBeVisible();
    for (const letter of ['C', 'H', 'A', 'I', 'R']) await page.getByRole('button', { name: letter, exact: true }).tap();
    await page.getByRole('button', { name: 'Delete last letter' }).tap();
    await expect(entry(page)).toHaveText('CHAI');
    await page.getByRole('button', { name: 'R', exact: true }).tap();
    await page.getByRole('button', { name: 'Check guess' }).tap();
    await expect(page.getByRole('status')).toContainText('Nicely found');
    await page.getByRole('button', { name: 'Next word', exact: true }).tap();
    await expect(entry(page)).toHaveText('Tap letters below');
    await expect(entry(page)).not.toBeFocused();
    await expect(page.getByText('Guess 1 of 5')).toBeVisible();
  });

  test('short portrait and landscape remain scrollable and preserve typed letters', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await wordFixtures(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'C', exact: true }).tap();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(entry(page)).toHaveText('C');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const letter of ['H', 'A', 'I', 'R']) await page.getByRole('button', { name: letter, exact: true }).tap();
    await page.getByRole('button', { name: 'Check guess' }).tap();
    await expect(page.getByRole('status')).toContainText('Nicely found');
  });

  for (const theme of ['letterpress', 'afterhours', 'club']) {
    for (const width of [320, 390]) {
      test(`${theme} fits a ${width}px touch screen with a six-letter board`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await wordFixtures(page);
        await page.goto('/');
        const dialog = await settings(page);
        await dialog.getByLabel('Appearance', { exact: true }).selectOption(theme);
        await dialog.getByLabel('Preset', { exact: true }).selectOption('practice-six');
        await dialog.getByRole('button', { name: 'Apply now' }).tap();
        await expect(page.getByRole('heading', { name: 'Find the six.' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        expect(await entry(page).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
        const key = await page.getByRole('button', { name: 'Q', exact: true }).boundingBox();
        expect(key!.height).toBeGreaterThanOrEqual(44);
        expect(key!.width).toBeGreaterThanOrEqual(24);
        const keyboard = await page.locator('.keyboard').boundingBox();
        expect(keyboard!.y + keyboard!.height).toBeLessThanOrEqual(844);
        await page.evaluate(async () => { await document.fonts.ready; });
        await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'A', exact: true }).tap();
        await expect(entry(page)).toHaveText('A');
        await entry(page).tap();
        await expect(page.locator('.keyboard')).toBeVisible();
        await expect(page.locator('.play-area input, .play-area textarea, .play-area [contenteditable="true"]')).toHaveCount(0);
        await page.getByRole('button', { name: 'Delete last letter' }).tap();
        for (const letter of 'CASTLE') await page.getByRole('button', { name: letter, exact: true }).tap();
        await page.getByRole('button', { name: 'Check guess' }).tap();
        await expect(page.getByRole('status')).toContainText('Nicely found');
      });
    }
  }
});
