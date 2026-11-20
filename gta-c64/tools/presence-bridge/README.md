# Sleazeburg 64 presence bridge

Shows what you are doing in [Sleazeburg 64](https://mselin.github.io/gta-c64/) on your Discord profile:

```
Playing Sleazeburg 64
Loitering in Gentrifia
Heat level 2
12:34 elapsed
```

A web page cannot talk to Discord by itself. This small program, which you run on your own computer, does it
for the game: the game tells it what is happening, and it tells the Discord app on the same computer.

## Before you start

- **It is optional.** The game is complete without it. The bridge adds the line on your Discord profile and
  nothing else.
- **What it is.** A program you run yourself. It listens on `127.0.0.1`, which only your own computer can
  reach, and talks to the Discord desktop app on the same computer.
- **What it does not do.** It makes no other network connection, does not update itself, sends no usage
  data, needs no administrator rights, and does not start with your computer unless you set that up.
- **Read the source before you run it.** It is in this folder: about 930 lines of Go, standard library
  only, the 120 lines of the [helper window](relay/), plus tests. [`main.go`](main.go) is the place to start.
- **Build it yourself, or check the download.** Building from source comes first below. For downloads, check
  the SHA-256 checksum against the `SHA256SUMS` file published with the release, and, from 0.2.0, where the
  file was built: `gh attestation verify <file> --repo mselin/mselin.github.io` checks GitHub's signed record
  that the release workflow built it from the tagged source.
- **Downloads are unsigned.** Windows and macOS warn about unsigned programs. The warning appears because
  the file is not signed, not because anything was found in it. See your system's section below.
- **Only the game's own address may use it.** Other websites are refused. The check is by origin, so it
  allows everything at `https://mselin.github.io` as a whole: every page there belongs to the same owner as
  the game. The bridge also serves one page of its own, the [helper window](#safari-and-the-helper-window)
  for Safari, which other pages cannot embed.
- **Meant for a computer you do not share.** Any program on the computer can talk to the bridge, including
  other users' programs on a shared one: they can set your presence to one of the fixed lines, or clear it. And
  if the bridge is not running, another user's program could take its port, and the game would talk to that.
- **What appears on your profile is public** to everyone who can see your Discord activity. See
  [what is shown](#what-is-shown).
- **To stop and remove it**, see [Removing it](#removing-it).
- It is free software under the [GNU General Public License](LICENSE), version 2 or later, and comes with
  **no warranty**. The [privacy page](https://mselin.github.io/gta-c64/privacy.html) and
  [terms of use](https://mselin.github.io/gta-c64/terms.html) cover it too.

## What is shown

While the setting is on in the game and the bridge is running, the game sends the bridge these values and
nothing else:

| Value | What it can be |
|---|---|
| What you are doing | loading, title screen, roaming, on a job, being chased, flatlined, busted, paused, game over, won |
| Where | one of the five districts: Gentrifia, Debt Valley, HOA Heights, Crypto Docks, The Moat |
| How | on foot, in a car, swimming |
| Heat | 0 to 5 |

The bridge turns those into one of a fixed set of lines, all listed in [`schema.json`](schema.json), and
shows them with the game's logo and the time your session started. No text from the web page ever reaches
your profile, and nothing about you is sent anywhere else.

The line clears within about half a minute when you close the game's tab, turn the setting off, quit the
bridge, or stay paused for five minutes.

## Install

The game looks for the bridge on port **26464** of your own computer.

### Build it from source (any system)

Needs [Go](https://go.dev/dl/) 1.22 or later and Git.

```bash
git clone --depth 1 https://github.com/mselin/mselin.github.io.git
```

```bash
cd mselin.github.io/gta-c64/tools/presence-bridge
```

```bash
go build -trimpath -o sleazeburg-presence .
```

On Windows, name the output `sleazeburg-presence.exe`. To reproduce a release byte for byte, check out its
tag and run `./build.sh <version> <system> amd64` instead; it uses the exact Go release the release was built
with.

Or let Go fetch and build a tagged release in one step. The program it installs is called `presence-bridge`:

```bash
go install github.com/mselin/mselin.github.io/gta-c64/tools/presence-bridge@latest
```

### Linux

From a release: download `sleazeburg-presence-linux-amd64` and `SHA256SUMS` from the
[releases page](https://github.com/mselin/mselin.github.io/releases), then check and install it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
```

```bash
install -D -m 755 sleazeburg-presence-linux-amd64 ~/.local/bin/sleazeburg-presence
```

### Windows

From a release: download `sleazeburg-presence-windows-amd64.exe` and `SHA256SUMS`. Check the file in
PowerShell and compare the result with its line in `SHA256SUMS`:

```powershell
Get-FileHash .\sleazeburg-presence-windows-amd64.exe -Algorithm SHA256
```

Because the file is unsigned, Windows may show "Windows protected your PC" when you first run it. That
warning is SmartScreen saying the file is new to it and has no signature; choose **More info**, then
**Run anyway** if the checksum matched. If **Smart App Control** is switched on in Windows 11, it blocks
unsigned programs outright and there is no way to run this one; build it from source instead, or leave the
feature off.

### macOS

The supported route is Homebrew. It builds the program on your Mac from the tagged source code, so there is
no download for Gatekeeper to stop:

```bash
brew tap mselin/tap
```

```bash
brew install mselin/tap/sleazeburg-presence
```

Installing by the full name trusts that one formula, not everything in the tap. Code in a tap runs with your
user's permissions, so read [the formula](https://github.com/mselin/homebrew-tap/blob/main/Formula/sleazeburg-presence.rb)
first; it is short, and its template is in [`packaging/homebrew`](packaging/homebrew).

`go install` and building from source, above, also work without any Gatekeeper prompt. No prebuilt macOS
binaries are published: a binary downloaded in a browser is quarantined and blocked until you allow it in
System Settings.

## Running it

Start it in a terminal (on Windows, double-click it or run it from PowerShell):

```bash
sleazeburg-presence
```

It prints a line when it starts, when a session starts and ends, and when what is shown changes. Leave it
running while you play. Then, in the game:

1. Press **I** to open the information page.
2. Under **Discord Rich Presence**, switch it on. The line underneath says how it is going.
3. Chrome and Edge ask whether the page may reach devices on your local network: allow it. That is the
   browser checking before a website talks to a program on your computer. The permission is for the whole site,
   `mselin.github.io`, and for any device on your local network, not only the bridge; you can take it back in
   the browser's site settings.
4. In Safari, press **Open the helper window** when the game offers it. See below.

You also need the Discord desktop app running on the same computer, with **Share your activity** switched on
in Discord's Activity Privacy settings.

Options, for testing: `-port` changes the port (the game always uses 26464), `-allow-origin` adds an origin
that may use the bridge, `-app-id` sets a different Discord application, `-version` prints the version. A
development copy of the game (`npm start`) needs `-allow-origin http://localhost:8064`: only the game's own
address is allowed otherwise.

### Safari and the helper window

Safari does not let a page served over `https`, like the game, make requests to `http://127.0.0.1`, and there
is no setting to change that. Chrome, Edge and Firefox allow it. So for Safari the bridge serves a small window
of its own at `http://127.0.0.1:26464/relay`, and the game offers a button to open it:

- The game sends the window what it would have sent the bridge, and the window passes it on. Safari allows
  that: the window is a page of its own, not part of the game's page.
- Keep the window open while you play; it can sit behind the game or be minimised. Closing it, switching the
  setting off, or closing the game ends the session, and the profile clears.
- The window takes messages only from the game's own address and only from the window that opened it, and
  passes on only the two requests the game makes. The bridge checks those as it checks everything else. No
  other page can embed it, and it loads nothing but its own script and style.
- The window never asks for a password, a token or a login. A window that does is not this one: close it.
- Once a browser has needed the window, switching the setting on opens it straight away. Safari may ask
  whether the game may open a pop-up window: allow it.

The window needs version 0.2.0 or later. An older bridge answers it with "404 page not found".

## Starting it automatically (optional)

A bridge that is always running can be noticed by websites you visit: in Firefox, and in Chrome or Edge if you
allowed local network access, a page can tell that something answers on port 26464, though it cannot use it.
If that matters to you, start the bridge only when you play.

- **Linux (systemd):** copy [`packaging/systemd/sleazeburg-presence.service`](packaging/systemd/sleazeburg-presence.service)
  to `~/.config/systemd/user/`, then run `systemctl --user daemon-reload` and
  `systemctl --user enable --now sleazeburg-presence`. Logs: `journalctl --user -u sleazeburg-presence -f`.
- **Windows:** press Win+R, type `shell:startup`, and put a shortcut to `sleazeburg-presence.exe` in the
  folder that opens. To run it without a window, create a Task Scheduler task "At log on" for your user
  instead.
- **macOS (Homebrew):** `brew services start sleazeburg-presence`.

## Removing it

- **Linux:** `systemctl --user disable --now sleazeburg-presence` if you set up autostart, delete
  `~/.config/systemd/user/sleazeburg-presence.service`, then delete `~/.local/bin/sleazeburg-presence`.
- **Windows:** quit it, delete the shortcut from `shell:startup` or the task from Task Scheduler if you made
  one, then delete the `.exe`.
- **macOS:** `brew services stop sleazeburg-presence` if you started it as a service, then
  `brew uninstall sleazeburg-presence` and, if you no longer want the tap, `brew untap mselin/tap`.

The bridge keeps no settings or data, so there is nothing else to remove. In the game, switch the setting off
to forget the choice.

## Troubleshooting

| The game says | What to try |
|---|---|
| the helper program was not found | Is the bridge running? Is something else using port 26464 (the bridge says so when it starts)? In Chrome or Edge, check the site settings for `mselin.github.io` and allow local network access. |
| cannot reach Discord | Start the Discord desktop app on the same computer. The web version of Discord cannot show Rich Presence from other programs. Flatpak and Snap installs are found automatically. |
| no Discord application ID | Only happens with a modified build or `-app-id ""`. |
| turned this game away | The bridge and the game are different versions. Update the bridge. |
| connected, but nothing on your profile | Switch on **Share your activity** in Discord's settings, under Activity Privacy. Discord can take up to 15 seconds to show a change. |
| the helper window has not answered | The bridge is not running, or it is older than 0.2.0. If the window says "404 page not found", update the bridge. |
| the browser did not let the game open the helper window | Allow pop-up windows for `mselin.github.io` in the browser's settings, then press the button again. |

**Browsers.** Chrome, Edge and Firefox reach the bridge directly. Safari needs the
[helper window](#safari-and-the-helper-window). A content blocker can also stop the page reaching the bridge:
if the setting stays on "not found" with the bridge running, try the page with content blockers off.

**Checking the bridge on its own.** `curl -s http://127.0.0.1:26464/v1/status` shows whether it is running.
`discord_connected` stays `false` until a game sends something to show: the bridge only connects to Discord
when there is something to show. "address already in use" when you start it means a copy is already running,
for example as a service.

## For developers

### How it works

| Request | What it does |
|---|---|
| `GET /v1/status` | Reports whether the bridge is reachable, configured and connected to Discord. |
| `POST /v1/presence` | Takes a state, as JSON matching [`schema.json`](schema.json). Also counts as a heartbeat. |
| `DELETE /v1/presence` | Ends the session and clears the profile at once. |
| `GET /relay` | The [helper window](#safari-and-the-helper-window), with `relay.js` and `relay.css`. |

Requests must come from an allowed origin to `127.0.0.1:26464` or `localhost:26464`; anything else gets
403 with no CORS headers. The bridge's own origin counts as allowed, for the helper window, and the window's
files are the only thing served to a request with no `Origin` besides `GET /v1/status`. They come with a
Content-Security-Policy that allows only their own script, style and requests to the bridge, and forbids
framing. Bodies are checked against the schema and anything unknown gets 400. Changes reach
Discord at most once every 15 seconds, the latest state winning. The presence clears after 30 seconds without
a heartbeat, after five minutes paused, on `DELETE`, and when the bridge exits.

On Linux, if `$XDG_RUNTIME_DIR/discord-rpc/` already exists, the bridge writes `sleazeburg-64.claim` there
with priority 30 while it shows, for other presence programs that share that convention.

The game's side is [`js/presence.js`](../../js/presence.js). [`schema.json`](schema.json) is the one
description of what may be sent, and both sides read it.

### Tests

```bash
go test -race ./...
```

The tests run against a fake Discord: in memory, over a real Unix socket on Linux and macOS, and over a real
named pipe on Windows. The game's own tests include the page talking to the real bridge:

```bash
go build -o /tmp/sleazeburg-presence .
```

```bash
cd ../.. && SLEAZEBURG_BRIDGE=/tmp/sleazeburg-presence npm test
```

### Dependencies

None at run time beyond Go's standard library. `build.sh` runs one build-time tool on Windows builds,
[goversioninfo](https://github.com/josephspurrier/goversioninfo) v1.7.0 (MIT licence), to write the product
name and version into the `.exe`; it is not linked into the program.

### Releasing

Releases are tagged `gta-c64/tools/presence-bridge/vX.Y.Z`. That is the form `go install` needs for a module
in a subfolder, and it cannot be confused with anything else in the repository. Pushing such a tag runs
[the release workflow](../../../.github/workflows/presence-bridge-release.yml), which tests on Linux, Windows
and macOS, builds the Linux and Windows binaries, rebuilds them on a second machine to check they are
reproducible, and publishes a GitHub Release with `SHA256SUMS` and the rendered Homebrew formula. Copy that
formula to `Formula/sleazeburg-presence.rb` in the `mselin/homebrew-tap` repository.

See the [code signing policy](CODE_SIGNING_POLICY.md) and the [testing checklists](TESTING.md).

### The Discord application

The application ID in [`main.go`](main.go) is public: every copy of the bridge uses the same one. Setting the
application up is done by hand in the [Developer Portal](https://discord.com/developers/applications):

1. Create an application named `Sleazeburg 64`. The name is what appears after "Playing".
2. Copy its **Application ID** from General Information into `defaultAppID` in `main.go`.
3. Set the App Icon to the game's 1024 × 1024 logo.
4. Under **Rich Presence → Art Assets**, upload the logo with the key `logo`. Optionally add `heat-1` to
   `heat-5` for the small heat badge; the keys must match `assets` in `schema.json`.
5. Under General Information, set the Terms of Service URL to `https://mselin.github.io/gta-c64/terms.html`
   and the Privacy Policy URL to `https://mselin.github.io/gta-c64/privacy.html`.

The bridge needs no bot, no OAuth setup and no client secret.
