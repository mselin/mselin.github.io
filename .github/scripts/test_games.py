"""Tests for games.py: python3 -m unittest discover -s .github/scripts"""

import json
import tempfile
import unittest
from pathlib import Path

import games


class Games(unittest.TestCase):
    def test_the_real_file_loads_and_the_homepage_matches_it(self):
        g = games.load()
        self.assertGreaterEqual(len(g), 2)
        page = (games.ROOT / "index.html").read_text(encoding="utf-8")
        self.assertEqual(page, games.homepage(page, g))

    def test_a_card_has_play_and_source_links_and_escapes_text(self):
        c = games.card({"name": "A & B", "summary": "<x>", "play": "https://p/", "source": "https://s/", "tags": ["t"]})
        self.assertIn("<h3>A &amp; B</h3><p>&lt;x&gt;</p>", c)
        self.assertIn('<a href="https://p/">Play</a><a href="https://s/">Source</a><span>t</span>', c)

    def test_writing_the_cards_twice_changes_nothing(self):
        page = f"<div>\n    {games.START}\n    old\n    {games.END}\n</div>"
        g = [{"name": "N", "summary": "S", "play": "https://p/", "source": "https://s/", "tags": []}]
        once = games.homepage(page, g)
        self.assertEqual(once, games.homepage(once, g))
        self.assertNotIn("old", once)

    def test_a_page_without_markers_is_an_error(self):
        with self.assertRaises(ValueError):
            games.homepage("<div></div>", [])

    def test_links_must_be_https_and_fields_complete(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "games.json"
            path.write_text(json.dumps({"games": [{"name": "N", "summary": "S", "play": "http://p/", "source": "https://s/", "tags": []}]}))
            with self.assertRaises(ValueError):
                games.load(path)
            path.write_text(json.dumps({"games": [{"name": "N"}]}))
            with self.assertRaises(ValueError):
                games.load(path)

    def test_the_profile_row(self):
        row = games.markdown_row({"name": "N", "summary": "S.", "play": "https://p/", "source": "https://s/", "tags": []})
        self.assertEqual(row, "| **[N](https://p/)** | S. [Play it](https://p/) · [Source](https://s/) |")


if __name__ == "__main__":
    unittest.main()
