# Lingo-inspired word practice: codebase architecture

This document records the agreed technical design. Player-facing rules and open game decisions live in [design.md](design.md).

## Stack and deployment

Use React and TypeScript with Vite, plain CSS, Vitest for logic tests, and Playwright for browser tests. Deploy the built site and its word data as static assets. The app needs no backend, database, live dictionary API, UI kit, or general-purpose state-management library. Browser localStorage remembers settings; it does not provide cross-device sync or persistent in-progress rounds.

A static client is enough for unlimited solo practice. It also means answers are available in client-side assets/state: this is not a tamper-proof competitive game. Authoritative scoring or anti-cheat would require a different trust boundary, not merely another browser module.

## Modules and ownership

| Module | Canonical responsibility | Interface to its caller |
| --- | --- | --- |
| Word-list preparation | Extract, filter, and package ESDB data and attribution before deployment | Versioned accepted-guess and curated-answer assets for supported lengths |
| Puzzle evaluator | Candidate validity and duplicate-aware letter feedback | Answer + submitted guess + accepted words → validity or feedback; independent of React and clocks |
| Round controller | Current puzzle, attempts, success/failure transitions, rule snapshot, format progression, clock policies, expiry precedence | State + player/clock action → next state and observable outcome |
| Clock integration | Observe word and optional overall-round deadlines; deliver expiry actions | Expiry events, without deciding game outcomes |
| React presentation | Board, input, settings, presets, results, and responsive keyboard/touch interaction | Renders round state and dispatches actions; never duplicates game rules |

React's built-in state facilities are sufficient to host the controller; no second state-management system is needed. Presets provide configurations through the same path as custom settings, not separate game implementations. Take a settings snapshot on round start and persist the player's editable settings separately in localStorage. A single-word session or a 4→5→6 sequence uses the same puzzle evaluator and word controller; the sequence is progression policy, not a new guessing algorithm.

The controller owns whether an invalid candidate is rejected, consumes an unscored attempt, or ends the word, whether a word timeout requires a same-length replacement, and whether an overall timeout ends the multi-word round. Clock integration schedules observations from deadlines rather than treating browser interval ticks as authoritative elapsed time. If both deadlines have expired, the controller gives overall-round expiry precedence. The approved background policy is elapsed wall time during active play: timers continue during suspension, tab switches and dialogs; a paused result stays paused. Reconcile on visibility/focus/pageshow and before player transitions, using the latest state rather than a captured word. Ordinary failure results still expire an unfinished sequence. Solves and give-ups pause the overall clock; `isRoundClockPaused` is the shared controller, observer and presentation predicate. The result's existing end timestamp anchors its precise remaining budget, and continuation rebases its deadline on current wall time without a refill. Successful final completion stops it.

### Current source ownership

- `src/game.ts`: pure evaluation, transitions, deep rule snapshots and `advanceClock` deadline reconciliation. Word/round deadlines and end timestamps are state, not interval counters. `giveUp` reconciles deadlines before ending an active unlimited word; existing failure/continuation rules preserve sequence length and resume the paused overall budget with a rebased deadline. A null `maxGuesses` means Unlimited and suppresses attempt exhaustion without changing deadline precedence or scoring.
- `src/useRoundClock.ts`: cleaned-up browser observations and wake-up events. It schedules a display refresh and calls the controller with wall time; no second expiry policy.
- `src/presets.ts`: ordinary rule configurations, play-equivalent rule equality for preset recognition/pending notices (via `normalizeRules` in `game.ts`, which ignores sequence length, off-clock seconds and single-word round time), and human-readable rule previews.
- `src/preferences.ts`: validated local persistence; existing untimed preferences gain off-by-default clocks without losing their other choices.
- `src/Play.tsx` and `src/Settings.tsx`: rendering, non-editable guess display, touch-key dispatch, guarded physical-keyboard/paste events and editable drafts. Keyboard feedback uses the controller's strongest per-letter evidence; no text field is needed during play. Native form validation prevents saving incomplete/invalid duration fields. The per-word guess limit drives controller exhaustion and finite board rows. Unlimited rows grow from actual history inside a bounded, focusable scrolling viewport; all checked and unfinished rows remain available after expiry. Only presentation owns scrolling; settings actions stay outside the scrolling form fields.

## Word-list preparation

Use the [English Speller Database (ESDB, formerly SCOWL)](https://github.com/en-wl/wordlist). Extract and filter its words before deployment, producing a broad accepted-guess set and a curated answer set for 4, 5, and 6 letters. The game does not query an external dictionary at runtime. Pin the ESDB source revision used for the assets to make regeneration reproducible. Include the applicable [copyright and permission notice](https://github.com/en-wl/wordlist/blob/v2/Copyright) with redistributed lists.

## Verification boundaries

- **Vitest through the puzzle evaluator:** candidate validity, first-letter and length constraints, exact/misplaced/absent letters, and duplicate letters.
- **Vitest through the round controller:** accepted guesses, all three invalid-word policies, configurable attempt exhaustion, unlimited guesses at every final length, final-guess wins, legacy guess-limit defaults, per-guess resets versus per-word continuity, word versus overall expiry, simultaneous expiry, same-length replacement, length advancement, and settings snapshots.
- **Playwright in the browser:** keyboard and touch-friendly input, desktop/mobile layouts, settings and presets, untimed single-word play, and timed multi-word play.

Keep the game rules testable through the same controller interface React uses. Presentation tests should cover interaction and layout rather than reimplementing the puzzle evaluator's exhaustive cases.
