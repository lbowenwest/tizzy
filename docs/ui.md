# Player interface

## Accepted direction

Records the shared layout and mobile-first direction approved in conversation before the frontend implementation. Game rules remain in [design.md](design.md); technical ownership remains in [codebase.md](codebase.md). The [clickable studies](ui-prototypes.md) show the original direction.

One compact playing screen; one **Tizzy** identity. No promotional hero, side copy, ITV or Lingo branding or separate layouts for different themes.

```text
Tizzy                 How to play   Stats     Settings
┌───────────────────────────────────────────────────┐
│ PRACTICE · 5 LETTERS                      Untimed │
│ Find the word.                                    │
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

The supplied first letter is a green hint tile in the active row, labelled as supplied and marked ✓. There is **no separate prefix beside the input**. Following playtesting feedback, both physical typing and on-screen keys enter the **whole word**, including its first letter. Entry starts empty and every typed letter is editable/deletable. If a different first letter is typed, the board shows the actual entry without a green first tile, and checking gives a start-letter reminder without consuming an attempt. Checking any whole word that doesn't count (the wrong first letter, or an unknown word rejected free) clears the entry so the next guess can be typed straight away; a too-short entry stays to be finished. Clearing entry restores the hint. Guesses must still start with the supplied letter; that game rule is unchanged. No-first-letter Practice and Climb have no hint tile, start-letter constraint or reminder; their neutral prompt allows any first letter. Clue puzzles also have no hint tile or start-letter reminder (see [Clue puzzles](#clue-puzzles)).

The labelled guess display is focusable but not editable: no native text field or contenteditable surface is used during play, so touching it cannot summon a mobile keyboard. A Wordle-style keyboard uses filled, tall keys, a half-key-indented middle row, and wider ENTER/Delete keys at opposite ends of the bottom row. Physical letters, Backspace, Enter and whole-word paste remain supported, without intercepting browser shortcuts, IME composition, settings fields or open dialogs. Enter on an ordinary focused button retains native activation. Alphabetic input is normalised to uppercase. An incomplete guess receives guidance and costs no attempt. The current guess appears on the board before checking. Keys use the strongest checked feedback (correct over present over absent), with ✓/↔/× marks and accessible descriptions. Confirmed-absent keys turn dark gray, while correct and present keys use the board's theme colours; all keys remain tappable. A letter with any correct or misplaced match cannot be downgraded by excess gray duplicate tiles. Knowledge accumulates only within the current word, survives appearance changes, and clears for each new word, retry or sequence length.

Tiles have text/symbol feedback as well as colour and accessible letter/state names. The feedback legend remains visible. Outcome messages are announced through a live status region; do not rely on hover, colour or animation alone.

## Results and progression

Unlimited-guess words show a touch-sized **Give up** button below the on-screen keyboard, also usable by ordinary keyboard button activation. It reveals the answer without automatically changing words. A sequence offers another word of the same length, and its overall clock pauses until explicit continuation, then resumes its remaining time without refill; the action is absent from finite-guess and ended words.

A solve or failure keeps the checked board, reveals the answer, and replaces entry/keyboard with a result and an explicit next action. Word or round expiry, or giving up, also preserves the current full or partial entry on its existing row until continuation. Those letters remain unscored (the supplied first-letter hint is still a hint), are labelled as such, and do not consume another attempt or change keyboard knowledge.

- Single word: **Next word** starts a fresh board indefinitely.
- Sequence solve: **Next length** advances 4 → 5 → 6.
- Sequence failure: **Another N-letter word** retries the same length.
- Solving six: **Round complete**, with **New round**.
- Guess expiry in Quickfire: **Guess time is up** (per-word clocks use **Word time is up**), with the usual next-word or same-length retry action.
- Overall expiry: **Round time is up**, with **New round**; it cannot continue at the old length.

Desktop continuation returns focus to the non-editable guess display. Touch continuation never needs a native keyboard; a paired physical keyboard works even when focus returns to the document. Practice has no daily gate; personal history lives in Stats. Daily has a separate course and result flow below.

### Guess analysis

Each finished practice-word result adds a secondary **Analyse guesses** button below its existing continuation button. There is no analysis control during play. It opens the existing native dialog pattern with title **Your guesses.**, answer and attempt count. Close/Escape restores focus to the analysis button; continuation clears the report. Opening the dialog does not change clock rules, so a paused result stays paused and an ordinary sequence failure still uses wall time.

Following owner feedback, analysis uses a WordleBot-inspired review flow: a compact board of coloured guesses with **Info /100** and **Words left** columns, followed by one selected turn at a time. Clicking a guess or using **Previous / Next guess** changes the turn. The selected row is marked, the first is selected initially, and the navigation stays visible at the bottom while scrolling. Feedback retains text/symbol descriptions; unscored attempts and sole-answer turns show a dash instead of an information score.

A short verdict and concrete prose lead each turn: possibilities before the guess, average expected words left, and the actual outcome. **Still possible** lists the remaining candidate words (first twelve plus an expandable remainder); a solve uses **Answer found**. **Compare the choices** opens a side-by-side table of the player's guess and the most informative alternative, showing bits, average words left and solve chance. Opening it brings the table into view. Last tries retain the solve-probability reminder. **About the analysis** explains the equal-weight model and makes clear that Info /100 is relative information value, not an overall skill/luck rating. In one shows the coloured clue and attempted word with the contradiction explanation. Empty attempts show an explicit empty state. The dialog uses each theme's existing typefaces and colours and scrolls vertically at narrow widths without horizontal overflow.

The reference was the published [WordleBot review screenshot in Tom’s Guide](https://www.tomsguide.com/news/best-wordle-start-words), particularly its coloured board, turn-by-turn explanation and comparison table. Tizzy retains its own information model and does not claim NYT skill/luck scores.

## Settings and help

Use native modal dialogs with labelled headings, a close control, Escape dismissal and background inertness.

Settings has a **Preset** selector, a preview of the chosen preset's rules, and Appearance; individual rules are not editable (see [design.md](design.md#play-and-configuration)). Presets are untimed Practice at 4, 5 and 6 letters, Climb (the untimed 4 → 5 → 6 sequence), Quickfire at 4 and 5 letters, Sprint and In one. The selector loads a preview, not a running game. The preview names the format, any clue, guesses per word, clock scopes/durations and unknown-word policy; Sprint's describes unknown words as unscored. A consumed unknown guess (Sprint) appears on the board with dashed tiles and ? marks (unscored, not absent); it gives no letter clues or keyboard updates, and shares a finite guess budget with accepted guesses. Under Unlimited it remains recorded but never exhausts a budget. The apply/save controls remain visible outside the dialog's scrolling fields on narrow screens.

Game settings are saved separately from the active round snapshot:
- **Apply now** is the primary action; it explicitly restarts the whole current round using the previewed rules.
- **Save for next round** preserves play and shows a pending-settings notice naming the saved rules. Each single word is a round; a sequence holds its settings, including the guess limit, through retries and advances until completion. The notice clears when those rules become active.
- Closing without saving discards the rule draft, but immediate appearance changes remain.

Help explains whole-word entry, duplicates, feedback, invalid-word outcomes, sequence retries and clocks. Each preset fixes its guess limit: five, except Sprint (Unlimited) and In one (one try). Unlimited counters show the current guess number without a fictitious maximum. The active board, counters, help and result use the snapshotted limit.

### Stats

A **Stats** header button opens a native modal dialog (**Your stats.**) with the same heading, close control and Escape behaviour as Settings and Help. A row of mode buttons (Practice, Climb, Quickfire, Sprint, In one; pressed state shown by `aria-pressed`) sits above a lighter row of variant buttons for modes with more than one preset (4 / 5 / 6 letters). It opens on the saved preset; choosing a mode selects the saved preset if it belongs to that mode, else the variant played most recently, else the first. Mode buttons are five across on wider screens and a three-column grid on phones.

```text
[Practice] [Climb] [Quickfire]
[Sprint  ] [In one]
( 4 letters )( 5 letters )( 6 letters )

  10      90%       1         8
