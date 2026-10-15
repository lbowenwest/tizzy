import { expect, test } from '@playwright/test';

test('the app opens with its shared player header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Word practice' })).toBeVisible();
});

test('static word lists and attribution are served', async ({ request }) => {
  const names = ['4.txt', '5.txt', '6.txt', 'COPYRIGHT.txt'];
  for (const name of ['answers/4.txt', 'answers/5.txt', 'answers/6.txt', 'clues/4.txt', 'clues/5.txt', 'clues/6.txt', ...names]) {
    const response = await request.get(`/words/${name}`);
    expect(response.ok()).toBe(true);
    expect((await response.text()).length).toBeGreaterThan(0);
  }
});

test('the app loads answers, guesses and clues for all three lengths', async ({ page }) => {
  const wordRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/words/')) wordRequests.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Guess board', exact: true })).toBeVisible();
  expect(new Set(wordRequests)).toEqual(new Set([
    '/words/4.txt', '/words/5.txt', '/words/6.txt',
    '/words/answers/4.txt', '/words/answers/5.txt', '/words/answers/6.txt',
    '/words/clues/4.txt', '/words/clues/5.txt', '/words/clues/6.txt',
  ]));
  expect(wordRequests.every((path) => new URL(path, 'http://127.0.0.1').hostname === '127.0.0.1')).toBe(true);
});

test('loading is announced without an unplayable board', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/words/5.txt', async (route) => { await gate; await route.continue(); });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Loading word lists');
  await expect(page.getByRole('group', { name: 'Guess board', exact: true })).not.toBeVisible();
  release();
  await expect(page.getByRole('group', { name: 'Guess board', exact: true })).toBeVisible();
});

test('a missing word list gives a visible error', async ({ page }) => {
  await page.route('**/words/5.txt', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not load word lists');
  await page.unroute('**/words/5.txt');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('group', { name: 'Guess board', exact: true })).toBeVisible();
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

test('a missing clue list gives a visible error until it loads', async ({ page }) => {
  await page.route('**/words/clues/5.txt', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not load word lists');
  await page.unroute('**/words/clues/5.txt');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('group', { name: 'Guess board', exact: true })).toBeVisible();
});

for (const body of ['camp\n', 'camp coat cart cash cave\n', 'camp coats\n']) {
  test(`a malformed clue list gives a visible error: ${JSON.stringify(body)}`, async ({ page }) => {
    await page.route('**/words/clues/4.txt', (route) => route.fulfill({ body }));
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('Could not load word lists');
  });
}
