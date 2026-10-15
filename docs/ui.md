# Player interface

## Accepted direction

Records the shared layout and mobile-first direction approved in conversation before the frontend implementation. Game rules remain in [design.md](design.md); technical ownership remains in [codebase.md](codebase.md). The [clickable studies](ui-prototypes.md) show the original direction.

One compact playing screen; one placeholder **Word practice** identity. No promotional hero, side copy, ITV artwork or separate layouts for different themes.

```text
Word practice         How to play   History   Settings
┌───────────────────────────────────────────────────┐
│ SINGLE WORD / 4 → 5 → 6                   Untimed │
│ Find the five.                                    │
│ [4 letters] [5 letters · NOW] [6 letters]           │ sequence only
│ Guess 1 of 5                 First letter given   │
│                 [C✓][ ][ ][ ][ ]                  │
│                 [ ][ ][ ][ ][ ]                  │
│                 [ ][ ][ ][ ][ ]                  │
│                 [ ][ ][ ][ ][ ]                  │
│                 [ ][ ][ ][ ][ ]                  │
│                Feedback / result                  │
│          ✓ Right place · ↔ Elsewhere · × Absent    │
│ Your guess                         Starts with C  │
│ [           Tap letters below                  ] │
│                 Q W E R T Y U I O P               │
│                  A S D F G H J K L                │
│              ENTER Z X C V B N M ⌫                │
└───────────────────────────────────────────────────┘
Word-list credits
```

The sketch shows the default five-guess board. Finite guess limits control the actual row count (1–10); larger boards may require vertical scrolling. Unlimited play starts with five rows, adds rows as needed and keeps a scrollable board viewport about five rows high so the keyboard does not move farther down with every guess. The newest row is brought into view after submission; earlier guesses remain scrollable, including after timeout. The board can receive keyboard focus for scrolling without opening a native keyboard. The same order is used on phones, without a desktop sidebar. Board tiles have a consistent target size across word lengths, shrinking to fit narrow screens and shorter viewports. A long/landscape screen may scroll; there must be no horizontal overflow.

## Appearance

- **Letterpress:** warm paper, forest-green ink, Fraunces headings/tiles, restrained edges.
- **Afterhours:** dark surfaces, coral actions, Barlow Condensed headings, monospaced tiles.
- **Word Club:** yellow backdrop, navy ink, rounded tactile surfaces and offset shadows.

Themes change colour, typography, borders and shadows only. Selection is immediate and persists locally. It never resets the current word, submitted guesses, typed entry, sequence progress or rules. Production fonts are self-hosted with their SIL Open Font License notices in `public/fonts/`.

## Input trial

The supplied first letter is a green hint tile in the active row, labelled as supplied and marked ✓. There is **no separate prefix beside the input**. Following playtesting feedback, both physical typing and on-screen keys enter the **whole word**, including its first letter. Entry starts empty and every typed letter is editable/deletable. If a different first letter is typed, the board shows the actual entry without a green first tile, and checking gives a start-letter reminder without consuming an attempt. Clearing entry restores the hint. Guesses must still start with the supplied letter; that game rule is unchanged.

The labelled guess display is focusable but not editable: no native text field or contenteditable surface is used during play, so touching it cannot summon a mobile keyboard. A Wordle-style keyboard uses filled, tall keys, a half-key-indented middle row, and wider ENTER/Delete keys at opposite ends of the bottom row. Physical letters, Backspace, Enter and whole-word paste remain supported, without intercepting browser shortcuts, IME composition, settings fields or open dialogs. Enter on an ordinary focused button retains native activation. Alphabetic input is normalised to uppercase. An incomplete guess receives guidance and costs no attempt. The current guess appears on the board before checking. Keys use the strongest checked feedback (correct over present over absent), with ✓/↔/× marks and accessible descriptions. Confirmed-absent keys turn dark gray, while correct and present keys use the board's theme colours; all keys remain tappable. A letter with any correct or misplaced match cannot be downgraded by excess gray duplicate tiles. Knowledge accumulates only within the current word, survives appearance changes, and clears for each new word, retry or sequence length.

Tiles have text/symbol feedback as well as colour and accessible letter/state names. The feedback legend remains visible. Outcome messages are announced through a live status region; do not rely on hover, colour or animation alone.

## Results and progression

Unlimited-guess words show a touch-sized **Give up** button below the on-screen keyboard, also usable by ordinary keyboard button activation. It reveals the answer without automatically changing words. A sequence offers another word of the same length, and its overall clock pauses until explicit continuation, then resumes its remaining time without refill; the action is absent from finite-guess and ended words.

A solve or failure keeps the checked board, reveals the answer, and replaces entry/keyboard with a result and an explicit next action. Word or round expiry, or giving up, also preserves the current full or partial entry on its existing row until continuation. Those letters remain unscored (the supplied first-letter hint is still a hint), are labelled as such, and do not consume another attempt or change keyboard knowledge.

- Single word: **Next word** starts a fresh board indefinitely.
- Sequence solve: **Next length** advances 4 → 5 → 6.
- Sequence failure: **Another N-letter word** retries the same length.
- Solving six: **Round complete**, with **New round**.
- Word expiry: **Word time is up**, with the usual next-word or same-length retry action.
- Overall expiry: **Round time is up**, with **New round**; it cannot continue at the old length.

Desktop continuation returns focus to the non-editable guess display. Touch continuation never needs a native keyboard; a paired physical keyboard works even when focus returns to the document. No shared scoreboard or daily gate; personal history lives in its own dialog (see History).

## Settings and help

Use native modal dialogs with labelled headings, a close control, Escape dismissal and background inertness.

