# ESDB word-list source and static guess lists

The source is the [English Speller Database (ESDB)](https://github.com/en-wl/wordlist), release `rel-2026.02.25`, commit `7e99edab8e32f9f9ea2b15f249ca8d4d67237410`. The downloaded source archive is committed at `vendor/esdb-2026.02.25.tar.gz` so regeneration does not require a live download. It came from:

`https://codeload.github.com/en-wl/wordlist/tar.gz/7e99edab8e32f9f9ea2b15f249ca8d4d67237410`

SHA-256: `770dd3e42d20b47bb2dd87d150db4ee5472841a7f062876592f67840f5a0b902`. `scripts/build-wordlists.py` verifies this hash before unpacking and requires Python 3, SQLite (via Python), `make`, and `tar`. It builds ESDB's database and invokes its `scowl word-list 60 B,Z 5 --categories= --wo-poses=abbr` command, then keeps lowercase ASCII `a-z` words of exactly 4, 5, or 6 letters. This favours British English, includes eligible British `-ise`/`-ize` variants, and omits abbreviations, punctuation, accents, and non-letter entries that cannot fit the game's letter tiles.

| Static path | Words |
| --- | ---: |
| `public/words/4.txt` | 2,640 |
| `public/words/5.txt` | 5,224 |
| `public/words/6.txt` | 8,492 |

Each asset is a sorted, unique, newline-delimited **accepted-guess** list. A later task will curate a smaller set of answers; these lists are not yet suitable for random puzzle answers. `public/words/COPYRIGHT.txt` is the upstream copyright and permission notice. Include an accessible attribution link to that notice when the player UI is built.

Regenerate with `python3 scripts/build-wordlists.py` and check the committed lists with `python3 -m unittest discover -s tests -v`. A static server rooted at `public/` serves `/words/4.txt`, `/words/5.txt`, `/words/6.txt`, and `/words/COPYRIGHT.txt`. The React/Vite scaffold is not in place yet; this static-path contract is verified with Python's HTTP server, while app-level loading remains the later F3 task.
