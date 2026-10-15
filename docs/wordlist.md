# ESDB word-list source and static word data

The source is the [English Speller Database (ESDB)](https://github.com/en-wl/wordlist), release `rel-2026.02.25`, commit `7e99edab8e32f9f9ea2b15f249ca8d4d67237410`. Three prepared snapshots from that revision are committed, so regeneration **in this repository requires no Python, SQLite, make, or tar**:

| Snapshot | Contents | SHA-256 |
| --- | --- | --- |
| `vendor/esdb-2026.02.25-60-BZ5.txt` | The full `scowl word-list 60 B,Z 5 --categories= --wo-poses=abbr` output | `8adc6796c1fc97ceda3d1818904dae5ca5e6bd3c129f24eb7d09ee6655433c0c` |
| `vendor/esdb-2026.02.25-sizes.txt` | `word<TAB>size` for every 4–6 letter word, giving the smallest ESDB size tier each word appears in | `d5dd185fe19c6ae66d21f37d039d74fb6983c347c0086962c7b4c21bdbc16860` |
| `vendor/esdb-2026.02.25-plural-nouns.txt` | Sorted 4–6 letter plural-only nouns with no eligible non-plural sense | `612b7950b8d8954fd7ccf43976a23ed49dd0b1f1054c2e77d37c5220557d741f` |

The plural-noun snapshot records 2,072 plural-only spellings in the eligible size-60 dictionary.

Normal list generation remains TypeScript-only. ESDB's upstream Python/SQLite tooling is needed only when preparing or refreshing a vendor snapshot, not for building the app, regenerating its packaged lists, or running tests.

## How the two lists differ

Both lists favour British English and include eligible British `-ise`/`-ize` variants. The extraction filter drops abbreviations, punctuation, accents, and any entry that is not a lowercase ASCII `a-z` word of the right length, because those cannot be played as letter tiles.

- **Accepted guesses** come from ESDB's default size 60, so players are not told a legitimate word is invalid.
- **Answers** come only from ESDB's smallest size 35 tier, which is where its commonness ranking starts. This keeps puzzle answers familiar without a hand-written list. Plural-only nouns are excluded from answers, but remain accepted guesses. Verbs ending in **s**, mixed noun/verb forms and legitimate singular or other non-plural senses are retained. The threshold is a single constant in `scripts/build-wordlists.ts` and can be raised if answers still feel obscure.

`data/excluded-answers.txt` removes words that must never be used as a random puzzle answer — slurs, profanity, and anatomical or sexual terms. It applies to answers only; the guess lists stay broad, so a player typing such a word still gets a fair rejection. Extend that file rather than special-casing code.

| Length | Answers | Accepted guesses |
| --- | ---: | ---: |
| 4 | 1,748 | 2,640 |
| 5 | 3,115 | 5,224 |
| 6 | 4,761 | 8,492 |

## Plural classification and provenance

The plural snapshot was extracted from `scowl_v0` after building the database with upstream `make` at the pinned revision above. Upstream's README **POSes** section and `libscowl/constdata.sql` define `ns` as noun plural, `nss` as plural of plural, `vs` as an inflected verb and `ms` as a combined noun/verb form. The source's `libscowl/_search.py::queryString` supplies the dictionary filters reproduced below. Re-extracting the unmodified guess source yielded the same original checksum, confirming the dictionary scope.

A spelling is excluded only when it has a plural-noun record and no eligible non-plural usage. Unknown `?` records are not evidence of a non-plural usage. Verb and combined `ms` records prevent exclusion; a singular/adjective sense also preserves a spelling. This is **not** an ends-with-s heuristic: `cats`, `mice`, `feet`, `geese`, `teeth`, `knives` and `ladies` are excluded, while `gives`, `parks`, `reads`, `leaves`, `news`, `series` and `sheep` remain eligible. ESDB's basic POS coverage is the authority, not a claim that every possible dictionary sense has been classified.

The exact extraction SQL (newline-delimited, sorted output):

```sql
SELECT word
FROM scowl_v0
WHERE size <= 60
  AND spelling IN ('_', 'B', 'Z')
  AND region IN ('', 'GB')
  AND category = ''
  AND variant_level <= 5
  AND base_pos != 'abbr'
  AND length(word) BETWEEN 4 AND 6
  AND word NOT GLOB '*[^a-z]*'
GROUP BY word
HAVING MAX(pos IN ('ns', 'nss')) = 1
   AND MAX(pos NOT IN ('ns', 'nss', '?')) = 0
ORDER BY word;
```

The generator applies this pinned exclusion set after common-tier and safety curation, removing 1,025 previous answers (116 four-letter, 354 five-letter and 555 six-letter words). It never modifies the accepted-guess assets.

## Clue puzzles

`npm run words:build` also writes `public/words/clues/<n>.txt` for [In one clue puzzles](design.md#in-one-clue-puzzles). Each line is an answer followed by up to three clue words, space-separated; answers are sorted and only those with a qualifying clue are listed. A clue's letter feedback is not stored: the game derives it with the same `evaluateGuess` the build used. A clue word qualifies for an answer when:

- it is itself a curated answer (a familiar word) of the same length, and not the answer;
- its feedback shows at most half of its letters in the right place (2 of 4, 2 of 5, 3 of 6), so it is not a near giveaway; and
- **no other accepted guess of that length** would produce the same feedback, so every other word a player can enter contradicts the clue.

Qualifying clues are ordered from least to most revealed (right-place letters, then letters shown at all, then alphabetically); an answer keeps the first, middle and last of them, without repeats, so its clues span difficulty. Generation is deterministic and takes a few seconds. 1,363 of 1,748 four-letter (78%), 2,833 of 3,115 five-letter (91%) and 4,643 of 4,761 six-letter answers (97.5%) have a clue; the rest are mostly crowded families such as `bells`/`balls`/`bills`. Most listed answers keep three clues (2,326 of the five-letter ones). The generated-data tests re-check every stored clue against the full accepted list, and play re-checks each clue it chooses against the loaded guess list, skipping any another word could fit.

Each generated asset is sorted, unique, and newline-delimited, and every answer is also an accepted guess. `public/words/COPYRIGHT.txt` is the upstream copyright and permission notice. Include an accessible attribution link to that notice when the player UI is built.

Regenerate with `npm run words:build` and verify with `npm test` and `npm run test:e2e`. Vite serves `public/` at the site root in both development and production builds, so the app fetches `/words/<n>.txt`, `/words/answers/<n>.txt` and `/words/clues/<n>.txt` locally with no development proxy. Missing or malformed lists produce a visible error.
