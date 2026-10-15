# Implementation plan: Tizzy

## Authority and sequencing

[Game design](design.md) defines the agreed rules; [codebase architecture](codebase.md) defines the agreed React/TypeScript/Vite approach. The shared mobile-first layout and selectable themes have been approved in conversation and are recorded in [ui.md](ui.md). No gameplay UI should be implemented from an invented layout. First obtain the word source, establish the application and its data-loading path, then produce and approve a UI design before building the game. This is a plan, not permission to execute it.

The phases below identify observable checkpoints, not estimates or one task per file. F1–F3, U1 and G1–G7 are implemented for the approved solo practice scope, including editable ITV-inspired timing presets. Follow-up player feedback added 1–10 guesses per word and clarified preset preview versus Apply now/Save for next round, retaining round snapshots and five-guess preset defaults outside Final sprint. Further feedback made Final sprint unlimited per word, with its overall timer as the only failure limit; custom settings can also select Unlimited. Background continuation and consumed-guess timer resets were agreed in conversation and recorded in design.md. Later feedback pauses overall round time after a solve or Give up until explicit continuation, preserving the remaining budget; ordinary failures still use wall time. Physical iOS/native-keyboard validation is still outstanding. Device-local attempt history was approved in conversation on 2026-10-14, recorded in design.md, ui.md and codebase.md, and implemented as H1–H2 below. In one clue puzzles were approved in conversation on 2026-10-15, recorded in design.md, ui.md, codebase.md and wordlist.md, and planned as C1–C3 below; C1–C3 are implemented. Presets-only settings were approved in conversation on 2026-10-15, recorded in design.md, ui.md and codebase.md, and implemented as P1 below. Stats by mode (S1) followed the same day. Before public hosting, the owner named the product Tizzy and renamed the presets that referred to the show (2026-10-15): 4 → 5 → 6 · untimed became Climb, ITV-style became Quickfire (keys `quickfire-four`, `quickfire-five`) and Final sprint became Sprint (key `sprint`). Nothing had been published, so keys changed with the names and no alias was kept; history recorded locally under the old keys is dropped like a retired preset. Earlier phase text below keeps the names used at the time. Use the agreed static React app, framework-independent puzzle and round logic, ESDB source, and no backend/account/daily limit/ITV assets.

## Foundations

### F1 — Download and pin the ESDB word source