Settings includes appearance, untimed and ITV-inspired timed presets, round format, word length, guesses per word (1–10 or Unlimited), invalid-word policy, word clock (off/per word/per guess) and editable positive whole-second durations. The independently optional overall clock is available only for sequences. Unknown submitted words can be rejected for free, use one guess, or end the word. A consumed unknown guess appears on the board with dashed tiles and ? marks (unscored, not absent); it gives no letter clues or keyboard updates, and shares a finite guess budget with accepted guesses. Under Unlimited it remains recorded but never exhausts a budget. Sequence length selection is disabled because the sequence starts at four. The **Preset** selector loads a preview, not a running game. The preview names the format, guesses per word, clock scopes/durations and unknown-word policy. Further edits mark the draft Custom. Final sprint defaults to Unlimited, with a 90-second overall clock and no word/guess clock; its preview describes unknown words as unscored. The other presets retain a five-guess default. The apply/save controls remain visible outside the dialog's scrolling fields on narrow screens.

Game settings are saved separately from the active round snapshot:
- **Apply now** is the primary action; it explicitly restarts the whole current round using the previewed rules.
- **Save for next round** preserves play and shows a pending-settings notice naming the saved rules. Each single word is a round; a sequence holds its settings, including the guess limit, through retries and advances until completion. The notice clears when those rules become active.
- Closing without saving discards the rule draft, but immediate appearance changes remain.

Help explains whole-word entry, duplicates, feedback, invalid-word outcomes, sequence retries and clocks. The per-word guess limit is configurable from one to ten or Unlimited. Five is the default except for Final sprint. Unlimited counters show the current guess number without a fictitious maximum. The active board, counters, help and result use the snapshotted limit.

### History

A **History** header button opens a native modal dialog with the same heading, close control and Escape behaviour as Settings and Help. It opens on the group matching the saved settings, with a labelled selector for other recorded groups. Statistics are text first: words played, solved percentage, guess distribution as labelled rows with bars as reinforcement only, current and best streak, and average solve time in minutes:seconds; sequence groups add rounds completed and rounds whose time ran out. Below them, the 50 most recent words are listed newest first with answer, result, guesses used and group. An empty group or history shows **No finished words yet.** **Clear history** is a two-step control inside the dialog (Clear history, then Confirm clear or Cancel) rather than a browser confirm. Blocked or corrupt history storage shows the empty state and never prevents play. The three header buttons must fit a 320px viewport without horizontal overflow.

### Clock presentation

The compact status area above the board shows a labelled Word or Guess timer, a labelled Round timer, or Untimed when both clocks are off. Use minutes:seconds and a text/symbol low-time cue, not colour alone. Each active timer has a theme-coloured time-remaining bar below its readout: full at its configured duration, shrinking to empty at expiry. Bars follow the same deadlines and freeze/reset rules as their numbers, independently for word/guess and round time. Native progress semantics expose the labelled remaining time without live tick announcements; untimed play has no bar. Clock roles have live updates off to avoid announcing every tick; expiry is announced once through the result status.

Per-guess time resets on a spent attempt (including a consumed unknown guess), not a free rejection. During play, clocks continue across tab switches and open dialogs. A word result freezes its word clock. A solve or Give up also freezes the overall sequence timer and its progress bar, with a paused message in the result; this pause survives dialogs, theme changes and background wake-ups. Explicit next-word/next-length continuation resumes the same precise remaining overall time, while the new word's own clock gets its configured duration. Ordinary failure results still use overall wall time. Completing the final or whole-round expiry stops the overall clock; a fresh round gets a new budget. Appearance changes do not restart time.

## Loading and failures

Render the shared header while loading all six packaged word lists. Show an announced loading message, or a visible error and **Try again** when loading/parsing fails. Do not reveal an unplayable board. Credits remain available. Missing/corrupt/blocked localStorage falls back safely and must not prevent play.

## Mobile-first acceptance

- Check 320px and 390px portrait layouts, six-letter boards, and short/landscape viewports.
- Inputs/selects use at least 16px text to avoid unwanted iOS focus zoom.
- Command controls and keyboard keys are at least 44px high; letter keys fit the conventional ten-key row, with at least 24px width at the tested narrow viewport.
- Respect safe-area insets and viewport height; allow vertical scrolling rather than clipping controls.
- Touch taps must enter/delete/check/continue without depending on hover.
- Gameplay has no editable text field. Tapping/focusing the guess display keeps the on-screen keyboard visible and does not summon the native keyboard. Settings retain their appropriate native form controls.
- Keyboard users can type, submit, continue and dismiss dialogs; visible focus is required.
- Feedback must remain readable with reduced motion and without distinguishing colours.

Playwright covers real tap events in touch-emulated Chromium, rather than only resizing a desktop page. Desktop/mobile screenshots are inspected. **Physical-device iOS Safari, native keyboard occlusion, browser chrome and safe-area behaviour still need a device check**; an unavailable simulator is not evidence that those checks passed.

## Current implementation boundary

The React frontend implements untimed/timed single-word and sequence play, all three invalid-word policies, independent clock scopes, the three themes, editable presets, local persistence and device-local History. See [design.md](design.md#presets-and-background-behaviour) for the preset table, TV timing evidence and solo adaptation boundaries. Older preferences gain the five-guess default without losing their existing choices or clocks; explicitly saved limits are not silently replaced. Select Final sprint again and Apply now to use its new unlimited default. Unlimited choices persist and restore like finite limits.

The isolated prototype's frozen clocks remain visual examples, not the production timing implementation. Physical-device Safari/native-keyboard testing remains outstanding; controlled-time Chromium tests cover background catch-up and expiry guards.
