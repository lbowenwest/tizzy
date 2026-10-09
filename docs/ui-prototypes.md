# UI prototype — shared layout, selectable themes

Open `/prototypes/index.html` with `npm run dev`, or from a production preview. The owner liked Letterpress and Word Club and asked to keep the visual directions as configurable themes rather than separate interfaces.

The prototype now uses one game-focused layout in all three themes:
- Compact header with help and settings; one placeholder “word practice” identity.
- Mode, optional clocks and sequence progress above the board.
- Feedback and results below the board.
- Letter entry, on-screen keyboard and check action below.
- No promotional headline or side copy on the playing screen.

**Letterpress** is paper and forest-green ink; **Afterhours** is a dark, coral-accented theme; **Word Club** is yellow, navy and tactile surfaces. Appearance changes immediately from Settings or the comparison bar, without resetting the example or changing its rules. Theme selection is not tied to a game preset.

## Input trial

The owner asked to start with the supplied first letter green and revisit input after trying it. The active row shows the supplied first letter as a green tile with a symbol and accessible label. The separate fixed-letter prefix beside the text field has been removed. For this initial trial, text/keyboard entry still fills the remaining letters. This is a provisional interaction, not approval of a permanent locked-letter design or removal of the Lingo clue.

After playtesting, the main React app changed to whole-word input (including the first letter) and grays keyboard letters confirmed absent. The isolated study retains the earlier remaining-letter trial; see [the current UI contract](ui.md).

## Prototype boundaries

Boards use fixed sample feedback, clocks show frozen values, and controls do not persist settings. Submissions are not dictionary-validated. “Next example” resets a fixture, not a randomly selected puzzle. Failed sequence examples stay at the same length; solved examples preview the next length. These boundaries apply only to the isolated prototype; the main React app now implements untimed gameplay.

Use the state controls for in-play, solved, word failed, round expired, loading and unavailable examples. Settings application starts a new example; game settings do not silently change the current one. Names, presets and timer durations remain illustrative.

Google Fonts provide Fraunces, Barlow Condensed, DM Sans and IBM Plex Mono, with usable fallbacks. Font hosting/licensing choices can follow final selection. The prototype has desktop/mobile checks and accessible text/symbols in addition to colour.

The approved shared layout, provisional first-letter trial and mobile-first acceptance are recorded in [ui.md](ui.md). Production fonts are now self-hosted; the isolated studies still use Google Fonts.