Played  Solved  Current   Best streak
                streak
Average solve 0:23

Guess distribution
1 ▏                 0
2 ███               1
3 ██████            2
4 ████████████████  5   ← latest result highlighted
5 ███               1
✗ ███               1
```

Statistics are text first: four headline numbers (played, solved percentage, current and best streak), then smaller figures for average solve time in minutes:seconds and, for sequence presets, rounds completed and rounds whose time ran out. The guess distribution has a labelled row for every guess count up to the preset's limit plus **✗** for words not solved (accessible names such as "3 guesses: 2 words", "Not solved: 1 word").; bars are reinforcement only, and the row holding the most recent result is emphasised. One-try presets (In one) replace the distribution with two uPlot charts in the theme's colours, drawn at the dialog's pixel width so labels stay 10px, with clock-style ticks (0:15, 0:30, 1:00). **Solve times** plots the last 20 words oldest to newest on a log time axis: solves joined by a line, failures as ✕, the latest point enlarged, and a dashed average line, with a small legend; its accessible name lists every time ("Last 4 words, oldest first: 0:10, 0:40, not solved (1:10), 0:20"). **Your spread** draws the fitted bell curve on a log time axis with the middle two-thirds shaded and each solve as a dot on the curve at its time; the latest is larger and labelled ("latest 0:26") on the outside of the slope. The chart is decorative and its caption carries the meaning ("About two-thirds of your solves take 0:23–1:19 (shaded)."). With fewer than two solves it says **Solve at least two words to see your spread.** Median and Fastest join Average solve on the smaller line. Below it, the selected variant's ten most recent words are listed newest first with answer, result and guesses used, or solve time for one-try presets. No history at all shows **No finished words yet.**; an unplayed variant shows **Not played yet.** **Clear stats** is a two-step control inside the dialog (Clear stats, then Confirm clear or Cancel) rather than a browser confirm. Blocked or corrupt history storage shows the empty state and never prevents play. The three header buttons must fit a 320px viewport without horizontal overflow.

### Clue puzzles

```text
IN ONE · 5 LETTERS                                Untimed
Solve the clue.
Try 1 of 1                                One clue given
Clue           [C↔][R×][A✓][N×][E×]          labelled, not a guess
                 [ ][ ][ ][ ][ ]               the one try: no hint tile
