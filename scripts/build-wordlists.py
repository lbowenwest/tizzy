#!/usr/bin/env python3
"""Build static 4-, 5- and 6-letter guess lists from the pinned ESDB source."""

from collections import Counter
from hashlib import sha256
from pathlib import Path
import re
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "vendor/esdb-2026.02.25.tar.gz"
SOURCE_COMMIT = "7e99edab8e32f9f9ea2b15f249ca8d4d67237410"
ARCHIVE_SHA256 = "770dd3e42d20b47bb2dd87d150db4ee5472841a7f062876592f67840f5a0b902"
OUTPUT = ROOT / "public/words"
WORD = re.compile(r"[a-z]{4,6}\Z")


def run(*args: str, cwd: Path) -> str:
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout


def main() -> None:
    if sha256(ARCHIVE.read_bytes()).hexdigest() != ARCHIVE_SHA256:
        raise ValueError(f"ESDB archive checksum mismatch: {ARCHIVE}")

    with tempfile.TemporaryDirectory(prefix="lingo-esdb-") as directory:
        temp = Path(directory)
        run("tar", "-xzf", str(ARCHIVE), "-C", str(temp), cwd=temp)
        source = temp / f"wordlist-{SOURCE_COMMIT}"
        run("make", "scowl.db", cwd=source)
        raw_words = run(
            "./scowl", "word-list", "60", "B,Z", "5",
            "--categories=", "--wo-poses=abbr", cwd=source,
        )
        words = {word for word in raw_words.splitlines() if WORD.fullmatch(word)}
        groups = {length: sorted(word for word in words if len(word) == length)
                  for length in (4, 5, 6)}
        if any(not group for group in groups.values()):
            raise ValueError("ESDB produced an empty word length")

        OUTPUT.mkdir(parents=True, exist_ok=True)
        for length, group in groups.items():
            (OUTPUT / f"{length}.txt").write_text("\n".join(group) + "\n", encoding="utf-8")
        (OUTPUT / "COPYRIGHT.txt").write_bytes((source / "Copyright").read_bytes())

    print("Static ESDB guess lists:", dict(sorted(Counter(map(len, words)).items())))


if __name__ == "__main__":
    main()
