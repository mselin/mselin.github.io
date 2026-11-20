// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestShowsOnTheFirstStateAndCarriesTheSessionStart(t *testing.T) {
	r := newRig(t)
	started := r.clock.t.Unix()
	r.b.Update(State{V: 1, Mode: "loading"})
	got := r.discord.seen()
	if len(got) != 1 {
		t.Fatalf("want one SET_ACTIVITY, got %d", len(got))
	}
	var a struct {
		Details, State string
		Assets         map[string]string
		Timestamps     map[string]int64
		Buttons        any
	}
	json.Unmarshal([]byte(got[0]), &a)
	if a.Details != `LOAD "SLEAZEBURG",8,1` || a.State != "Still loading" {
		t.Errorf("text: %q / %q", a.Details, a.State)
	}
	if a.Assets["large_image"] != "logo" || a.Assets["large_text"] != "Sleazeburg 64" || a.Assets["small_image"] != "" {
		t.Errorf("assets: %v", a.Assets)
	}
	if a.Timestamps["start"] != started {
		t.Errorf("start %d, want %d", a.Timestamps["start"], started)
	}
	if a.Buttons != nil {
		t.Error("the presence must carry no button")
	}
}

func TestTenChangesInsideTheLimitSendOnlyTheLatest(t *testing.T) {
	r := newRig(t)
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	for i := 0; i < 10; i++ {
		r.pass(1)
		r.b.Update(state("chase", []string{"gentrifia", "debt_valley"}[i%2], "car", 1+i%5))
	}
	if n := len(r.discord.seen()); n != 1 {
		t.Fatalf("inside the 15 s window: want only the first send, got %d", n)
	}
	r.pass(6)
	got := r.discord.seen()
	if len(got) != 2 {
		t.Fatalf("after the window: want one more send, got %d", len(got)-1)
	}
	if d := details(t, got[1]); d != "Outrunning the cops in Debt Valley" || !strings.Contains(got[1], `"Heat level 5"`) {
		t.Errorf("the latest state should win, got %s", got[1])
	}
}

func TestHeartbeatsWithTheSameStateSendNothing(t *testing.T) {
	r := newRig(t)
	for i := 0; i < 12; i++ {
		r.b.Update(state("roaming", "the_moat", "on_foot", 0))
		r.pass(10)
	}
	if n := len(r.discord.seen()); n != 1 {
		t.Errorf("want one send for an unchanged state, got %d", n)
	}
	if n := r.logged("showing"); n != 1 {
		t.Errorf("the log should have state changes only, got %d 'showing' lines", n)
	}
}

func TestTheElapsedTimerSurvivesTextChanges(t *testing.T) {
	r := newRig(t)
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.pass(20)
	r.b.Update(state("chase", "gentrifia", "car", 2))
	got := r.discord.seen()
	start := func(s string) int64 {
		var a struct{ Timestamps map[string]int64 }
		json.Unmarshal([]byte(s), &a)
		return a.Timestamps["start"]
	}
	if len(got) != 2 || start(got[0]) != start(got[1]) {
		t.Errorf("start time changed between updates: %v", got)
	}
}

func TestSilenceFromTheGameClearsThePresence(t *testing.T) {
	r := newRig(t)
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.pass(30)
	if got := r.discord.seen(); len(got) != 1 {
		t.Fatalf("cleared too early: %v", got)
	}
	r.pass(2)
	got := r.discord.seen()
	if len(got) != 2 || got[1] != "null" {
		t.Fatalf("want a clear after 30 s without a heartbeat, got %v", got)
	}
	// A new session starts its own timer.
	r.pass(60)
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	if got = r.discord.seen(); len(got) != 3 || !strings.Contains(got[2], `"start":`+itoa(r.clock.t.Unix())) {
		t.Errorf("a new session should start now, got %v", got)
	}
}

func TestStopAndExitClearAtOnce(t *testing.T) {
	r := newRig(t)
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.b.Stop()
	if got := r.discord.seen(); len(got) != 2 || got[1] != "null" {
		t.Fatalf("Stop: %v", got)
	}
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.b.Close()
	if got := r.discord.seen(); len(got) != 4 || got[3] != "null" {
		t.Fatalf("Close: %v", got)
	}
}