Only one word fits the clue.
```

The game also supports clue rounds with more tries, should a future preset want them; a rejected row then stays on the board (`[S][T][A][I][R]` grey, struck, ✕ mark) above the next row:

```text
Try 2 of 3                                One clue given
Clue           [C↔][R×][A✓][N×][E×]
                 [S][T][A][I][R]              rejected
                 [ ][ ][ ][ ][ ]               active row
                 [ ][ ][ ][ ][ ]
Rejected: STAIR doesn't fit. C must appear, but not 1st.
```

The clue row sits above the guess rows with a visible **Clue** label and an accessible name such as "Given clue: CRANE", with ordinary tile marks. It is never the active row and does not count toward the try counter, which reads **Try n of N** (or **Try n · Unlimited**). Every tile in the active row starts empty; the feedback line invites any word instead of naming a start letter, and the meta line reads **One clue given**. A rejected try fills a row with unscored, struck tiles and a ✕ mark (distinct from the ? of an unknown word); the row's accessible name includes its reason, and the reason is announced through the feedback status. The keyboard starts with the clue's evidence and rejected rows never change it. The In one preset has one try, so its board is a single row under the clue. A word lost on a rejected try shows that word and its reason below the revealed answer; Give up and continuation are unchanged. The layout must still fit 320px with the extra row, scrolling vertically if needed.

### Clock presentation

The compact status area above the board shows a labelled Word or Guess timer, a labelled Round timer, or Untimed when both clocks are off. Use minutes:seconds and a text/symbol low-time cue, not colour alone. Each active timer has a theme-coloured time-remaining bar below its readout: full at its configured duration, shrinking to empty at expiry. Bars follow the same deadlines and freeze/reset rules as their numbers, independently for word/guess and round time. Native progress semantics expose the labelled remaining time without live tick announcements; untimed play has no bar. Clock roles have live updates off to avoid announcing every tick; expiry is announced once through the result status.

Per-guess time resets on a spent attempt (including a consumed unknown guess), not a free rejection. During play, clocks continue across tab switches and open dialogs. A word result freezes its word clock. A solve or Give up also freezes the overall sequence timer and its progress bar, with a paused message in the result; this pause survives dialogs, theme changes and background wake-ups. Explicit next-word/next-length continuation resumes the same precise remaining overall time, while the new word's own clock gets its configured duration. Ordinary failure results still use overall wall time. Completing the final or whole-round expiry stops the overall clock; a fresh round gets a new budget. Appearance changes do not restart time.

## Daily Climb

The shared header has **Daily Climb / Practice** navigation. Practice keeps all existing presets; Settings adds no-first-letter variants for all practice lengths and regular Climb. Daily has a two-button hint selector and a date/reset line. The selected hint variant is visible throughout and survives reload through the URL fragment.

The daily lobby presents three ascending 4/5/6 steps, unlimited-guesses/no-limit rules, the timer policy and an explicit **Start daily climb** button. It reveals no letters before starting. The shared board then shows total elapsed time in whole seconds, this-word elapsed time and sequence progress; no Give up or analysis is available during the course. Solved-stage results show that split and say the clock is paused until **Next length**. The race resumes from saved checked guesses after reload; unfinished typed entries are not stored.

The completed screen focuses its heading, leads with total time, then shows a split/guess table with **Analyse** per word, **Copy result**, and when to return. Clipboard failure exposes selectable result text. Daily Stats shows separate variant records, streak, best and average times, and a list of completed runs that can be reopened. Analysis uses the same dialog as practice and runs in a background worker, with loading/error text and an immediately available Close control.

An open course crossing midnight keeps its date and gains a **Go to today’s climb** action. Previous unfinished runs remain available below today's content. Local save failures show an alert and preserve current in-memory play. Daily views share all three themes and use 44px hint controls. During phone play, compact navigation and progress leave room for the board, entry and full keyboard within the viewport. The board grows from actual guesses and the current row; older guesses scroll within it. The date/reset text and repeated clock note stay out of the active mobile layout. Very short or landscape viewports retain ordinary page scrolling. Browser checks cover 320×568 and 390×667, including unlimited guess history.

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

The React frontend implements untimed/timed single-word and sequence play, all three invalid-word policies, independent clock scopes, the three themes, presets, local persistence and device-local Stats. It also implements In one clue puzzles, Daily Climb with saved progress/results, and both hint variants for Practice and regular Climb. See [design.md](design.md#presets-and-background-behaviour) for the preset table, TV timing evidence and solo adaptation boundaries. Preferences store the chosen preset. Rules saved before presets-only restore as the preset they match, otherwise Practice · 5 letters.

The isolated prototype's frozen clocks remain visual examples, not the production timing implementation. Physical-device Safari/native-keyboard testing remains outstanding; controlled-time Chromium tests cover background catch-up and expiry guards.
