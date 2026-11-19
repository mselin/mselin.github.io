# USBSID-Player (WebAssembly build)

The SID tune player used by the Sleazeburg 64 radio. It is the same player the
High Voltage SID Collection website uses: a cycle-exact Commodore 64 emulator
with the reSIDfp SID engine.

- Project and source code: https://github.com/LouDnl/USBSID-Player
- Author: LouDnl
- Licence: GNU General Public License, version 2 or later. See `LICENSE`.
  Libraries bundled into the build (such as reSIDfp) keep their own licences;
  see the project page.

The four files here (`usbsid.esm.js`, `usbsid.wasm`, `usplayer-web.js`,
`usplayer-audio.js`) are unmodified copies of the build served by
https://www.hvsc.c64.org/ under `assets/usbsid-player/`, fetched on
2026-11-19. To update, rebuild from the project source (see "Build the
WebAssembly player" in its README) or copy a newer build, keeping the four
files from the same build together.

The game talks to the player only through `../sidplayer.js`.
