# ESDB word-list source and static guess lists

The source is the [English Speller Database (ESDB)](https://github.com/en-wl/wordlist), release `rel-2026.02.25`, commit `7e99edab8e32f9f9ea2b15f249ca8d4d67237410`. The committed snapshot at `vendor/esdb-2026.02.25-60-BZ5.txt` was extracted once from that revision with ESDB's `scowl word-list 60 B,Z 5 --categories= --wo-poses=abbr` command. Its SHA-256 is `8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c`.

`scripts/build-wordlists.ts` verifies the snapshot hash, keeps lowercase ASCII `a-z` words of exactly 4, 5, or 6 letters, and produces the three static lists using Node/TypeScript. Regeneration **in this repository requires no Python, SQLite, make, or tar**. ESDB's upstream tools would be needed only to prepare a *new* source snapshot when changing releases. The pinned snapshot favours British English, includes eligible British `-ise`/`-ize` variants, and the filter omits abbreviations, punctuation, accents, and non-letter entries that cannot fit the game's letter tiles.

| Static path | Words |
| --- | ---: |
| `public/words/4.txt` | 2,640 |
| `public/words/5.txt` | 5,224 |
| `public/words/6.txt` | 8,492 |

Each asset is a sorted, unique, newline-delimited **accepted-guess** list. A later task will curate a smaller set of answers; these lists are not yet suitable for random puzzle answers. `public/words/COPYRIGHT.txt` is the upstream copyright and permission notice. Include an accessible attribution link to that notice when the player UI is built.

Regenerate with `npm run words:build` and verify with `npm test` and `npm run test:e2e`. Vite copies `public/words/` into the static build, serving `/words/4.txt`, `/words/5.txt`, `/words/6.txt`, and `/words/COPYRIGHT.txt`. App-level loading remains the F3 task.
