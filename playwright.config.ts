import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: { browserName: 'chromium' },
  projects: [
    { name: 'development', use: { baseURL: 'http://127.0.0.1:5179' } },
    { name: 'production preview', use: { baseURL: 'http://127.0.0.1:4179' } },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5179 --strictPort',
      url: 'http://127.0.0.1:5179',
      reuseExistingServer: false,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4179 --strictPort',
      url: 'http://127.0.0.1:4179',
      reuseExistingServer: false,
    },
  ],
});
