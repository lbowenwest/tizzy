# Player interface

## Accepted direction

Records the shared layout and mobile-first direction approved in conversation before the frontend implementation. Game rules remain in [design.md](design.md); technical ownership remains in [codebase.md](codebase.md). The [clickable studies](ui-prototypes.md) show the original direction.

One compact playing screen; one placeholder **Word practice** identity. No promotional hero, side copy, ITV artwork or separate layouts for different themes.

```text
Word practice                   How to play   Settings
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
│ [Type the whole word                    ] [Check] │
│                 Q W E R T Y U I O P               │
│                  A S D F G H J K L                │
│                   Z X C V B N M ⌫                  │
└───────────────────────────────────────────────────┘
Word-list credits
```

The same order is used on phones, without a desktop sidebar. Board tiles have a consistent target size across word lengths, shrinking to fit narrow screens and shorter viewports. A long/landscape screen may scroll; there must be no horizontal overflow.

## Appearance

- **Letterpress:** warm paper, forest-green ink, Fraunces headings/tiles, restrained edges.
- **Afterhours:** dark surfaces, coral actions, Barlow Condensed headings, monospaced tiles.
- **Word Club:** yellow backdrop, navy ink, rounded tactile surfaces and offset shadows.

Themes change colour, typography, borders and shadows only. Selection is immediate and persists locally. It never resets the current word, submitted guesses, typed entry, sequence progress or rules. Production fonts are self-hosted with their SIL Open Font License notices in `public/fonts/`.

## Input trial

The supplied first letter is a green hint tile in the active row, labelled as supplied and marked ✓. There is **no separate prefix beside the input**. Following playtesting feedback, both text input and on-screen keys now enter the **whole word**, including its first letter. Entry starts empty and every typed letter is editable/deletable. If a different first letter is typed, the board shows the actual entry without a green first tile, and checking gives a start-letter reminder without consuming an attempt. Clearing entry restores the hint. Guesses must still start with the supplied letter; that game rule is unchanged.

A labelled native text field supports physical keyboards and Enter; an on-screen keyboard supports touch entry and deletion. Alphabetic input is normalised to uppercase. An incomplete guess receives guidance and costs no attempt. The current guess appears on the board before checking. Keys confirmed absent by accepted guesses turn gray with a × mark and an accessible description; they remain tappable for unrestricted word entry. A letter with any correct or misplaced match stays available, even if extra copies have gray tiles. Knowledge accumulates only within the current word, survives appearance changes, and clears for each new word, retry or sequence length.

Tiles have text/symbol feedback as well as colour and accessible letter/state names. The feedback legend remains visible. Outcome messages are announced through a live status region; do not rely on hover, colour or animation alone.

## Results and progression

A solve or failure keeps the checked board, reveals the answer, and replaces entry/keyboard with a result and an explicit next action.

- Single word: **Next word** starts a fresh board indefinitely.
- Sequence solve: **Next length** advances 4 → 5 → 6.
- Sequence failure: **Another N-letter word** retries the same length.
- Solving six: **Round complete**, with **New round**.

Desktop continuation returns focus to the input. Touch continuation must not automatically open a native keyboard. No scoreboard or daily gate.

## Settings and help

Use native modal dialogs with labelled headings, a close control, Escape dismissal and background inertness.

Settings includes appearance, untimed starting-point presets, round format, word length and invalid-word policy. Sequence length selection is disabled because the sequence starts at four. Choosing a preset fills the same editable rules; further editing marks the draft Custom.

Game settings are saved separately from the active round snapshot:
- **Save for next round** preserves play. Each single word is a round; a sequence holds its settings through retries and advances until completion.
- **Start new round now** explicitly replaces the current round using the saved draft.
- Closing without saving discards the rule draft, but immediate appearance changes remain.

Help explains supplied-letter entry, duplicates, feedback, invalid-word outcomes and sequence retries. Five attempts are fixed for now.

## Loading and failures

Render the shared header while loading all six packaged word lists. Show an announced loading message, or a visible error and **Try again** when loading/parsing fails. Do not reveal an unplayable board. Credits remain available. Missing/corrupt/blocked localStorage falls back safely and must not prevent play.

## Mobile-first acceptance

- Check 320px and 390px portrait layouts, six-letter boards, and short/landscape viewports.
- Inputs/selects use at least 16px text to avoid unwanted iOS focus zoom.
- Command controls and keyboard keys are at least 44px high; letter keys fit the conventional ten-key row, with at least 24px width at the tested narrow viewport.
- Respect safe-area insets and viewport height; allow vertical scrolling rather than clipping controls.
- Touch taps must enter/delete/check/continue without depending on hover.
- Do not autofocus the native input for touch-only play. Hide the redundant on-screen keyboard while the native input is focused on coarse-pointer devices.
- Keyboard users can type, submit, continue and dismiss dialogs; visible focus is required.
- Feedback must remain readable with reduced motion and without distinguishing colours.

Playwright covers real tap events in touch-emulated Chromium, rather than only resizing a desktop page. Desktop/mobile screenshots are inspected. **Physical-device iOS Safari, native keyboard occlusion, browser chrome and safe-area behaviour still need a device check**; an unavailable simulator is not evidence that those checks passed.

## Current implementation boundary

The React frontend implements untimed single-word and sequence play, both invalid-word policies, the three themes, and local persistence for these choices. Clocks are explicitly off; there are no enabled controls that pretend to run a timer.

The approved later clock modes use the compact status area above the board, distinguishing the word clock from the overall sequence clock. Timed values/presets and background-tab semantics remain for G5–G7; this frontend pass does not choose them. The prototype's frozen clock examples are not production timing.
