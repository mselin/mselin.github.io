// SPDX-License-Identifier: GPL-2.0-or-later

//go:build !windows

package main

import (
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// The whole path on Linux and macOS: the bridge finds a socket the way it finds Discord's, and a state
// posted over HTTP arrives there as a SET_ACTIVITY.
func TestOverARealUnixSocket(t *testing.T) {
	dir, err := os.MkdirTemp("", "sb") // short: socket paths are limited to about a hundred characters
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	for _, name := range []string{"XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"} {
		t.Setenv(name, "")
	}
	t.Setenv("XDG_RUNTIME_DIR", dir)
	// Discord is sometimes on a later number than 0; the bridge has to try them in turn.
	listener, err := net.Listen("unix", filepath.Join(dir, "discord-ipc-1"))
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	fake := &fakeDiscord{}
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go fake.serve(conn)
		}
	}()

	r := newRig(t)
	r.b.now = time.Now
	r.b.dial = dialDiscord
	base := r.listen()
	sequence := []string{
		`{"v":1,"mode":"loading"}`,
		`{"v":1,"mode":"loading"}`, // a heartbeat: nothing new to send
	}
	for _, body := range sequence {
		if res, text := do(t, post(base, gameOrigin, body)); res.StatusCode != 200 {
			t.Fatalf("post: %d %s", res.StatusCode, text)
		}
	}
	do(t, request{method: "DELETE", url: base + "/v1/presence", origin: gameOrigin})

	got := fake.seen()
	if len(got) != 2 || details(t, got[0]) != `LOAD "SLEAZEBURG",8,1` || got[1] != "null" {
		t.Fatalf("the fake Discord recorded %v", got)
	}
	if fake.handshakes != 1 {
		t.Errorf("handshakes: %d", fake.handshakes)
	}
}

func TestNoDiscordIsAnErrorNotAHang(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"TMPDIR", "TMP", "TEMP"} {
		t.Setenv(name, "")
	}
	t.Setenv("XDG_RUNTIME_DIR", dir)
	if _, err := dialDiscord(); err == nil {
		t.Error("found a Discord that is not there")
	}
}
