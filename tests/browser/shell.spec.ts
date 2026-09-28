import { expect, test } from '@playwright/test';

test('the built app opens its placeholder shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Word practice' })).toBeVisible();
});

test('static word lists and attribution are served', async ({ request }) => {
  for (const name of ['4.txt', '5.txt', '6.txt', 'COPYRIGHT.txt']) {
    const response = await request.get(`/words/${name}`);
    expect(response.ok()).toBe(true);
    expect((await response.text()).length).toBeGreaterThan(0);
  }
});
