# Lingo-inspired word practice: game design

## Status and intent

This document records the agreed player-facing game design. Technical architecture is documented separately in [codebase.md](codebase.md). Timed preset values and background behaviour have been agreed; the visual identity remains a placeholder.

Build an original-branded, responsive English word game for unlimited practice on desktop and mobile. It takes inspiration from the ITV Lingo word puzzles but does not reproduce the show's branding, artwork, teams, prizes, or full TV format. There is no daily limit, account, multiplayer, or shared leaderboard.

## Play and configuration

A word puzzle supplies the first letter. Players submit guesses of the word's length and receive feedback for letters in the right position and letters elsewhere in the answer. Letter feedback must handle duplicates consistently. The Lingo-style default is five attempts, with an editable limit of 1–10 guesses per word or Unlimited. The final sprint defaults to Unlimited: its overall clock, not attempt exhaustion, limits play.

Players can edit the relevant rules and load presets. Presets are ordinary configurations, not distinct puzzle implementations. Editing a preset produces a custom configuration. Clocks are **off by default**. Selecting a preset only loads a preview of its format, guess count, clocks and unknown-word policy. **Apply now** replaces the current round with that preview; **Save for next round** keeps current play unchanged and shows a pending-settings notice. Closing without either action discards the rule draft. Timed presets enable their clocks when applied; the same counts, durations and policies remain editable.

| Setting | Supported choices | Behaviour |
| --- | --- | --- |
| Guesses per word | 1–10 or Unlimited; default 5 outside the final | Finite limits count accepted guesses and consumed unknown words against the same per-word budget. A solve on the last guess still wins. Unlimited has no attempt-exhaustion transition; clocks and other configured failure policies still apply. The board and counter use the round's snapshotted limit. |
| Word clock | Off, per word, per guess | A word timeout fails that word only. A per-word clock lasts across guesses; a per-guess clock resets after a spent attempt, including an unknown word under use-a-guess. Duration is configurable when enabled. |
| Invalid-word policy | Reject submission, use a guess, fail word | Rejection does not consume a guess or reset a clock. Use-a-guess records an unscored attempt without letter clues; with a finite limit, the final allowed attempt fails the word. Under Unlimited, unknown words remain recorded and unscored without ending the word. Fail-word ends the current word immediately. |
| Overall multi-word round clock | Off, on with configurable duration | Its expiry ends the whole multi-word round, unlike a word-clock expiry. |
| Format | Single word, 4→5→6 sequence | Single-word play can continue with another word indefinitely. The sequence advances to the next length only after a solve. |

A guess that cannot form a candidate at all (for example, incomplete or the wrong length) is not a submitted word. The invalid-word policy applies to a submitted candidate that is not in the accepted word list. An unscored attempt must not change keyboard letter knowledge. Random answers exclude plural-only nouns; those words remain valid guesses. Verbs ending in s and words with an eligible non-plural sense remain possible answers, using the pinned ESDB word-form metadata described in [wordlist.md](wordlist.md). The supplied first letter remains fixed.

During unlimited-guess play, **Give up** ends the current word as a failure and reveals its answer. Checked guesses and any unfinished entry stay visible until explicit continuation; the entry remains unscored and no extra attempt is recorded. Single-word play can then start another word. A sequence retries the same length with the same rule snapshot and remaining overall time, rather than advancing or restarting the round. The overall clock pauses while the result is read, including across dialogs or background suspension. Give-up actions reconcile existing deadlines first, so a late action cannot bypass word or round expiry. Limited-guess words do not expose this action.

### Single-word format

After a solve, exhausted attempts, invalid-word failure, word timeout, or voluntary give-up, the result can be shown and the player can start another word. There is no limit on how many words can be played.

### 4→5→6 format

The player must solve one four-letter word, then one five-letter word, then one six-letter word. Failing or timing out on a word produces a **replacement of the same length**; it does not unlock the next length. An optional overall round clock can end the sequence before completion. Without it, the player can keep trying replacement words. This preserves the practice-focused rule that word-clock expiry ends only the current word while allowing a separately configured whole-round limit.

