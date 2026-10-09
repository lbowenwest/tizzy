import { expect, test } from '@playwright/test';

test('appearance changes without resetting the word or changing its preset', async ({ page }) => {
  await page.goto('/prototypes/index.html');
  await page.getByLabel('Letters after the supplied C').fill('HAIR');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Starting point').selectOption('practice');
  await page.getByLabel('Appearance').selectOption('club');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'club');
  await expect(page.getByLabel('Starting point')).toHaveValue('practice');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByLabel('Letters after the supplied C')).toHaveValue('HAIR');
  await expect(page.locator('#play-title')).toHaveText('Find the five.');
  await page.getByRole('link', { name: '02 Afterhours' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'afterhours');
  await expect(page.getByLabel('Letters after the supplied C')).toHaveValue('HAIR');
  await expect(page.locator('.wordmark')).toContainText('word practice');
});

for (const theme of ['letterpress', 'afterhours', 'club']) {
  for (const width of [1360, 390]) {
    test(`${theme} prototype at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/prototypes/index.html?theme=${theme}`);
      await expect(page.locator('body')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.tile')).toHaveCount(25);
      await expect(page.locator('.tile.supplied')).toHaveClass(/correct/);
      await expect(page.locator('.tile.supplied')).toHaveAttribute('aria-label', 'C: supplied letter; right place');
      await expect(page.locator('.fixed-letter')).toHaveCount(0);
      await expect(page.locator('#clock-pill')).toHaveText('∞ Untimed');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${width}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: 'Solved', exact: true }).click();
      await expect(page.locator('#result')).toContainText('The word was CHAIR.');
      await page.getByRole('button', { name: 'Next example' }).click();
      await expect(page.locator('#guess-input')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test('settings preview and same-length sequence retry', async ({ page }) => {
  await page.goto('/prototypes/index.html');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Starting point').selectOption('sequence');
  await expect(page.getByLabel('Word length')).toBeDisabled();
  await page.getByLabel('Word clock', { exact: true }).selectOption('guess');
  await expect(page.getByLabel('Starting point')).toHaveValue('custom');
  await page.getByRole('button', { name: 'Apply to next example' }).click();
  await expect(page.locator('#play-title')).toHaveText('Find the four.');
  await expect(page.locator('#clock-pill')).toContainText('00:30 / guess');
  await page.getByRole('button', { name: 'Word failed', exact: true }).click();
  await page.getByRole('button', { name: 'Next example' }).click();
  await expect(page.locator('#play-title')).toHaveText('Find the four.');
  await page.getByRole('button', { name: 'Solved', exact: true }).click();
  await page.getByRole('button', { name: 'Next length' }).click();
  await expect(page.locator('#play-title')).toHaveText('Find the five.');
  await page.getByRole('button', { name: 'Unavailable' }).click();
  await expect(page.getByRole('alert')).toContainText('couldn’t load');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('#board')).toBeVisible();
});

test('touch keys and physical input preview', async ({ page }) => {
  await page.goto('/prototypes/index.html');
  for (const letter of ['H', 'A', 'I', 'R']) {
    await page.getByRole('button', { name: letter, exact: true }).click();
  }
  await expect(page.getByLabel('Letters after the supplied C')).toHaveValue('HAIR');
  await page.getByRole('button', { name: 'Check', exact: false }).click();
  await expect(page.locator('#feedback')).toContainText('Input preview only');
  await page.getByRole('button', { name: 'Delete last letter' }).click();
  await expect(page.getByLabel('Letters after the supplied C')).toHaveValue('HAI');
  await page.getByLabel('Letters after the supplied C').press('End');
  await page.getByLabel('Letters after the supplied C').press('R');
  await expect(page.getByLabel('Letters after the supplied C')).toHaveValue('HAIR');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toContainText('does not check the dictionary');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
