# Lingo-inspired word practice: game design

## Status and intent

This document records the agreed player-facing game design. Technical architecture is documented separately in [codebase.md](codebase.md). Preset values and visual details have not all been chosen.

Build an original-branded, responsive English word game for unlimited practice on desktop and mobile. It takes inspiration from the ITV Lingo word puzzles but does not reproduce the show's branding, artwork, teams, prizes, or full TV format. There is no daily limit, account, multiplayer, or shared leaderboard.

## Play and configuration

A word puzzle supplies the first letter. Players submit guesses of the word's length and receive feedback for letters in the right position and letters elsewhere in the answer. Letter feedback must handle duplicates consistently. The Lingo-style baseline is five attempts; the exact set of user-facing controls beyond those below need not be settled now.

Players can edit the relevant rules and load presets. Presets are ordinary configurations, not distinct puzzle implementations. Editing a preset produces a custom configuration. Clocks are **off by default**; preset names, durations, and other tuning can be selected later.

| Setting | Supported choices | Behaviour |
| --- | --- | --- |
| Word clock | Off, per word, per guess | A word timeout fails that word only. A per-word clock lasts across guesses; a per-guess clock resets after an accepted guess. Duration is configurable when enabled. |
| Invalid-word policy | Reject submission, fail word | Rejection does not consume a guess or reset a clock; fail-word ends the current word. Neither can be used to extend a timer. |
| Overall multi-word round clock | Off, on with configurable duration | Its expiry ends the whole multi-word round, unlike a word-clock expiry. |
| Format | Single word, 4→5→6 sequence | Single-word play can continue with another word indefinitely. The sequence advances to the next length only after a solve. |

A guess that cannot form a candidate at all (for example, incomplete or the wrong length) is not a submitted word. The invalid-word policy applies to a submitted candidate that is not in the accepted word list. The supplied first letter remains fixed. Whether additional rule controls such as attempt count should be exposed is not yet decided.

### Single-word format

After a solve, exhausted attempts, invalid-word failure, or word timeout, the result can be shown and the player can start another word. There is no limit on how many words can be played.

### 4→5→6 format

The player must solve one four-letter word, then one five-letter word, then one six-letter word. Failing or timing out on a word produces a **replacement of the same length**; it does not unlock the next length. An optional overall round clock can end the sequence before completion. Without it, the player can keep trying replacement words. This preserves the practice-focused rule that word-clock expiry ends only the current word while allowing a separately configured whole-round limit.

A word clock is scoped to each replacement word. A per-guess clock restarts after each accepted guess. If a word and overall round expire together, overall-round expiry takes precedence. Settings changes take effect at the start of the next round, not during the current one.

## Word selection

Use the [English Speller Database (ESDB, formerly SCOWL)](https://github.com/en-wl/wordlist) as the word source. Accept a broad set of guesses, favouring British English while allowing common spelling variants. Choose answers from a smaller set of familiar 4-, 5-, and 6-letter words; a word's presence in a dictionary does not itself make it a good puzzle answer. There is no promise that every English word will be accepted. Retain the required word-list attribution.

## Deliberately open details

Exact preset values and names, visual identity, timer behaviour while a mobile browser tab is suspended, and whether further rules such as attempt count become user-editable can be determined later. Do not silently choose a rule that contradicts the configured word-versus-round timeout distinction.
