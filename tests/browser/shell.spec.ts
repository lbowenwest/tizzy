import { expect, test } from '@playwright/test';

test('the built app opens its placeholder shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Word practice' })).toBeVisible();
});
