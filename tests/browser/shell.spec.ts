import { expect, test } from '@playwright/test';

test('the app opens its diagnostic shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Word practice' })).toBeVisible();
});

test('static word lists and attribution are served', async ({ request }) => {
  const names = ['4.txt', '5.txt', '6.txt', 'COPYRIGHT.txt'];
  for (const name of ['answers/4.txt', 'answers/5.txt', 'answers/6.txt', ...names]) {
    const response = await request.get(`/words/${name}`);
    expect(response.ok()).toBe(true);
    expect((await response.text()).length).toBeGreaterThan(0);
  }
});

test('the app loads answers and guesses for all three lengths', async ({ page }) => {
  const wordRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/words/')) wordRequests.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  const table = page.getByRole('table');
  await expect(table.getByRole('row', { name: '4 1,864 2,640' })).toBeVisible();
  await expect(table.getByRole('row', { name: '5 3,469 5,224' })).toBeVisible();
  await expect(table.getByRole('row', { name: '6 5,316 8,492' })).toBeVisible();
  expect(new Set(wordRequests)).toEqual(new Set([
    '/words/4.txt', '/words/5.txt', '/words/6.txt',
    '/words/answers/4.txt', '/words/answers/5.txt', '/words/answers/6.txt',
  ]));
  expect(wordRequests.every((path) => new URL(path, 'http://127.0.0.1').hostname === '127.0.0.1')).toBe(true);
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

test('a malformed answer list gives a visible error', async ({ page }) => {
  await page.route('**/words/answers/4.txt', (route) => route.fulfill({ body: '' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not load word lists');
});
