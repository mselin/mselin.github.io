// SPDX-License-Identifier: GPL-2.0-or-later
// Starts a debug build of the app with a stand-in for Discord, switches the presence setting on the way a
// player would (SLEAZEBURG_SELFTEST, debug builds only), and checks that Discord is asked to show the game.
// The whole path: the game loads in the system's web view, the page reaches the app's one command, and the
// app reaches Discord.
//
//   node smoke.cjs <path to the app>         on Linux, under xvfb-run if there is no display
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const app = process.argv[2];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb64-'));
fs.chmodSync(dir, 0o700);
const seen = [];
const discord = net.createServer((sock) => {
  let buf = Buffer.alloc(0);
  const send = (op, obj) => {
    const body = Buffer.from(JSON.stringify(obj));
    const head = Buffer.alloc(8);
    head.writeUInt32LE(op, 0);
    head.writeUInt32LE(body.length, 4);
    sock.write(Buffer.concat([head, body]));
  };
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 8 && buf.length >= 8 + buf.readUInt32LE(4)) {
      const op = buf.readUInt32LE(0),
        msg = JSON.parse(buf.subarray(8, 8 + buf.readUInt32LE(4)).toString());
      buf = buf.subarray(8 + buf.readUInt32LE(4));
      if (op === 0) send(1, { cmd: 'DISPATCH', evt: 'READY' });
      else if (op === 3) send(4, msg);
      else {
        seen.push(msg.args.activity);
        send(1, { cmd: 'SET_ACTIVITY', evt: null, nonce: msg.nonce });
      }
    }
  });
  sock.on('error', () => {});
});
discord.listen(path.join(dir, 'discord-ipc-0'), () => {
  const child = spawn(app, [], {
    env: { ...process.env, XDG_RUNTIME_DIR: dir, SLEAZEBURG_SELFTEST: '1' },
    stdio: ['ignore', 'inherit', 'pipe'],
  });
  let log = '';
  child.stderr.on('data', (d) => (log += d));
  const finish = (ok, why) => {
    child.kill('SIGTERM');
    discord.close();
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(ok ? `ok: ${why}` : `FAILED: ${why}\n--- app log ---\n${log}`);
    process.exit(ok ? 0 : 1);
  };
  const started = Date.now();
  const timer = setInterval(() => {
    const shown = seen.find((a) => a && a.details);
    if (shown) {
      clearInterval(timer);
      finish(true, `Discord was asked to show "${shown.details} | ${shown.state}"`);
    } else if (Date.now() - started > 60000) {
      clearInterval(timer);
      finish(false, 'Discord was never asked to show the game');
    }
  }, 250);
  child.on('exit', (code) =>
    finish(false, `the app exited (${code}) before Discord was asked to show anything`),
  );
});