- **Authority/outcome:** `design.md` Word selection; `codebase.md` Word-list preparation. Obtain the real ESDB source data and its licence material, not a made-up or untraceable dictionary.
- **Shape:** Download a specific upstream revision/release; record its URL/revision, checksum or other integrity evidence, licence notice, and a repeatable way to retrieve it. Decide explicitly whether the source snapshot is committed or fetched by the preparation step, without embedding an unpinned live download in the runtime app.
- **Proof/handoff:** The downloaded data is present and extractable; the recorded revision can be fetched again; the applicable notice is available. A bounded command verifies the source can yield 4-, 5-, and 6-letter English words. This supplies reproducible input to G1, not yet curated game answers. Starting anchors: [ESDB](https://github.com/en-wl/wordlist), [copyright](https://github.com/en-wl/wordlist/blob/v2/Copyright), `docs/codebase.md`. No predecessor.

### F2 — Set up the app framework and dependencies

- **Authority/outcome:** `codebase.md` Stack and deployment. Establish a runnable, locked React/TypeScript/Vite application with plain CSS, Vitest, and Playwright.
- **Shape:** Add project configuration, package scripts and lockfile; use a minimal app entry, not a speculative game UI. Keep tests runnable and production assets static-hostable. Do not add a backend, UI kit, or state library.
- **Proof/handoff:** Install from the lockfile, run a basic Vitest check, build the site, and start it locally; Playwright can open the minimal page. This provides the app/test harness for F3 and gameplay tasks. Starting anchor: `docs/codebase.md`; no source files exist yet. Independent of F1's content, but F3 needs both.

### F3 — Prove the app loads real word data

- **Authority/outcome:** `codebase.md` static asset/data flow. Establish that a browser can load a deployed-style app and real ESDB-derived data before any game logic or UI is designed.
- **Shape:** Extract a small, reproducible sample from F1 for the supported lengths, serve it as a static asset through F2's build, and display a minimal loading/success/error state. This is a diagnostic shell, not a proposed game screen; do not make the browser fetch ESDB from upstream.
- **Proof/handoff:** In a locally served production build, Playwright sees a loaded app and confirms that all three word lengths are present; a missing/malformed asset produces a visible error rather than a blank page. Inspect network requests to confirm no live dictionary dependency. This proves the loading contract that G1 will replace with curated assets. Depends on F1 and F2.

## UI design gate — before gameplay presentation

### U1 — Specify and approve the player interface

- **Authority/outcome:** `design.md` play/settings/sequence behaviour and `codebase.md` React presentation. Produce a reviewable UI design, not application code.
- **Shape:** Create a separate UI specification (for example `docs/ui.md`) with desktop and mobile layouts or wireframes, original visual direction, board/input behaviour, result and next-word flow, single-word and 4→5→6 progress, settings and preset controls, timer displays, loading/error states, keyboard/touch interaction, and feedback not conveyed solely by colour. Reconcile each screen/state with `design.md`; identify any product decisions the design cannot resolve rather than silently inventing rules or ITV styling.
- **Proof/handoff:** The owner can review the actual screen layouts and flows, and approve or amend them. The accepted specification becomes the presentation contract for G2 onward; until then, downstream UI work is not executable. May follow F3 so loading/error behaviour is grounded in a working app. No game UI is approved merely by this plan.

## Gameplay — after the UI gate

### G1 — Build playable guess and answer sets

- **Authority/outcome:** `design.md` Word selection. Convert F1's source into broad accepted guesses and smaller, familiar answer sets for 4, 5, and 6 letters.
- **Shape:** Add deterministic offline filtering/curation and packaged assets using F3's proven loading contract. Keep answer selection narrower than guess validity, and carry ESDB attribution in the shipped site. No runtime dictionary service.
- **Proof/handoff:** Every answer is unique, of the expected length, and an accepted guess; all lengths have usable answers; representative British spellings/variants are accepted; visibly unsuitable answers are excluded. Repeated generation from the pinned source matches. Data checks and a production-build load check supply lists to G2/G4. Depends on F1/F3, not on U1's visual choices.

### G2 — Play repeated untimed single words

- **Authority/outcome:** `design.md` Play and Single-word format. A player can guess a word with five attempts and a fixed supplied first letter, see duplicate-aware feedback and a result, then immediately play another word without a date/count gate.
- **Shape:** Put validation/feedback in a pure TypeScript evaluator; put attempt/result/next-word transitions and a round-start rule snapshot in a controller. Implement only the approved U1 board, input and result flow in React, using G1 data. Unknown words may initially be rejected; G3 adds the other agreed policy. Do not create a second React-owned rules path.
- **Proof/handoff:** Vitest checks duplicates, invalid shape, win, five-guess loss, fresh next word and no daily limit. Playwright covers consecutive rounds by keyboard and touch at desktop/mobile widths, with readable non-colour-only feedback. Production build works. Depends on G1 and approved U1; supplies evaluator/controller/UI contract to G3–G6.

### G3 — Configurable invalid-word outcome

- **Authority/outcome:** `design.md` invalid-word policy. A dictionary-unknown submitted candidate can be rejected without consuming a guess, consume one unscored guess, or fail the current word.
- **Shape:** Add a policy field to G2's controller and its U1-approved setting control; keep candidate validity in the evaluator. Incomplete or wrong-length input remains unsubmitted. Consumed unknown guesses are marked unscored on the board and do not update letter knowledge; all policies share the controller and result/next-word flow.
- **Proof/handoff:** Vitest and Playwright demonstrate the same candidate under all three policies, with no attempt cost on rejection, an unscored attempt on consumption (including fifth-attempt loss), and answer reveal on failure. Depends on G2; provides policy/failure transition to G4–G6.

### G4 — 4→5→6 sequence and same-length retries

- **Authority/outcome:** `design.md` multi-word format. A solve advances from 4 to 5 to 6; a failure supplies another word of the same length.
- **Shape:** Add progression to the existing controller and U1-approved format/progress UI. Reuse G2 evaluator and G3 failure transition; no separate puzzle engine.
- **Proof/handoff:** Vitest covers failure at each length, advance only on solve, and completion at six. Playwright covers a full sequence and a failed same-length retry; single-word play still works. Depends on G1–G3 and U1; supplies sequence lifecycle to G5/G6.

### G5 — Optional word clock

- **Authority/outcome:** `design.md` word-clock choices. Off is the default; players can choose per-word or per-guess timing and duration. Expiry fails only the word.
- **Shape:** Represent word deadlines in the controller; a clock integration observes them and dispatches expiry actions. Per-word time continues across guesses; per-guess time resets on a spent attempt, including consumed unknown guesses; rejection never resets time. Expired/stale events cannot fail a later word. Use U1-approved timer controls/feedback.
- **Proof/handoff:** Controlled-time Vitest tests cover off/word/guess modes, invalid rejection, replacement word, stale expiry and deadline continuity; Playwright covers visible-tab timing. Depends on G2–G4 and U1. Backgrounding continues clocks, as agreed in `design.md`; controlled browser tests cover catch-up without replaying every tick and late-action guards. Physical-device mobile suspension still needs validation.

### G6 — Optional overall sequence clock

- **Authority/outcome:** `design.md` overall 4→5→6 clock. Players can turn it off or select a duration independently of the word clock.
- **Shape:** Add a sequence deadline to G5's clock integration/controller. Overall expiry ends the sequence, not merely the current word; it takes precedence over simultaneous word expiry. It does not reset on guesses or same-length replacements.
- **Proof/handoff:** Controlled-time Vitest covers both clocks independently and together, off-by-default behaviour, precedence and stale events. Playwright covers visible-tab overall expiry and untimed sequence. Depends on G4/G5 and U1; supplies all clock rule fields to G7.

### G7 — Persist editable settings and supply presets

- **Authority/outcome:** `design.md` settings/presets and `codebase.md` localStorage. Players can load presets, edit the same settings, and retain valid custom choices on the same device.
- **Shape:** One validated configuration shape feeds both presets and custom controls; edits mark a preset custom. Persist editable settings with safe recovery from missing/corrupt localStorage. Keep the active round snapshot unchanged until the next round. Follow U1-approved settings UI; no preset-specific puzzle/controller implementation.
- **Proof/handoff:** Vitest checks snapshot, preset/custom transitions, malformed storage and safe defaults. Playwright tests selecting/editing/reloading settings without altering an active round. Depends on G3–G6 and U1. The approved preset table and timing evidence are in `design.md`; timed configurations and untimed practice share the same validated rule path.

## Attempt history

Shared shape: the controller only stamps word identity and timing; one history module owns records, retention, grouping and statistics; Play is the single recorder; a History dialog only reads and clears. Dependency direction is `history → game, presets`, never the reverse.

```text
Play (round changes) ──status ≠ playing──▶ recordResult(round)
                                              │ toRecord → addRecord (upsert by id, newest 1,000) → localStorage
History dialog ──open──▶ loadHistory() ──▶ summarizeHistory(records) ──▶ per-group totals + recent words
               ──Confirm clear──▶ clearHistory()
```

### H1 — Record finished words and summarise them

- **Authority/outcome:** `design.md` Attempt history; `codebase.md` history ownership. A finished round yields exactly one stored record per word, and stored records yield the per-group statistics the design lists.
- **Shape:**
  - `src/game.ts`: add `startedAt` to every word (from `newWord`'s `now`) and `roundStartedAt` to every round (set by `startRound`, carried by sequence `nextWord`; a single word's equals its `startedAt`). No transition changes.
  - New `src/history.ts`, following the `preferences.ts` split of pure functions plus thin storage wrappers. No generic storage abstraction or injected storage seam.
    - `HistoryRecord`: `id` (`${startedAt}:${answer}`), `roundId` (`roundStartedAt`), `answer`, `length`, `format`, `group` (`getPresetKey(round.rules)`: a preset key or `custom`), `result` (`solved` or `failed`), `reason`, `guesses`, `unknown` (unscored guesses), `durationMs` (`endedAt − startedAt`), `endedAt`.
    - Pure functions: `toRecord(round)` returns `null` while playing; `addRecord(records, record)` replaces an existing id, otherwise appends, then orders by `endedAt` and keeps the newest 1,000; `parseHistory(raw)` reads `{ version: 1, records }`, drops individually invalid records and returns `[]` for missing, corrupt or other-version data; `summarizeHistory(records)` returns, per group, played, solved, solved %, guess distribution by exact count (for solved words), current and best streak in `endedAt` order, average solve `durationMs`, and for sequences the completed rounds (a `roundId` with a solved 6-letter record) and expired rounds (a `roundId` with a `round-time` record).
    - Wrappers on key `word-practice-history-v1`: `loadHistory()`, `recordResult(round)` (re-read, add, write) and `clearHistory()`, each swallowing storage errors like `savePreferences`.
- **Acceptance:**
  - **Normal:** solve, attempts loss, unknown-word failure, word timeout, round timeout and Give up each produce one record with the right result, reason, guesses, unknown count, duration and group. Practice, ITV and Final presets get their own keys; edited rules get `custom`.
  - **Edge:** recording the same finished round twice changes nothing; a failed sequence word that later round-expires is replaced with `round-time`; a playing round records nothing; the 1,001st record evicts the oldest; a failure resets the current streak while the best streak survives; sequence completed and expired counts are per round, not per word; an empty history summarises to no groups.
  - **Failure:** corrupt JSON, a wrong version or malformed records never throw. Blocked storage makes `recordResult` a no-op and `loadHistory` empty.
- **Evidence anchors:** `src/game.ts` (`newWord`, `startRound`, `nextWord`, `Round`); `src/preferences.ts` (parse/load/save pattern and failure handling); `src/presets.ts` `getPresetKey`; `src/clocks.test.ts` (fixed-time controller fixtures to reuse).
- **Dependencies/output:** none. Produces `recordResult`, `loadHistory`, `clearHistory`, `summarizeHistory` and `HistoryRecord` for H2.
- **Validation:** `npm test` with a new `src/history.test.ts` that builds rounds through `startRound`/`submitGuess`/`advanceClock`/`giveUp`/`nextWord` with fixed `now` and `random`, then exercises the pure functions. Existing controller tests extend only to assert the new stamps.

### H2 — Record during play and show the History dialog

- **Authority/outcome:** `design.md` Attempt history; `ui.md` History. Real play records finished words, and the player can review and clear them.
- **Shape:**
  - `src/Play.tsx`: one effect, `if (round.status !== 'playing') recordResult(round)` keyed on `round`. Idempotent upserts absorb StrictMode re-runs and the failed-then-expired change. No other recording path.
  - `src/App.tsx`: a History header button and a `'history'` dialog state using the existing `Dialog`.
  - New `src/HistoryDialog.tsx` (not `History.tsx`, which collides with `history.ts` on case-insensitive filesystems): loads once on open, defaults the group selector to `getPresetKey(preferences.rules)` (falling back to the newest recorded group), renders the summary and the 50 newest records, and implements the two-step clear locally.
  - `src/styles.css`: header and dialog layout. Reuse the existing field, list and dialog styles across the three themes.
- **Acceptance:**
  - Solving and failing words updates played, solved %, streaks, guess distribution and the newest-first recent list.
  - Switching groups separates Practice from Final.
  - Apply now mid-word and reload mid-word add nothing.
  - A failed sequence word whose round then expires appears once, as round time.
  - History survives reload.
  - Clear history then Cancel keeps it; Confirm clear empties it.
  - Corrupt history storage shows **No finished words yet.** and play still works.
  - Keyboard users can open, use and Escape-dismiss the dialog.
  - At 320px and 390px the header and dialog have no horizontal overflow.
  - The result screen is unchanged.
- **Evidence anchors:** `src/App.tsx` header and dialog state; `src/Dialog.tsx`; `src/Settings.tsx` (labelled select and action layout); `tests/browser/timers.spec.ts` `fixture` (routed word lists, controlled clock); `tests/browser/shell.spec.ts` (narrow-layout checks).
- **Dependencies/output:** consumes H1's interface; completes the feature.
- **Validation:** `npm run test:e2e` with a new `tests/browser/history.spec.ts` in both projects. Inspect desktop, 320px and 390px screenshots in all three themes.

## In one clue puzzles

Shared shape: one evaluator (`evaluateGuess`) chooses clues at build time and scores play; the build ships words only; the controller owns clue rounds, the missing first-letter check and rejections; presentation renders. The build script newly imports `game`; the other directions are unchanged (`game → wordLists` for types only, `history → game, presets`).

```text
words:build ──evaluateGuess──▶ public/words/clues/<n>.txt      "answer clue1 [clue2 [clue3]]"
loadWordData ──▶ WordData.clues[length]: { answer, clues }[]
newWord (rules.clue, single) ──▶ Round.clue = { word, feedback: evaluateGuess(answer, word) }
submitGuess ──▶ answer: won · unknown: invalid-word policy · other known word: rejected Guess (spends a try)
Play ──▶ clue row above the board · rejected rows + reason · keyboardFeedback([clue, ...guesses])
```

### C1 — Generate, verify and load clue data (implemented)

- **Authority/outcome:** `design.md` In one clue puzzles; `wordlist.md` Clue puzzles. `npm run words:build` deterministically writes clue assets that follow the agreed rules, the generated-data tests prove strict uniqueness for every stored clue, and the app loads them.
- **Shape:**
  - `scripts/build-wordlists.ts`, after curating answers: for each length and each curated answer as a candidate clue word, evaluate it against every accepted guess with `evaluateGuess` (imported from `src/game.ts`) and bucket guesses by feedback. A bucket holding exactly one word, which is a curated answer other than the clue word, with at most `Math.floor(length / 2)` right-place letters, yields a qualifying (answer, clue). Per answer, order qualifying clues by right-place count, then non-absent count, then alphabetically, and keep the first, middle and last without repeats. Write sorted `public/words/clues/<n>.txt` and log per-length counts. If build time is excessive (the pre-plan measurement took 0.4/1.8/4.8 s with a packed encoder), make `evaluateGuess` cheaper in place; never copy it.
  - `src/wordLists.ts`: `WordData` gains `clues: Record<4 | 5 | 6, { answer: string; clues: string[] }[]>`, fetched with the other lists. Each line must be one answer plus one to three words, all lowercase and of that length; anything else fails loading through the existing error path. Unit-test `WordData` fixtures gain `clues`.
  - `tests/wordlists.test.ts`: for every line, the answer is a curated answer; its clues are distinct curated answers other than the answer; there are at most three; each meets the right-place ceiling; lines are sorted by answer. Strict uniqueness is checked by grouping stored pairs by clue word, making one pass over the accepted list per distinct clue word. Pin per-length line counts like the other lists.
  - `docs/wordlist.md`: replace the measured percentages with the generated counts.
  - As implemented: `evaluateGuess` now counts unmatched letters in a reused 26-letter buffer instead of a `Map` (about 5× faster, same results), and the build and tests key feedback numerically. `words:build` and `npm test` each take about 5 s; the counts match the pre-plan measurement exactly (1,363 / 2,833 / 4,643).
- **Acceptance:**
  - **Normal:** clue files exist for 4, 5 and 6 letters, and the app loads them in development and production preview.
  - **Edge:** answers without a qualifying clue are absent; an answer with one or two qualifying clues lists that many; running `words:build` twice changes nothing; the guess and answer assets are unchanged.
  - **Failure:** a missing or malformed clue file shows the existing load error and **Try again**; checksum failures behave as before.
- **Evidence anchors:** `scripts/build-wordlists.ts` (curation, write loop); `tests/wordlists.test.ts` (recomputed expectations, pinned counts); `src/wordLists.ts` `loadList`; `tests/browser/shell.spec.ts` (missing/malformed list checks); `src/App.test.tsx`.
- **Dependencies/output:** none. Produces `WordData.clues` for C2.
- **Validation:** `npm run words:build` twice with an empty `git diff` the second time; `npm test`; `npm run build`; `npx playwright test tests/browser/shell.spec.ts`.

### C2 — Play clue rounds in the controller (implemented)

- **Authority/outcome:** `design.md` In one clue puzzles and preset table. With `clue` on, a single word starts from a stored clue, accepts any first letter, wins on the answer, and rejects any other known word with its reason at the cost of a try. The rule persists and the In one preset exists.
- **Shape:**
  - `src/game.ts`:
    - `Rules.clue: boolean`, default `false`; `normalizeRules` resets it for sequences.
    - `Round.clue: Guess | null`; `Guess` gains an optional `rejection` reason, present only on a rejected known word, whose `feedback` is `null`.
    - `newWord`: for a single-word clue round, pick an entry from `data.clues[length]` (avoiding the previous answer, as for answers) and one of its clue words at random, with feedback from `evaluateGuess(answer, clue)`. Use it only after one pass over `data.guesses[length]` (the list `submitGuess` validates against) confirms the answer is the only word that fits; otherwise try the entry's other clues, then other entries. If nothing qualifies it throws, like an empty answer list. This runtime check enforces the one-correct-guess guarantee whatever data is loaded.
    - `explainContradiction(clue, word)`: returns `null` exactly when `evaluateGuess(word, clue.word)` equals the clue's feedback. Otherwise it returns the first broken constraint, checking right-place letters, then elsewhere letters (must appear, not in that position), then absent letters (not in the word, or no more copies than the clue shows, and not in that position). Use the wording in `design.md`.
    - `evaluateCandidate` gains a flag to skip the first-letter check; `submitGuess` passes it for clue rounds.
    - `submitGuess`: a valid word other than the answer in a clue round becomes a rejected `Guess`. Its message names the word and the reason. It spends an attempt through the existing exhaustion and per-guess-reset logic. Because `newWord` guarantees that only the answer fits, `explainContradiction` always finds a reason here; a `null` would mean that guarantee was bypassed, so it is an invariant error, not a fallback message.
  - `src/presets.ts`: `sameRules` compares `clue`; `describeRules` adds the clue and no-first-letter wording. Add `in-one` (`In one · 5 letters`: default rules with `clue: true`, `maxGuesses: 1`), listed last.
  - `src/preferences.ts`: a missing `clue` upgrades to `false`; a non-boolean value falls back to the defaults.
  - `src/history.ts` `toRecord`: `unknown` counts only `feedback === null` guesses without a `rejection`. Record shape and storage version are unchanged.
  - `keyboardFeedback` is unchanged: rejected guesses have `null` feedback, so they are already skipped; callers include the clue.
- **Acceptance:**
  - **Normal:** applying In one starts a 5-letter clue round with one try and no word clock. The clue's feedback matches `evaluateGuess`. A guess starting with any letter is evaluated. The answer wins. A known wrong word is rejected with the expected reason, uses a try, has no feedback and leaves keyboard knowledge unchanged. Under In one a rejection loses with reason `attempts`; with custom tries, the final rejection does.
  - **Edge:**
    - Reasons cover right place, elsewhere, absent, excess duplicate and wrong-position cases.
    - Unknown words follow all three invalid-word policies as before.
    - A rejection resets a per-guess clock.
    - Unlimited tries keep Give up.
    - A sequence with `clue: true` plays as an ordinary sequence with a first letter and is recognised as its preset.
    - `nextWord` avoids repeating the previous answer.
    - History counts rejected tries as guesses, not unknown words, under the `in-one` group.
  - **Property:** across many real (clue, word) pairs, `explainContradiction` returns `null` exactly when the feedback matches the clue's.
  - **Guarantee:** given a clue file whose first clue another loaded guess also fits, `newWord` never uses that clue, choosing a valid one instead or throwing when none exists. For every clue `newWord` returns, no accepted word other than the answer has a `null` contradiction.
  - **Failure:** older stored preferences load with `clue: false`; a malformed `clue` restores the defaults.
- **Evidence anchors:** `src/game.ts` (`Rules`, `Guess`, `Round`, `newWord`, `evaluateCandidate`, `submitGuess`, `normalizeRules`); `src/presets.ts`; `src/preferences.ts` and its tests; `src/history.ts` `toRecord`; `src/game.test.ts`, `src/clocks.test.ts` and `src/history.test.ts` fixtures.
- **Dependencies/output:** consumes C1's `WordData.clues`. Produces `Rules.clue`, `Round.clue`, `Guess.rejection`, `explainContradiction` and the `in-one` preset for C3.
- **Validation:** `npm test` and `tsc --noEmit`.
- **As implemented:** the clue is typed `ScoredGuess` (a `Guess` whose feedback is never null). `src/clues.test.ts` covers the controller cases above with a hand-made fixture, and checks the property by comparing 60 sampled clues per length with every accepted word. A rejection's message is `Rejected: WORD doesn't fit. <reason>`.

### C3 — Present clue puzzles (implemented)

- **Authority/outcome:** `ui.md` Clue puzzles and Settings. The player can turn on Start with a clue or apply In one, read the clue row, enter any word without a hint tile, see rejected tries with their reasons, and see keyboard evidence from the clue.
- **Shape:**
  - `src/Settings.tsx`: a **Start with a clue** checkbox beside the format controls, enabled only for single words. Changing it marks the draft Custom. Footnote copy states that clue puzzles supply no first letter.
  - `src/Play.tsx`, when `round.clue` is set:
    - Hide the first-letter behaviour: no supplied tile, no "Starts with" label, a neutral feedback prompt, and **One clue given** in the meta line. The eyebrow reads `SINGLE WORD · CLUE` and the counter **Try n of N**.
    - Render the clue as a labelled row above the board element, so it stays visible when an Unlimited board scrolls.
    - Rejected rows use unscored tiles with a ✕ mark and an accessible name that includes the reason; the reason also goes through the feedback status.
    - Keyboard knowledge is `keyboardFeedback([round.clue, ...round.guesses])`.
  - `src/App.tsx`: one sentence of help.
  - `src/styles.css`: `.clue-row` and rejected-tile styles in all three themes.
- **Acceptance:** Playwright, with a routed fixture whose clue is the only fit in the routed guess list:
  - Applying In one shows the clue row with marks, an active row with no supplied tile, and keyboard keys coloured from the clue.
  - A known wrong word starting with a different letter is rejected with the reason announced; the counter advances and the keyboard is unchanged.
  - An unknown word is rejected free.
  - In one's board has one row under the clue. The answer solves and History lists it under In one with the right guess count; a rejection loses and the result shows its reason and the answer. With custom tries, rejections advance the counter until the last one loses.
  - The checkbox is disabled for sequences, which still supply the first letter.
  - Touch play works; at 320px and 390px in all three themes there is no horizontal overflow (screenshots inspected).
- **Evidence anchors:** `src/Play.tsx` (`Tile`, row rendering, `first`, `knowledge`); `src/Settings.tsx` round-clock toggle; `src/App.tsx` help; `tests/browser/history.spec.ts` fixture; `tests/browser/keyboard.spec.ts` and `settings.spec.ts`.
- **Dependencies/output:** consumes C2. Completes the feature; then update the `ui.md` implementation boundary, the README and this plan's status.
- **Validation:** `npm run test:e2e` in both projects, with screenshot inspection.
- **As implemented:** the clue row is its own non-scrolling board above the guess board, so it shares the tile sizing. `tests/browser/clues.spec.ts` covers the acceptance above. The active row's prompt reads **Only one word fits the clue.** and the entry label **Must fit the clue**. Turning the format to a sequence unchecks and disables the box; the saved choice returns if single words are chosen again. Playtesting feedback then cut In one from three tries to one, so its board is one row under the clue; a word lost on a rejected try keeps the reason in the result.

## Presets only

Approved in conversation on 2026-10-15: remove custom settings so every finished word belongs to a preset and history compares like with like. Delete history recorded under Custom. Add untimed Practice at 4 and 6 letters beside 5. Keep the controller general (all clock scopes, limits and policies) so future presets need no game code. Non-goals: pruning unused controller capabilities, new timed presets.

### P1 — Choose presets only (implemented)

- **Authority/outcome:** `design.md` Play and configuration, presets table and history grouping; `ui.md` Settings and History. Settings offers a preset picker with a preview, Appearance and Apply now / Save for next round; no rule is editable. Eight presets: Practice at 4, 5 (key `practice`, so its history carries over) and 6 letters, 4 → 5 → 6, ITV-style 4 and 5, Final sprint and In one.
- **Shape:**
  - `src/presets.ts` owns the list, `presetRules(key)`, `presetLabel`, `isPresetKey` and `getPresetKey`, which returns null for rules no preset uses.
  - `src/preferences.ts` stores `{ theme, preset }`. Rules saved by earlier versions map to the preset they match (filling later fields with their old defaults), otherwise Practice · 5 letters.
  - `src/history.ts`: `toRecord` skips rounds matching no preset; parsing drops records whose group is not a current preset, so Custom and retired-preset words leave storage at the next save.
  - `src/Settings.tsx`, `src/App.tsx` and `src/HistoryDialog.tsx` pass preset keys; `Play` still receives the preset's rules. Help names the presets.
- **Acceptance:** every preset round-trips through storage; legacy matching and fallback; non-preset rounds unrecorded and Custom records dropped; the Settings dialog has no rule fields; browser tests reach every behaviour they cover through presets, with engine-only behaviours (per-word clocks, combined clocks, other limits) covered by unit tests.
- **Validation:** `npm test`, `npm run test:e2e`.

## Stats by mode

Owner feedback on 2026-10-15: History did not read well; rename it Stats and break results down by game mode with a guess distribution. The owner chose mode tabs (Wordle-style detail for one mode at a time) and recent words filtered to the selected mode. Recorded in design.md (Attempt history) and ui.md (Stats). S1 is implemented.

### S1 — Stats dialog by mode and variant

- **Authority/outcome:** the Stats decision above. The header button and dialog are named Stats; mode buttons then variant buttons select a preset; four headline numbers plus average solve (and sequence round counts); a full guess distribution with a not-solved row and the latest result highlighted (one-try presets such as In one: median and fastest, a solve-time trend line and a fitted bell curve instead, and solve times in recent words); the variant's last ten words; Clear stats.
- **Shape:** `src/presets.ts` gives each preset a `mode` and `variant` and builds `label` from them, and exports `modes` in preset order. `summarizeHistory` in `src/history.ts` owns the distribution: rows from 1 to the preset's limit (Unlimited: max(5, longest solve)), then Not solved, plus the latest word's row; when the limit is one it returns recent times, solves, fastest, median and a log-normal fit instead. `src/SolveTimes.tsx` draws the trend and bell curve as SVG. `src/StatsDialog.tsx` replaces `HistoryDialog.tsx`; storage and record format are unchanged.
- **Acceptance:** rows include zeros and the ✗ row; the latest result's row is marked; choosing a mode follows the saved-preset → last-played → first rule; unplayed variants say Not played yet; the dialog fits 320px in every theme.
- **Validation:** `npm test`, `npm run test:e2e`.

## Integrated acceptance and coordination

Once the relevant slices are complete, run Vitest, Playwright at mobile/desktop viewports, and a production Vite build. Confirm attribution is shipped, no browser request reaches a live dictionary, word rules live outside React, all three invalid policies work, same-length retries and both clock scopes distinguish word from round failure, and settings survive reload. After H1–H2, finished words appear once in their preset group and history survives reload without affecting play. After C1–C3, every shipped clue has exactly one possible correct guess (enforced at build, test and play), In one plays end to end without a first letter, and ordinary modes and their tests are unchanged. Tests belong to each slice; this is a cross-slice check, not a separate implementation task.

**Order:** F1 and F2 can be done independently; F3 consumes both. U1 is a design/approval gate before G2 presentation. G1 can proceed from F1/F3 while U1 is reviewed. Then G2 → G3 → G4 → G5 → G6 → G7 share the controller and UI and should be integrated in dependency order. Do not use parallel implementation on overlapping React/controller surfaces. The timer-background and preset-value decisions were resolved before timed implementation; actual-device mobile testing remains a separate evidence gap. H1 → H2 run directly in order by one implementer: H2 touches the same App/Play surfaces, so parallel work would only add merge risk. C1 → C2 → C3 likewise run directly in order: C2 consumes C1's data contract and C3 consumes C2's round shape, and all three meet in `game.ts`/`Play.tsx`, so there is no isolated boundary worth orchestrating.
