# Testing with real Discord

The automated tests run against a fake Discord. These checks need a person, a real Discord account and real
machines. Discord recommends a test account while developing, because presence is public.

## Done automatically, without real Discord

- Unit tests on Linux, Windows and macOS runners in CI.
- The fake Discord over a real Unix socket (Linux, macOS) and a real named pipe (Windows).
- The game page in Chromium talking to the real bridge, which talks to a fake Discord over a Unix socket.
- Reproducible builds: the release binaries are rebuilt on a second machine and compared.
- The Homebrew formula installed and tested on a macOS runner.

Everything below has **not** been checked against real Discord.

## Linux, with the Homelab and GTA C64 presences (owner)

- [ ] With the setting on and the bridge running, the profile shows "Playing Sleazeburg 64" within 15 seconds
      of the game's load screen appearing.
- [ ] The lines follow the game within 15 seconds, and the elapsed timer does not restart when they change.
- [ ] Closing the tab clears the presence within 30 seconds.
- [ ] Pausing shows "PRESS PLAY ON TAPE" or the other paused line; after 5 minutes it clears.
- [ ] Switching the setting off clears it at once.
- [ ] While Sleazeburg 64 shows, the Homelab and GTA C64 presences are hidden; they return within one poll
      (20 seconds) after it clears.
- [ ] `journalctl --user -u sleazeburg-presence -f` shows changes only, not a line per heartbeat.
- [ ] From `https://mselin.github.io/gta-c64/` in Chrome, switching the setting on shows one permission
      prompt. Allow makes it work; Block leaves a clear message in the game.
- [ ] Firefox: does the setting connect? Write down what happens.

## Windows (tester)

- [ ] The download's SHA-256 matches `SHA256SUMS`.
- [ ] The warning Windows shows for the unsigned file matches the README.
- [ ] The file's Properties → Details show "Sleazeburg 64 presence bridge" and the release version.
- [ ] It starts without administrator rights and finds the running Discord app.
- [ ] With the setting on, the presence shows, follows the game and clears when the tab closes or the bridge
      quits.
- [ ] Removing it as the README describes leaves nothing behind.

## macOS (tester)

- [ ] `brew install mselin/tap/sleazeburg-presence` works, and the program starts without a Gatekeeper prompt.
- [ ] Checked on Apple silicon. Checked on an Intel Mac.
- [ ] It starts without administrator rights and finds the running Discord app.
- [ ] With the setting on, the presence shows, follows the game and clears when the tab closes or the bridge
      quits.
- [ ] Safari: does the setting connect? Write down what happens.
- [ ] `brew uninstall` and `brew untap` leave nothing behind.

Until a system's list has passed, its release notes say that real Discord and the system warnings are
unverified there.

## For the SignPath Foundation application

Ready in the repository:

- The licence (GPL-2.0-or-later, OSI-approved) and the source of every release, attached by GitHub as the tag's
  archive.
- The [code signing policy](CODE_SIGNING_POLICY.md), linked under that name from the README.
- The download page (the README) says what the program does and how to remove it. Autostart is only ever set
  up by the user.
- Product name and version in the Windows binary, the same version throughout a build.
- A release workflow on GitHub-hosted runners that uploads the unsigned `.exe` with `actions/upload-artifact`
  before anything else uses it, so signing can be added as one step with
  `signpath/github-action-submit-signing-request`.

Still to do by the owner:

- Publish the first release, since SignPath only accepts projects that have released.
- Multi-factor authentication on GitHub and SignPath for everyone on the team.
- Apply, then install the SignPath GitHub App on the repository and approve each signing request by hand.
- After approval, add SignPath's attribution line to the code signing policy (not before).
