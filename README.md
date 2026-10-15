# Tizzy

Tizzy is a mobile-first React/TypeScript word game with unlimited single words and 4 → 5 → 6 Climb rounds. Play untimed Practice at 4, 5 or 6 letters, or choose Quickfire at 4 or 5 letters (10 seconds per guess) and a 90-second Sprint with unlimited guesses per word. Unlimited words include Give up to reveal the answer and retry explicitly. Settings offers presets only, so history compares like with like; clocks continue across tab switches during play. Solving a word or giving up pauses the round timer until you continue, preserving its remaining time. Preview a preset, then Apply now or Save for next round. In one clue puzzles give one checked word that only the answer fits, with no first letter; words that don't fit are rejected with the reason. History keeps finished words on this device, with per-preset totals, streaks and recent words. Choose Letterpress, Afterhours or Word Club in Settings; appearance changes without resetting play. See [the UI specification](docs/ui.md), [game rules](docs/design.md), [implementation plan](docs/plan.md) and [codebase design](docs/codebase.md).

Requires Node.js 22.12+ (22.x), 24.x, or 26+ and npm. Install with `npm ci`, then run `npm run dev` to start Vite locally. To reach the dev server through a tunnel, list its hosts in `DEV_ALLOWED_HOSTS` (comma-separated), e.g. `DEV_ALLOWED_HOSTS=.ngrok-free.app` in an untracked `.env`; `mise.toml` loads it (run `mise trust` once). Static word data lives under `public/words/` and is copied into production builds; see [docs/wordlist.md](docs/wordlist.md).

UI studies are available at `/prototypes/index.html` on the dev server: [prototype notes](docs/ui-prototypes.md). These are visual explorations, not the gameplay implementation.

- `npm test` — Vitest checks for word evaluation, round transitions, deadline clocks, presets, preferences, history, clue puzzles, loading markup and generated word data, including that every clue fits only its answer.
- `npm run build` — TypeScript check and production build.
- `npx playwright install chromium` — install the browser used by Playwright (once per machine).
- `npm run test:e2e` — build and test gameplay, settings, controlled-time expiry/background recovery, loading failures, prototypes and narrow touch layouts in both development and production preview.
- `npm run words:build` — regenerate the answer, guess and clue lists from the pinned ESDB snapshots.
- `npm run deploy` — build and upload `dist/` to the `tizzy` Cloudflare Worker as static assets, served at https://tizzy.tweakyllama.uk (`wrangler.jsonc`). Wrangler comes from `mise install` (pinned in `mise.toml`); run `wrangler login` once first.
