# mselin.github.io

Source for my personal site at https://mselin.github.io, served by GitHub Pages straight from the `main`
branch. There is no build step: what is in the repository is what gets published.

## What is here

| Path | What it is | Published at |
|---|---|---|
| `index.html`, `style.css`, `script.js` | The homepage: how my homelab is built, what runs in it, music and projects | [/](https://mselin.github.io/) |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | The site icon: a terminal prompt. The `.ico` holds a hand-tuned 16 px version plus 32 and 48 px; the PNGs are for phone home screens. Pages without an icon of their own fall back to `/favicon.ico` | [/favicon.ico](https://mselin.github.io/favicon.ico) |
| [`games.json`](games.json) | The games shown on the homepage and on the [profile page](https://github.com/mselin): name, a line about each, and where to play it and read the source. See [The games](#the-games) | [/games.json](https://mselin.github.io/games.json) |
| `.github/` | CI, Dependabot settings, the repository check script and the script that writes the game cards | |
| `.nojekyll` | Tells GitHub Pages to publish the files as they are, without running Jekyll | |
| `.htmlvalidate.json` | Settings for the HTML validator | |

The games have repositories of their own, each with its own CI that publishes it with GitHub Pages as a
project site under this address:

| Game | Repository | Published at |
|---|---|---|
| Sleazeburg 64, a top-down crime satire for the browser in the style of a Commodore 64 game, with its Discord presence bridge and desktop app | [mselin/gta-c64](https://github.com/mselin/gta-c64) | [/gta-c64/](https://mselin.github.io/gta-c64/) |
| Sleazeburg 64 for a real Commodore 64, in 6502 assembly | [mselin/Sleazeburg64](https://github.com/mselin/Sleazeburg64) | [/Sleazeburg64/](https://mselin.github.io/Sleazeburg64/) |

The browser game lived in this repository's `gta-c64/` folder until 20 November 2026, and moved, with its
history, to its own repository at the same address. Version 0.1.0 of its presence bridge was released from
here, under the tag `gta-c64/tools/presence-bridge/v0.1.0`; later versions are released from the game's
repository.

Every file in the repository can be fetched from the site, including this README. Nothing private belongs
here.

## Running it locally

Serve the folder with any static web server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ . Opening `index.html` directly from disk works too.

## Checks

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and on every push to
`main`.

| Job | What it checks |
|---|---|
| Site checks | Every HTML page against the HTML standard, with [html-validate](https://html-validate.org/) |
| Repository checks | [`check_repo.py`](.github/scripts/check_repo.py): local links and `#anchors` point at something that exists, JSON and SVG files are well-formed, and no private network addresses or private terms are committed. Then the game cards: [`games.py`](.github/scripts/games.py)'s tests, and the homepage's cards match [`games.json`](games.json) |
| All checks passed | Succeeds only if every job above did. This is the one check that merging requires |

To run the site checks yourself:

```bash
git ls-files -z '*.html' | xargs -0 npx --yes html-validate@11.21.1
```

```bash
python3 .github/scripts/check_repo.py
```

The script also reads an optional `PRIVATE_TERMS` repository secret: host names, domains and similar, one per
line, that must never appear in the repository. A match fails the check and is reported by file and line only,
never by the term itself, because Actions logs on a public repository are public.

## Making changes

`main` is protected by a ruleset:

- Every change goes in through a pull request. Pushing straight to `main`, force pushing and deleting the
  branch are blocked.
- The pull request can only be merged once **All checks passed** is green and any review comments are
  resolved. No approvals are needed.
- Nobody can bypass these rules, the repository owner included.

Merging into `main` publishes the change; GitHub Pages usually has it live within a couple of minutes.

The actions in the workflows are pinned to exact commits. Dependabot opens a pull request once a month to
update them.

## The games

[`games.json`](games.json) lists the games, and both pages that show them follow it:

- **The homepage.** Its game cards, between the `games` markers in `index.html`, are written from the file by
  [`.github/scripts/games.py`](.github/scripts/games.py). After changing `games.json`, run it and commit both:

  ```bash
  python3 .github/scripts/games.py
  ```

  CI fails if the cards and the file differ.
- **The profile page,** [github.com/mselin](https://github.com/mselin). Its README has the same games as table
  rows; `python3 .github/scripts/games.py --markdown` prints them. The profile repository's CI checks its rows
  against the published [`games.json`](https://mselin.github.io/games.json).

## Codeberg copy

The homepage is also published at https://bjaerni.codeberg.page, from the `pages` branch of
[codeberg.org/bjaerni/pages](https://codeberg.org/bjaerni/pages). That copy is updated by hand and does not
include the game.

## Licence

- **The homepage** (`index.html`, `style.css` and `script.js`) is © 2026 Mika Selin, licensed under
  [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/)
  (CC BY-SA 4.0). You may copy, share and adapt it, commercially too, as long as you credit Mika Selin with
  a link to https://mselin.github.io, say if you changed it, and release your version under the same licence.
  The full text is in [`LICENSES/CC-BY-SA-4.0.txt`](LICENSES/CC-BY-SA-4.0.txt).
- **The games** are in their own repositories, under their own licences: see
  [mselin/gta-c64](https://github.com/mselin/gta-c64) and [mselin/Sleazeburg64](https://github.com/mselin/Sleazeburg64).
