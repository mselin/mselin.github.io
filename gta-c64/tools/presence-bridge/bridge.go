// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	minUpdateGap     = 15 * time.Second // Discord's own limit on activity updates
	heartbeatTimeout = 30 * time.Second // no word from the game for this long: it has gone
	pausedTimeout    = 5 * time.Minute  // paused for this long: stop showing
	pingEvery        = 10 * time.Second // how often to check Discord is still there
	claimPriority    = 30               // see claim()
)

// Bridge holds one play session and keeps Discord in step with it.
type Bridge struct {
	schema *Schema
	appID  string
	now    func() time.Time
	random func() int
	dial   func() (io.ReadWriteCloser, error)
	logf   func(format string, args ...any)
	// claimDir, if it exists, is where presence programs on one machine tell each other who should show.
	claimDir string

	mu          sync.Mutex
	active      bool      // a session is running
	hidden      bool      // paused for too long; shows again when play resumes
	start       time.Time // when the session started: the elapsed timer on the profile
	lastBeat    time.Time
	state       State
	pick        int // which variant line, chosen when the mode is entered
	pausedSince time.Time

	conn       *discordConn
	sent       *Activity // what Discord is showing, nil for nothing
	lastSend   time.Time
	lastPing   time.Time
	downLogged bool
	nonce      int
}

// Update takes a state from the game. It also counts as a heartbeat.
func (b *Bridge) Update(st State) {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	resumed := b.hidden && st.Mode != "paused"
	if !b.active || resumed {
		b.active, b.hidden, b.start, b.pick = true, false, now, b.random()
		b.pausedSince = time.Time{}
		b.logf("session started")
	}
	if st.Mode != b.state.Mode {
		b.pick = b.random()
		b.pausedSince = time.Time{}
		if st.Mode == "paused" {
			b.pausedSince = now
		}
	}
	b.state, b.lastBeat = st, now
	b.flush()
}

// Stop ends the session at once: the tab closed, the game quit or the setting was switched off.
func (b *Bridge) Stop() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.end("stopped by the game")
}

// Tick runs once a second: it notices a game that has gone quiet, and sends anything that was held back.
func (b *Bridge) Tick() {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	if b.active && now.Sub(b.lastBeat) > heartbeatTimeout {
		b.end("no heartbeat from the game")
	}
	if b.active && !b.hidden && !b.pausedSince.IsZero() && now.Sub(b.pausedSince) > pausedTimeout {
		b.hidden = true
		b.logf("paused for a long time: hiding")
	}
	if b.conn != nil && now.Sub(b.lastPing) >= pingEvery {
		b.lastPing = now
		if err := b.conn.ping(); err != nil {
			b.lost(err)
		}
	}
	b.flush()
}

// Close clears the presence and releases everything. Called on exit.
func (b *Bridge) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.end("bridge exiting")
	if b.conn != nil {
		b.conn.rw.Close()
		b.conn = nil
	}
}

// Status is what GET /v1/status and every other reply report.
func (b *Bridge) Status() map[string]any {
	b.mu.Lock()
	defer b.mu.Unlock()
	return map[string]any{
		"ok":                true,
		"name":              "sleazeburg-presence",
		"version":           version,
		"schema":            b.schema.V,
		"app_id_configured": b.appID != "",
		"discord_connected": b.conn != nil,
		"showing":           b.sent != nil,
	}
}

func (b *Bridge) end(why string) {
	if !b.active {
		return
	}
	b.active, b.hidden, b.state = false, false, State{}
	b.logf("session ended: %s", why)
	b.flush()
}

func (b *Bridge) lost(err error) {
	b.conn.rw.Close()
	b.conn = nil
	b.sent = nil // whatever Discord was showing went with the connection
	b.lastSend = time.Time{}
	if !b.downLogged {
		b.downLogged = true
		b.logf("lost Discord (%v); will keep trying", err)
	}
}

// flush brings Discord into line with the session, within the rate limit.
func (b *Bridge) flush() {
	var want *Activity
	if b.active && !b.hidden && b.appID != "" {
		a := b.schema.Render(b.state, b.pick)
		want = &a
	}
	b.claim(want != nil)
	if (want == nil) == (b.sent == nil) && (want == nil || *want == *b.sent) {
		return
	}
	now := b.now()
	// Changes of text wait their turn, and the latest one wins. Clearing, and showing after a clear, do not.
	if want != nil && b.sent != nil && now.Sub(b.lastSend) < minUpdateGap {
		return
	}
	if b.conn == nil {
		if want == nil {
			b.sent = nil
			return
		}
		rw, err := b.dial()
		if err == nil {
			c := &discordConn{rw}
			if err = c.handshake(b.appID); err == nil {
				b.conn, b.lastPing = c, now
				if b.downLogged {
					b.logf("Discord is back")
				}
				b.downLogged = false
			} else {
				rw.Close()
			}
		}
		if err != nil {
			if !b.downLogged {
				b.downLogged = true
				b.logf("cannot reach Discord (%v); will keep trying", err)
			}
			return
		}
	}
	b.nonce++
	if err := b.conn.setActivity(want, b.start, fmt.Sprint(b.nonce)); err != nil {
		b.lost(err)
		return
	}
	if want == nil {
		b.logf("cleared")
	} else {
		b.logf("showing: %s | %s", want.Details, want.State)
	}
	b.sent, b.lastSend = want, now
}

// claim cooperates with other presence programs on the same machine. Each one that wants to show writes
// <name>.claim with a priority and an expiry; the highest unexpired priority shows and the others hide.
// It only happens where the shared directory already exists, and the file's contents are fixed.
func (b *Bridge) claim(showing bool) {
	if b.claimDir == "" {
		return
	}
	file := filepath.Join(b.claimDir, "sleazeburg-64.claim")
	if !showing {
		os.Remove(file)
		return
	}
	if info, err := os.Stat(b.claimDir); err != nil || !info.IsDir() {
		return
	}
	body, _ := json.Marshal(map[string]int64{"priority": claimPriority, "expires": b.now().Add(time.Minute).Unix()})
	os.WriteFile(file, body, 0o600)
}
