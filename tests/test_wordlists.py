"""Checks for the committed, statically served ESDB guess lists."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import unittest
from urllib.request import urlopen


PUBLIC = Path(__file__).resolve().parents[1] / "public"


class WordListsTest(unittest.TestCase):
    def test_lists_are_unique_sorted_and_playable_shapes(self) -> None:
        examples = {4: "play", 5: "apple", 6: "colour"}
        for length, example in examples.items():
            with self.subTest(length=length):
                words = (PUBLIC / "words" / f"{length}.txt").read_text().splitlines()
                self.assertGreater(len(words), 0)
                self.assertEqual(words, sorted(set(words)))
                self.assertTrue(all(len(word) == length and word.isascii()
                                    and word.isalpha() and word.islower() for word in words))
                self.assertIn(example, words)

    def test_static_server_exposes_lists_and_copyright(self) -> None:
        handler = partial(SimpleHTTPRequestHandler, directory=str(PUBLIC))
        with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                for filename in ("4.txt", "5.txt", "6.txt", "COPYRIGHT.txt"):
                    with self.subTest(filename=filename):
                        with urlopen(f"http://127.0.0.1:{server.server_port}/words/{filename}") as response:
                            self.assertEqual(response.status, 200)
                            self.assertGreater(len(response.read()), 0)
            finally:
                server.shutdown()
                thread.join()


if __name__ == "__main__":
    unittest.main()
