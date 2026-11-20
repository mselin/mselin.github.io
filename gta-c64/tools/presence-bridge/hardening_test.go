// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

// Showing and clearing in turn used to go straight to Discord each time. Every send now counts against one
// limit, and the session lines in the log are kept down too.
func TestShowingAndClearingInALoopIsHeldToOneLimit(t *testing.T) {
	r := newRig(t)
	for i := 0; i < 1000; i++ {
		r.b.Update(State{V: 1, Mode: "menu"})
		r.b.Stop()
	}
	if n := len(r.discord.seen()); n > sendBurst {
		t.Fatalf("%d sends to Discord at once; the limit is %d", n, sendBurst)
	}
	if n := len(r.logs); n > logBurst+sendBurst {
		t.Fatalf("%d log lines for one burst:\n%s", n, strings.Join(r.logs, "\n"))
	}
	// What was asked for last still gets there once the limit allows: the last word was a stop.
	r.pass(35)
	seen := r.discord.seen()
	if seen[len(seen)-1] != "null" {
		t.Errorf("Discord was left showing %s", seen[len(seen)-1])
	}
	// And the next session's start is logged with a count of the ones left out.
	r.b.Update(State{V: 1, Mode: "menu"})
	if last := r.logs[len(r.logs)-1]; !strings.Contains(r.logs[len(r.logs)-2]+last, "more starts and ends not logged") {
		t.Errorf("the log does not say how many were left out: %q", r.logs)
	}
}

// Whatever answers on Discord's socket or pipe may not be Discord. What it says reaches the log only short
// and with its control characters escaped, so it can neither fill the disk nor play tricks on a terminal.
func TestAFakeDiscordCannotFloodOrGarbleTheLog(t *testing.T) {
	r := newRig(t)
	r.discord.refusal = []byte("\x1b]0;pwned\x07\nsession started\n" + strings.Repeat("A", 1<<20-40))
	r.b.Update(State{V: 1, Mode: "menu"})
	for i := 0; i < 60; i++ {
		r.pass(1)
		r.b.Update(State{V: 1, Mode: "menu"})
	}
	total := 0
	for _, line := range r.logs {
		total += len(line)
		if strings.ContainsAny(line, "\x1b\x07\n") {
			t.Fatalf("a control character reached the log: %q", line)
		}
	}
	if total > 4000 {
		t.Fatalf("%d bytes of log in a minute", total)
	}
	if r.logged("cannot reach Discord") != 1 {
		t.Errorf("the refusal should be logged once: %q", r.logs)
	}
}

func TestConnectionsCannotBeHeldOpenForEver(t *testing.T) {
	s := newHTTPServer(nil)
	for name, d := range map[string]time.Duration{
		"ReadHeaderTimeout": s.ReadHeaderTimeout, "ReadTimeout": s.ReadTimeout,
		"WriteTimeout": s.WriteTimeout, "IdleTimeout": s.IdleTimeout,
	} {
		if d <= 0 || d > time.Minute {
			t.Errorf("%s is %v", name, d)
		}
	}
	if s.MaxHeaderBytes <= 0 || s.MaxHeaderBytes > 64<<10 {
		t.Errorf("MaxHeaderBytes is %d", s.MaxHeaderBytes)
	}
}

func TestEveryAnswerIsMarkedNotToBeSniffedOrCached(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	for _, q := range []request{
		{method: "GET", url: base + "/v1/status"},
		post(base, gameOrigin, `{"v":1,"mode":"menu"}`),
		{method: "GET", url: base + "/nothing-here", origin: gameOrigin},
	} {
		res, _ := do(t, q)
		if res.Header.Get("X-Content-Type-Options") != "nosniff" || res.Header.Get("Cache-Control") != "no-store" {
			t.Errorf("%s %s: %v", q.method, q.url, res.Header)
		}
	}
}

// A development copy of the game is not trusted unless the bridge is started with -allow-origin for it.
func TestDevelopmentCopiesAreNotTrustedByDefault(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	for _, origin := range []string{"http://localhost:8064", "http://127.0.0.1:8064"} {
		if res, _ := do(t, post(base, origin, `{"v":1,"mode":"menu"}`)); res.StatusCode != http.StatusForbidden {
			t.Errorf("POST from %s: %d", origin, res.StatusCode)
		}
	}
}
