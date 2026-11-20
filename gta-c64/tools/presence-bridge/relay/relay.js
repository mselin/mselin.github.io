// SPDX-License-Identifier: GPL-2.0-or-later
// The helper window. Some browsers, Safari among them, do not let a page served over https reach the bridge at
// http://127.0.0.1. They do let it open a window of the bridge's own, and talk to that window with postMessage.
// This is that window: the game sends it what it would have sent the bridge, and it passes that on.
//
// It takes messages only from the window that opened it, and only if that window is the game, at one of the
// addresses the bridge allows (the page lists them in data-origins). It passes on only the two requests the
// game makes, and the bridge checks those as it checks everything else.
'use strict';
(() => {
  const origins = (document.documentElement.dataset.origins || '').split(' ').filter(Boolean);
  const state = document.getElementById('state');
  const MAX_BODY = 1024; // what the bridge itself accepts

  function show(text, bad) {
    state.textContent = text;
    state.classList.toggle('bad', !!bad);
  }
  // The game's address is not known until it writes, so say hello to each address it may have.
  function hello() {
    for (const origin of origins)
      try {
        window.opener.postMessage({ sb64: 'ready', v: 1 }, origin);
      } catch (e) {
        /* the game has gone */
      }
  }
  async function forward(method, body) {
    const init = { method, credentials: 'omit' };
    if (body) {
      init.body = body;
      init.headers = { 'Content-Type': 'application/json' };
    }
    const res = await fetch('/v1/presence', init);
    let reply = null;
    try {
      reply = await res.json();
    } catch (e) {
      /* not JSON: an error page */
    }
    return { ok: res.ok, status: res.status, body: reply };
  }
  function report(reply) {
    if (!reply.ok) show('The helper program turned the game away (' + reply.status + ').', true);
    else if (reply.body && !reply.body.discord_connected)
      show(
        'Passing the game on, but the helper program cannot reach Discord. Is the Discord desktop app open?',
        true,
      );
    else show('Passing the game on to Discord.');
  }
  let stopped = false;
  async function stop(why) {
    if (stopped) return;
    stopped = true;
    show(why);
    try {
      await forward('DELETE');
    } catch (e) {
      /* the bridge has gone too: it clears the profile by itself */
    }
    window.close();
  }

  addEventListener('message', async (e) => {
    if (stopped || !window.opener || e.source !== window.opener || !origins.includes(e.origin)) return;
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.sb64 === 'stop') return stop('The game switched it off. You can close this window.');
    if (m.sb64 !== 'request' || typeof m.id !== 'number') return;
    if (m.method !== 'POST' && m.method !== 'DELETE') return;
    if (m.body != null && (typeof m.body !== 'string' || m.body.length > MAX_BODY)) return;
    let reply;
    try {
      reply = await forward(m.method, m.method === 'POST' ? m.body : null);
      report(reply);
    } catch (err) {
      reply = { ok: false, status: 0, body: null };
      show('The helper program has stopped. Start it again, then reopen this window from the game.', true);
    }
    e.source.postMessage({ sb64: 'reply', id: m.id, ...reply }, e.origin);
  });

  if (!window.opener) {
    show('Open this window from the game: in its information page, under Discord Rich Presence.', true);
    return;
  }
  hello();
  // When the game goes, so does what it was showing.
  const watch = setInterval(() => {
    if (!window.opener || window.opener.closed) {
      clearInterval(watch);
      stop('The game was closed. You can close this window.');
    }
  }, 2000);
})();
