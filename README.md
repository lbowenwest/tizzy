# Word practice

Minimal React/TypeScript app shell that loads and reports the three static word lists. The player interface has not been designed yet; see [the plan](docs/plan.md) and [codebase design](docs/codebase.md).

Requires Node.js 22.12+ (22.x), 24.x, or 26+ and npm. Install with `npm ci`, then run `npm run dev` to start Vite locally. Static ESDB guess lists are under `public/words/` and copied into production builds.

- `npm test` — Vitest shell smoke test.
- `npm run build` — TypeScript check and production build.
- `npx playwright install chromium` — install the browser used by Playwright (once per machine).
- `npm run test:e2e` — build and test the shell and word loading in both development and production preview.
- `npm run words:build` — regenerate the static lists from the pinned ESDB snapshot; `npm test` checks them.
