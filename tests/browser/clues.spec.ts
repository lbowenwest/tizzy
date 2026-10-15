import { expect, test, type Page } from '@playwright/test';
import { enterWord } from './entry';

// CARGO's marks for CHAIR fit no other routed five-letter guess.
const fiveLetterGuesses = ['chair', 'cargo', 'stair', 'sheep', 'cheer', 'cabin', 'bravo', 'eerie', 'scarf', 'cheap'];
async function fixture(page: Page, preferences?: object) {
  if (preferences) {
    await page.addInitScript((value) => window.localStorage.setItem('word-practice-preferences-v1', value), JSON.stringify(preferences));
  }
  await page.route('**/words/answers/5.txt', (route) => route.fulfill({ body: 'chair\n' }));
  await page.route('**/words/5.txt', (route) => route.fulfill({ body: fiveLetterGuesses.join('\n') + '\n' }));
  await page.route('**/words/clues/5.txt', (route) => route.fulfill({ body: 'chair cargo\n' }));
  await page.goto('/');
  await expect(page.getByLabel('Your guess', { exact: true })).toBeVisible();
}
const inOne = { theme: 'letterpress', preset: 'in-one' };
async function guess(page: Page, word: string) {
  await enterWord(page, word);
  await page.getByLabel('Your guess', { exact: true }).press('Enter');
}
const key = (page: Page, letter: string) => page.getByRole('button', { name: letter, exact: true });

test('In one starts from the clue with one row, no first letter and one try', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Preset').selectOption('in-one');
  await page.getByRole('button', { name: 'Apply now' }).click();

  const clue = page.getByRole('group', { name: 'Given clue: CARGO' });
  await expect(clue.getByRole('img')).toHaveText(['C✓', 'A↔', 'R↔', 'G×', 'O×']);
  await expect(page.getByText('SINGLE WORD · CLUE')).toBeVisible();
  await expect(page.getByText('Try 1 of 1')).toBeVisible();
  await expect(page.getByText('One clue given')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Guess board' }).getByRole('group')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Try 1', exact: true }).getByRole('img').first()).toHaveAccessibleName('empty');
  await expect(page.getByRole('status')).toHaveText('Only one word fits the clue.');
  await expect(key(page, 'C')).toHaveClass(/correct/);
  await expect(key(page, 'A')).toHaveClass(/present/);
  await expect(key(page, 'G')).toHaveClass(/unavailable/);

  await guess(page, 'ZZZZZ');
  await expect(page.getByRole('status')).toContainText('Not in the word list');
  await expect(page.getByLabel('Your guess', { exact: true })).toHaveText('Tap letters below');
  await expect(page.getByText('Try 1 of 1')).toBeVisible();

  await guess(page, 'CHAIR');
  await expect(page.getByRole('status')).toContainText('Nicely found');
  await expect(clue).toBeVisible();
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  const stats = page.getByRole('dialog', { name: 'Your stats.' });
  await expect(stats.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'In one' })).toHaveAttribute('aria-pressed', 'true');
  // One try per word, so In one shows solve times instead of a guess distribution.
  await expect(stats.getByRole('list', { name: 'Guess distribution' })).toHaveCount(0);
  await expect(stats.getByRole('img', { name: /^Last 1 word, oldest first: 0:\d\d$/ })).toBeVisible();
  await expect(stats).toContainText('Solve at least two words to see your spread.');
  await expect(stats.locator('.stats dl div').filter({ hasText: 'Fastest' }).locator('dd')).toHaveText(/0:\d\d/);
  await expect(stats.getByRole('list', { name: 'Recent words' }).getByRole('listitem').first())
    .toHaveText(/CHAIR.*Solved.*0:\d\d/);
});

test('a rejected try ends In one with its reason and the answer', async ({ page }) => {
  await fixture(page, inOne);
  await guess(page, 'STAIR');
  const result = page.getByRole('status');
  await expect(result).toContainText('That one got away');
  await expect(result).toContainText("STAIR doesn't fit. 1st letter must be C.");
  await expect(result).toContainText('The word was CHAIR.');
  await expect(page.getByText('1 of 1 tries used')).toBeVisible();
  const rejected = page.getByRole('group', { name: 'Try 1: rejected; 1st letter must be C.' });
  await expect(rejected.getByRole('img')).toHaveText(['S✕', 'T✕', 'A✕', 'I✕', 'R✕']);
  await expect(rejected.getByRole('img').first()).toHaveAccessibleName('S: not scored; word does not fit the clue');
});

for (const width of [320, 390]) {
  test.describe(`${width}px clue puzzles`, () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width, height: 700 } });
    for (const theme of ['letterpress', 'afterhours', 'club'] as const) {
      test(`${theme} plays by touch without horizontal overflow`, async ({ page }, testInfo) => {
        await fixture(page, { ...inOne, theme });
        const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
        for (const letter of 'CABIN') await key(page, letter).tap();
        for (const name of ['Check guess', 'Delete last letter']) await expect(page.getByRole('button', { name })).toBeInViewport();
        expect(await fits()).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`clue-${theme}-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Check guess' }).tap();
        await expect(page.getByRole('status')).toContainText("CABIN doesn't fit.");
        await expect(page.getByRole('button', { name: /Next word/ })).toBeInViewport();
        expect(await fits()).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`clue-${theme}-${width}-result.png`), fullPage: true });
      });
    }
  });
}
