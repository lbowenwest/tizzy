import { expect, test } from '@playwright/test';

test('the app opens its diagnostic shell', async ({ page }) => {
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

test('the app loads all three local word lists', async ({ page }) => {
  const wordRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/words/')) wordRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('4-letter: 2,640');
  await expect(page.getByRole('status')).toContainText('5-letter: 5,224');
  await expect(page.getByRole('status')).toContainText('6-letter: 8,492');
  expect(new Set(wordRequests.map((url) => new URL(url).pathname))).toEqual(
    new Set(['/words/4.txt', '/words/5.txt', '/words/6.txt']),
  );
  expect(wordRequests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);
});

test('a missing word list gives a visible error', async ({ page }) => {
  await page.route('**/words/5.txt', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not load word lists');
});

test('a malformed word list gives a visible error', async ({ page }) => {
  await page.route('**/words/6.txt', (route) => route.fulfill({ body: 'not-a-six-letter-word\n' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not load word lists');
});
