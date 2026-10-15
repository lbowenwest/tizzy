import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page) {
  await page.route('**/words/answers/5.txt', (route) => route.fulfill({ body: 'chair\n' }));
  await page.route('**/words/5.txt', (route) => route.fulfill({ body: 'chair\ncargo\ncivic\n' }));
  await page.goto('/');
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
}
const entry = (page: Page) => page.getByRole('group', { name: 'Your guess', exact: true });

test('keyboard shows strongest known feedback and never downgrades a matched duplicate', async ({ page }) => {
  await fixture(page);
  await page.keyboard.type('CARGO');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'C', exact: true })).toHaveClass(/correct/);
  await expect(page.getByRole('button', { name: 'A', exact: true })).toHaveClass(/present/);
  await expect(page.getByRole('button', { name: 'G', exact: true })).toHaveClass(/unavailable/);
  await page.keyboard.type('CIVIC');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'C', exact: true })).toHaveClass(/correct/);
  await expect(page.getByRole('button', { name: 'I', exact: true })).toHaveClass(/correct/);
  await expect(page.getByRole('button', { name: 'V', exact: true })).toHaveClass(/unavailable/);
});

test('Enter activates a focused letter button normally rather than submitting a guess', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: 'Q', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(entry(page)).toHaveText('Q');
  await expect(page.getByText('Guess 1 of 5')).toBeVisible();
});

test('physical shortcuts and modal controls do not change play, and paste still works', async ({ page }) => {
  await fixture(page);
  await entry(page).focus();
  await page.keyboard.press('ControlOrMeta+Shift+X');
  await expect(entry(page)).toHaveText('Tap letters below');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Preset').focus();
  await page.keyboard.press('s');
  await expect(dialog.getByLabel('Preset')).toHaveValue('sprint');
  await expect(page.locator('.guess-value')).toHaveText('');
  await page.keyboard.press('Escape');
  await expect(entry(page)).toHaveText('Tap letters below');
  await entry(page).evaluate((element) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'chair');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect(entry(page)).toHaveText('CHAIR');
  await page.keyboard.press('Enter');
  // Enter on the restored Settings button must retain its ordinary activation.
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await entry(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Nicely found');
});

test.describe('touch-first keyboard', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 844 } });
  test('has staggered rows with Enter and Delete, and no editable mobile entry', async ({ page }) => {
    await fixture(page);
    await expect(page.locator('input, textarea, [contenteditable="true"]')).toHaveCount(0);
    await expect(page.locator('.key-row').nth(2).getByRole('button')).toHaveText(['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']);
    await entry(page).tap();
    await expect(page.locator('.keyboard')).toBeVisible();
    const first = await page.getByRole('button', { name: 'Q', exact: true }).boundingBox();
    const second = await page.getByRole('button', { name: 'A', exact: true }).boundingBox();
    expect(second!.x).toBeGreaterThan(first!.x);
    for (const letter of 'CHAIR') await page.getByRole('button', { name: letter, exact: true }).tap();
    await page.getByRole('button', { name: 'Delete last letter' }).tap();
    await expect(entry(page)).toHaveText('CHAI');
    await page.getByRole('button', { name: 'R', exact: true }).tap();
    await page.getByRole('button', { name: 'Check guess' }).tap();
    await expect(page.getByRole('status')).toContainText('Nicely found');
    await page.getByRole('button', { name: 'Next word', exact: true }).tap();
    await page.keyboard.type('CHAIR');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('Nicely found');
  });
});