func TestALongPauseHidesAndPlayBringsItBack(t *testing.T) {
	r := newRig(t)
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.pass(20)
	for i := 0; i < 31; i++ { // five minutes and a bit of heartbeats while paused
		r.b.Update(State{V: 1, Mode: "paused"})
		r.pass(10)
	}
	got := r.discord.seen()
	if len(got) != 3 || details(t, got[1]) != "PRESS PLAY ON TAPE" || got[2] != "null" {
		t.Fatalf("want roaming, paused, then a clear; got %v", got)
	}
	r.b.Update(State{V: 1, Mode: "paused"})
	if len(r.discord.seen()) != 3 {
		t.Error("still paused: it should stay hidden")
	}
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	if got = r.discord.seen(); len(got) != 4 || !strings.Contains(got[3], `"start":`+itoa(r.clock.t.Unix())) {
		t.Errorf("play should bring it back as a new session, got %v", got)
	}
}

func TestDiscordRestartIsLoggedOnceAndThePresenceReturns(t *testing.T) {
	r := newRig(t)
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.discord.stop()
	for i := 0; i < 6; i++ {
		r.b.Update(state("roaming", "gentrifia", "car", 0))
		r.pass(10)
	}
	if n := r.logged("will keep trying"); n != 1 {
		t.Errorf("want one log line about losing Discord, got %d: %v", n, r.logs)
	}
	attempts := r.discord.dials
	r.discord.start()
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.pass(6)
	got := r.discord.seen()
	if len(got) != 2 || details(t, got[1]) != "Cruising Gentrifia at 50 Hz PAL" {
		t.Fatalf("the presence should come back by itself, got %v", got)
	}
	if attempts > 14 {
		t.Errorf("%d attempts to reach Discord in a minute: it should back off", attempts)
	}
	if r.discord.handshakes != 2 || r.logged("Discord is back") != 1 {
		t.Errorf("handshakes %d, logs %v", r.discord.handshakes, r.logs)
	}
}

func TestWithoutAnApplicationIDNothingIsSentOrDialled(t *testing.T) {
	r := newRig(t)
	r.b.appID = ""
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	r.pass(40)
	if len(r.discord.seen()) != 0 || r.discord.handshakes != 0 {
		t.Error("the bridge contacted Discord without an application id")
	}
	if r.b.Status()["app_id_configured"] != false {
		t.Error("status should say no application id is configured")
	}
}

func TestTheVariantIsKeptForAsLongAsTheModeLasts(t *testing.T) {
	r := newRig(t)
	n := 0
	r.b.random = func() int { n++; return n }
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	first := r.b.schema.Render(r.b.state, r.b.pick).Details
	r.b.Update(state("roaming", "debt_valley", "car", 0))
	second := r.b.schema.Render(r.b.state, r.b.pick).Details
	if strings.ReplaceAll(first, "Gentrifia", "X") != strings.ReplaceAll(second, "Debt Valley", "X") {
		t.Errorf("the line changed with the district alone: %q then %q", first, second)
	}
	picked := r.b.pick
	r.b.Update(state("chase", "debt_valley", "car", 1))
	if r.b.pick == picked {
		t.Error("a new mode should pick a new variant")
	}
}

func TestClaimFile(t *testing.T) {
	if goos == "windows" {
		t.Skip("the claim file is a Linux convention: the bridge never writes one on Windows")
	}
	dir := filepath.Join(t.TempDir(), "discord-rpc")
	file := filepath.Join(dir, "sleazeburg-64.claim")
	r := newRig(t)
	r.b.claimDir = dir
	r.b.Update(state("roaming", "gentrifia", "car", 0))
	if _, err := os.Stat(dir); err == nil {
		t.Fatal("the bridge must not create the shared directory itself")
	}
	os.Mkdir(dir, 0o700)
	r.pass(1)
	var claim map[string]int64
	body, err := os.ReadFile(file)
	if err != nil || json.Unmarshal(body, &claim) != nil {
		t.Fatalf("no claim while showing: %v", err)
	}
	if claim["priority"] != 30 || claim["expires"] <= r.clock.t.Unix() {
		t.Errorf("claim %v", claim)
	}
	// Kept fresh, with an expiry always ahead, while it lasts.
	for i := 0; i < 5; i++ {
		r.b.Update(state("roaming", "gentrifia", "car", 0))
		r.pass(10)
		body, _ = os.ReadFile(file)
		json.Unmarshal(body, &claim)
		if claim["expires"] <= r.clock.t.Unix()+20 {
			t.Fatalf("the claim is about to lapse: %v at %d", claim, r.clock.t.Unix())
		}
	}
	r.b.Stop()
	if _, err := os.Stat(file); err == nil {
		t.Error("the claim should go when the presence clears")
	}
}

func itoa(n int64) string { b, _ := json.Marshal(n); return string(b) }
