#!/usr/bin/env python3
"""The games, from games.json, on the homepage and the profile page.

An entry needs a name, a summary, a source link and tags. "play" is where it runs in a browser; an entry
without it (an app for a device, say) gets a Source link only.

  games.py             write the homepage's game cards into index.html, between the games markers
  games.py --check     fail if index.html does not match games.json (CI)
  games.py --markdown  print the rows for the games table on the profile page (github.com/mselin/mselin)

Standard library only.
"""

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
START, END = "<!-- games: written by .github/scripts/games.py from games.json -->", "<!-- /games -->"


def load(path=ROOT / "games.json"):
    games = json.loads(path.read_text(encoding="utf-8"))["games"]
    for g in games:
        missing = {"name", "summary", "source", "tags"} - g.keys()
        if missing:
            raise ValueError(f"{g.get('name', '?')}: missing {', '.join(sorted(missing))}")
        for url in filter(None, (g.get("play"), g["source"])):
            if not url.startswith("https://"):
                raise ValueError(f"{g['name']}: links must be https: {url}")
    return games


def card(g):
    e = lambda s: html.escape(s, quote=True)
    tags = f'<a href="{e(g["play"])}">Play</a>' if g.get("play") else ""
    tags += f'<a href="{e(g["source"])}">Source</a>'
    tags += "".join(f"<span>{e(t)}</span>" for t in g["tags"])
    return f'    <div class="card"><h3>{e(g["name"])}</h3><p>{e(g["summary"])}</p><div class="tags">{tags}</div></div>'


def homepage(page, games):
    """The page with its game cards replaced by ones written from `games`."""
    before, start, rest = page.partition(START)
    block, end, after = rest.partition(END)
    if not start or not end:
        raise ValueError("index.html has no games markers")
    cards = "\n".join(card(g) for g in games)
    return f"{before}{START}\n{cards}\n    {END}{after}"


def markdown_row(g):
    """One row of the profile page's table. Its first cell links to where the game is played, or to the
    source when there is nothing to play."""
    if not g.get("play"):
        return f'| **[{g["name"]}]({g["source"]})** | {g["summary"]} [Source]({g["source"]}) |'
    return f'| **[{g["name"]}]({g["play"]})** | {g["summary"]} [Play it]({g["play"]}) · [Source]({g["source"]}) |'


def main(argv):
    games = load()
    if "--markdown" in argv:
        print("\n".join(markdown_row(g) for g in games))
        return 0
    path = ROOT / "index.html"
    page = path.read_text(encoding="utf-8")
    want = homepage(page, games)
    if "--check" in argv:
        if page != want:
            print("index.html does not match games.json: run python3 .github/scripts/games.py", file=sys.stderr)
            return 1
        print(f"index.html matches games.json ({len(games)} games)")
        return 0
    path.write_text(want, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
