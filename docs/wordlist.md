# ESDB word-list source and static word data

The source is the [English Speller Database (ESDB)](https://github.com/en-wl/wordlist), release `rel-2026.02.25`, commit `7e99edab8e32f9f9ea2b15f249ca8d4d67237410`. Two prepared snapshots from that revision are committed, so regeneration **in this repository requires no Python, SQLite, make, or tar**:

| Snapshot | Contents | SHA-256 |
| --- | --- | --- |
| `vendor/esdb-2026.02.25-60-BZ5.txt` | The full `scowl word-list 60 B,Z 5 --categories= --wo-poses=abbr` output | `8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c` |
| `vendor/esdb-2026.02.25-sizes.txt` | `word<TAB>size` for every 4–6 letter word, giving the smallest ESDB size tier each word appears in | `d5dd185fe19c6ae66d21f37d039d74fb6983c347c0086962c7b4c21bdbc16860` |

ESDB's upstream Python tooling would be needed only to prepare a *new* snapshot when changing releases.

## How the two lists differ

Both lists favour British English and include eligible British `-ise`/`-ize` variants. The extraction filter drops abbreviations, punctuation, accents, and any entry that is not a lowercase ASCII `a-z` word of the right length, because those cannot be played as letter tiles.

- **Accepted guesses** come from ESDB's default size 60, so players are not told a legitimate word is invalid.
- **Answers** come only from ESDB's smallest size 35 tier, which is where its commonness ranking starts. This keeps puzzle answers familiar without a hand-written list. The threshold is a single constant in `scripts/build-wordlists.ts` and can be raised if answers still feel obscure.

`data/excluded-answers.txt` removes words that must never be used as a random puzzle answer — slurs, profanity, and anatomical or sexual terms. It applies to answers only; the guess lists stay broad, so a player typing such a word still gets a fair rejection. Extend that file rather than special-casing code.

| Length | Answers | Accepted guesses |
| --- | ---: | ---: |
| 4 | 1,864 | 2,640 |
| 5 | 3,469 | 5,224 |
| 6 | 5,316 | 8,492 |

Each generated asset is sorted, unique, and newline-delimited, and every answer is also an accepted guess. `public/words/COPYRIGHT.txt` is the upstream copyright and permission notice. Include an accessible attribution link to that notice when the player UI is built.

Regenerate with `npm run words:build` and verify with `npm test` and `npm run test:e2e`. Vite serves `public/` at the site root in both development and production builds, so the app fetches `/words/<n>.txt` and `/words/answers/<n>.txt` locally with no development proxy. Missing or malformed lists produce a visible error.
