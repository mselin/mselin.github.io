# mselin.github.io

Source for my personal site at https://mselin.github.io, served by GitHub Pages straight from the `main`
branch. There is no build step: what is in the repository is what gets published.

## What is here

| Path | What it is | Published at |
|---|---|---|
| `index.html`, `style.css`, `script.js` | The homepage: how my homelab is built, what runs in it, music and projects | [/](https://mselin.github.io/) |
| [`gta-c64/`](gta-c64/) | Sleazeburg 64, a top-down crime satire for the browser in the style of a Commodore 64 game. See its [README](gta-c64/README.md) | [/gta-c64/](https://mselin.github.io/gta-c64/) |
| [`gta-c64/tools/presence-bridge/`](gta-c64/tools/presence-bridge/) | An optional program, written in Go, that shows what you are doing in the game on your Discord profile. See its [README](gta-c64/tools/presence-bridge/README.md) | Released as downloads, not as a page |
| `.github/` | CI and release workflows, Dependabot settings and the repository check script | |
| `.nojekyll` | Tells GitHub Pages to publish the files as they are, without running Jekyll | |
| `.htmlvalidate.json` | Settings for the HTML validator | |

Every file in the repository can be fetched from the site, including this README. Nothing private belongs
here.

## Running it locally

Serve the folder with any static web server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ for the homepage and http://localhost:8000/gta-c64/ for the game. Opening
the files directly from disk works for the homepage, but not for the game, because browsers will not load
JavaScript modules from `file://`.

The game has its own development setup and tests, described in its [README](gta-c64/README.md).

## Checks

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and on every push to
`main`.

| Job | What it checks |
|---|---|
| Site checks | Every HTML page against the HTML standard, with [html-validate](https://html-validate.org/). Then [`check_repo.py`](.github/scripts/check_repo.py): local links and `#anchors` point at something that exists, JSON and SVG files are well-formed, and no private network addresses or private terms are committed |
| Sleazeburg 64 tests | Lint, unit tests and browser tests for the game, including the game talking to the presence bridge |
| Presence bridge on Linux, Windows and macOS | Formatting, `go vet`, tests, the race detector, and the release builds |
| Presence bridge builds are reproducible | The release binaries come out identical on every system |
| Homebrew formula on macOS | The Homebrew formula installs and passes its test |
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

## Releasing the presence bridge

Pushing a tag of the form `gta-c64/tools/presence-bridge/vX.Y.Z` starts
[`presence-bridge-release.yml`](.github/workflows/presence-bridge-release.yml). It tests on three systems,
builds the Linux and Windows binaries, checks the builds are reproducible, and then publishes the release.
The bridge's [README](gta-c64/tools/presence-bridge/README.md) has the details.

## Codeberg copy

The homepage is also published at https://bjaerni.codeberg.page, from the `pages` branch of
[codeberg.org/bjaerni/pages](https://codeberg.org/bjaerni/pages). That copy is updated by hand and does not
include the game.

## Licence

- **Sleazeburg 64** (`gta-c64/`) is free software under the GNU General Public License, version 2 or later.
  See [`gta-c64/LICENSE`](gta-c64/LICENSE) and the game's README for what the licence does and does not
  cover.
- **The presence bridge** is under the same licence, with its own
  [`LICENSE`](gta-c64/tools/presence-bridge/LICENSE).
- **USBSID-Player** in `gta-c64/usbsid-player/` is by LouDnl, also under GPL-2.0-or-later. See its
  [README](gta-c64/usbsid-player/README.md).
- **The homepage** files at the top level have no licence of their own.