A word clock is scoped to each replacement word. A per-guess clock restarts after each spent attempt. Free rejections and malformed input never reset either clock. If a word and overall round expire together, overall-round expiry takes precedence. Saved settings take effect at the start of the next round, not during the current one. This includes the guess limit, which remains fixed through sequence retries and advances. Apply now explicitly replaces the whole round instead.

## Word selection

Use the [English Speller Database (ESDB, formerly SCOWL)](https://github.com/en-wl/wordlist) as the word source. Accept a broad set of guesses, favouring British English while allowing common spelling variants. Choose answers from a smaller set of familiar 4-, 5-, and 6-letter words; a word's presence in a dictionary does not itself make it a good puzzle answer. There is no promise that every English word will be accepted. Retain the required word-list attribution.

## Presets and background behaviour

The owner approved ITV-inspired timed presets alongside untimed practice:

| Preset | Format | Guesses per word | Unknown word | Word clock | Overall clock |
| --- | --- | --- | --- | --- | --- |
| Practice · untimed | Single, 5 letters | 5 | Reject | Off | Off |
| 4 → 5 → 6 · untimed | Sequence | 5 | Reject | Off | Off |
| ITV-style · 4 letters | Single, 4 letters | 5 | Fail word | Per guess, 10 seconds | Off |
| ITV-style · 5 letters | Single, 5 letters | 5 | Fail word | Per guess, 10 seconds | Off |
| Final sprint · 90 seconds | Sequence | Unlimited | Record unscored | Off | 90 seconds |

These are **solo adaptations**, not a complete TV recreation. The main-round inspiration is ten seconds per guess with five guesses: on TV, invalid words or timeouts pass control to another team, which this app adapts to word failure. The final's inspiration is the earlier four-, five-, six-letter sprint within ninety seconds. The final defaults to unlimited guesses at every length, with unknown words recorded but no attempt penalty; only the overall deadline ends an unfinished final. Other presets default to five guesses per word. Players may customise either limit. This app retains same-length retries, without TV money, teams, passing, larger puzzlewords or later-series gambles. The final's unknown-word policy is a practice choice, not a claim about TV penalties.

Timing evidence: [Lingo (British game show), revival gameplay](https://en.wikipedia.org/wiki/Lingo_(British_game_show)) and [UKGameshows, Lingo](https://www.ukgameshows.com/ukgs/Lingo). Both were read to verify the ten-second main-round and ninety-second final timings.

All durations are editable positive whole seconds. During play, timers use elapsed wall time and **continue across tab switches, browser suspension and open dialogs**. Returning to an active suspended tab reconciles its deadlines immediately. A late submission or give-up action cannot bypass expiry. **Solving a word or giving up pauses the overall clock until explicit continuation**, including while dialogs are open or the page is suspended. Continuation resumes the exact remaining milliseconds rather than refilling the round budget; each new word's own clock still gets its configured duration. Ordinary word failures (attempt exhaustion, unknown-word failure or word timeout) retain the running-overall-clock policy. A successful final stops its clock permanently until a fresh round. Word results stop that word's own clock.

## Attempt history

Finished words are recorded on this device so a player can see how they have done over time. A word is recorded once it has a result: solved, attempts used up, unknown-word failure, word or round timeout, or Give up. If the overall clock expires while a failed sequence word's result is displayed, that word's record takes the round-expiry result instead of gaining a second entry. Unfinished words (replaced by Apply now, or abandoned by a reload or closed tab) are not recorded; this is solo practice, not a tamper-proof record.

History is grouped by the preset its round's rules matched when the round started; every other configuration shares one **Custom** group. Each group shows words played, solved percentage, the distribution of guesses used for solved words, current and best solve streaks (consecutive solved words; any failure ends a streak) and average solve time. Sequence groups also count completed rounds and rounds whose overall clock ran out. A recent-words list shows each answer, result, guesses used and group. History retains the 1,000 most recent words; totals and best streaks cover only retained words. The player can clear it after confirmation.

There is no account, sync, shared leaderboard, date-based streak or daily goal, and the result screen is unchanged.

## Deliberately open details

Final visual identity can be determined later. Physical-device iOS/background suspension checks remain a validation limitation, not an unspecified timer policy.
