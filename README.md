# Word practice

Mobile-first React/TypeScript word practice with unlimited untimed single words and 4 → 5 → 6 rounds. Choose Letterpress, Afterhours or Word Club in Settings; appearance changes without resetting play. See [the UI specification](docs/ui.md), [game rules](docs/design.md), [implementation plan](docs/plan.md) and [codebase design](docs/codebase.md).

Requires Node.js 22.12+ (22.x), 24.x, or 26+ and npm. Install with `npm ci`, then run `npm run dev` to start Vite locally. Static word data lives under `public/words/` and is copied into production builds; see [docs/wordlist.md](docs/wordlist.md).

UI studies are available at `/prototypes/index.html` on the dev server: [prototype notes](docs/ui-prototypes.md). These are visual explorations, not the gameplay implementation.

- `npm test` — Vitest checks for word evaluation, round transitions, preferences, loading markup and generated word data.
- `npm run build` — TypeScript check and production build.
- `npx playwright install chromium` — install the browser used by Playwright (once per machine).
- `npm run test:e2e` — build and test gameplay, settings, loading failures, prototypes and narrow touch layouts in both development and production preview.
- `npm run words:build` — regenerate the answer and guess lists from the pinned ESDB snapshots.
