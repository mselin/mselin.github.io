# Sleazeburg 64 for the desktop

The browser game as an app for Windows, Linux and macOS, with Discord Rich Presence built in. It shows the
same lines on your Discord profile as the [presence bridge](../tools/presence-bridge/README.md) does for the
browser, without the bridge:

- **Nothing to install besides the app.** It talks to the Discord desktop app on the same computer directly.
- **Nothing listens on the network.** The bridge listens on `127.0.0.1` so that a web page can reach it; the
  app has no such port, so no website can detect or use it.
- **No Safari helper window.** The app is not a web page served over https, so nothing blocks it.

It is built with [Tauri 2](https://v2.tauri.app/): the game runs in the system's own web view (WebView2 on
Windows, WebKit on macOS, WebKitGTK on Linux), so the app is a few megabytes, not a copy of a browser.

**This is a first version, to try out.** There are no downloads yet: build it from source, below. Sound and
graphics in WebKitGTK on Linux are the main thing to check; see [Testing](#testing).

## What it does and does not do

- The game's page may call **one** command of the app's, `presence`, and nothing else
  ([`capabilities/main.json`](src-tauri/capabilities/main.json)). It takes a few enumerated values, such as the
  mode, district and heat level, checked against the same [`schema.json`](../tools/presence-bridge/schema.json)
  as the bridge. The words on your profile come from that table, never from the page.
- Discord Rich Presence is **off until you switch it on** in the game's information page, as in the browser,
  and the [privacy page](https://mselin.github.io/gta-c64/privacy.html) applies.
- The page may load only the game's own files, plus the music from the High Voltage SID Collection
  (`www.hvsc.c64.org`). Links to anywhere else open in your web browser, never inside the app.
- Discord's IPC endpoint is opened the careful way the bridge opens it:
  - On Windows, whatever serves the pipe can see who connected but cannot act as you.
  - On Linux and macOS, only a socket of your own is used, never through a link.
  - Replies are capped in size and quoted in the log.
  - Updates are limited to Discord's pace.
- It makes no other network connection and does not update itself.

## Build it from source

You need [Rust](https://rustup.rs/) (the version is pinned in
[`rust-toolchain.toml`](src-tauri/rust-toolchain.toml), and rustup fetches it) and [Node.js](https://nodejs.org/)
22 or later, plus each system's own pieces:

- **Linux** (Debian or Ubuntu names; other distributions have the same libraries):

  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev libxdo-dev libssl-dev build-essential
  ```

- **macOS:** the Xcode command line tools (`xcode-select --install`).
- **Windows:** the Visual Studio C++ build tools. WebView2 is already part of Windows 10 and 11.

Then, in this folder:

```bash
npm ci
```

```bash
npm run build
```

The app is in `src-tauri/target/release/bundle/`: an `.app` and a `.dmg` on macOS, `.deb`, `.rpm` and an
AppImage on Linux, and `.msi` and setup `.exe` installers on Windows. To build only the app, without
installers: `npm run build -- --no-bundle`; it is then `src-tauri/target/release/sleazeburg-64`.

On macOS, an app you built yourself opens without a Gatekeeper warning, because it was not downloaded.

## Testing

Automatic, on every change, on Linux, Windows and macOS:

- The Rust tests (`cargo test` in `src-tauri/`):
  - the same lines as the bridge for every state;
  - refusing what the schema does not list;
  - the rate limits;
  - a fake Discord that floods or garbles;
  - on Windows, that a pipe's server only gets to identify the app's user, and that a pipe that never
    answers is cut off.
- On Linux, `smoke.cjs` starts a debug build with a stand-in for Discord and checks that switching the setting
  on reaches Discord. That covers the game loading in WebKitGTK, the page calling the app, and the app talking
  to Discord.

By hand, please, on real machines:

- [ ] **Linux:** the title music and sound effects play; the game runs smoothly; the window is not blank. Note
      the graphics card and whether the session is Wayland or X11. If the window is blank on NVIDIA under
      Wayland, try starting it with `WEBKIT_DISABLE_DMABUF_RENDERER=1` and note whether that helps.
- [ ] **macOS:** music, sound and play; the presence shows in Discord.
- [ ] **Windows:** the same.
- [ ] On each, switching Discord Rich Presence on shows the game on your profile within 15 seconds, and
      quitting the app clears it.
- [ ] The links on the information page open in the web browser.

## Licence

GNU General Public License, version 2 or later, like the game. See [LICENSE](../LICENSE).
