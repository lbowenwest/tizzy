# Word practice

Minimal React/TypeScript app shell that loads and reports the static answer and guess lists. The player interface has not been designed yet; see [the plan](docs/plan.md) and [codebase design](docs/codebase.md).

Requires Node.js 22.12+ (22.x), 24.x, or 26+ and npm. Install with `npm ci`, then run `npm run dev` to start Vite locally. Static word data lives under `public/words/` and is copied into production builds; see [docs/wordlist.md](docs/wordlist.md).

- `npm test` — Vitest checks for the app shell and the generated word data.
- `npm run build` — TypeScript check and production build.
- `npx playwright install chromium` — install the browser used by Playwright (once per machine).
- `npm run test:e2e` — build and test the shell and word loading in both development and production preview.
- `npm run words:build` — regenerate the answer and guess lists from the pinned ESDB snapshots.
