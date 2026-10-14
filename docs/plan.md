# Implementation plan: Lingo-inspired word practice

## Authority and sequencing

[Game design](design.md) defines the agreed rules; [codebase architecture](codebase.md) defines the agreed React/TypeScript/Vite approach. The shared mobile-first layout and selectable themes have been approved in conversation and are recorded in [ui.md](ui.md). No gameplay UI should be implemented from an invented layout. First obtain the word source, establish the application and its data-loading path, then produce and approve a UI design before building the game. This is a plan, not permission to execute it.

The phases below identify observable checkpoints, not estimates or one task per file. F1–F3, U1 and G1–G7 are implemented for the approved solo practice scope, including editable ITV-inspired timing presets. Follow-up player feedback added 1–10 guesses per word and clarified preset preview versus Apply now/Save for next round, retaining round snapshots and five-guess preset defaults outside Final sprint. Further feedback made Final sprint unlimited per word, with its overall timer as the only failure limit; custom settings can also select Unlimited. Background continuation and consumed-guess timer resets were agreed in conversation and recorded in design.md. Later feedback pauses overall round time after a solve or Give up until explicit continuation, preserving the remaining budget; ordinary failures still use wall time. Physical iOS/native-keyboard validation is still outstanding. Use the agreed static React app, framework-independent puzzle and round logic, ESDB source, and no backend/account/daily limit/ITV assets.

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

## Integrated acceptance and coordination

Once the relevant slices are complete, run Vitest, Playwright at mobile/desktop viewports, and a production Vite build. Confirm attribution is shipped, no browser request reaches a live dictionary, word rules live outside React, all three invalid policies work, same-length retries and both clock scopes distinguish word from round failure, and settings survive reload. Tests belong to each slice; this is a cross-slice check, not a separate implementation task.

**Order:** F1 and F2 can be done independently; F3 consumes both. U1 is a design/approval gate before G2 presentation. G1 can proceed from F1/F3 while U1 is reviewed. Then G2 → G3 → G4 → G5 → G6 → G7 share the controller and UI and should be integrated in dependency order. Do not use parallel implementation on overlapping React/controller surfaces. The timer-background and preset-value decisions were resolved before timed implementation; actual-device mobile testing remains a separate evidence gap.
