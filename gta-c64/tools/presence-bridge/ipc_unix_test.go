// SPDX-License-Identifier: GPL-2.0-or-later

//go:build !windows

package main

import (
	"net"
	"os"
	"path/filepath"
	"syscall"
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

// fileInfo stands in for what Lstat returns, to check owners the tests cannot create.
type fileInfo struct {
	mode os.FileMode
	uid  uint32
}

func (f fileInfo) Name() string       { return "discord-ipc-0" }
func (f fileInfo) Size() int64        { return 0 }
func (f fileInfo) Mode() os.FileMode  { return f.mode }
func (f fileInfo) ModTime() time.Time { return time.Time{} }
func (f fileInfo) IsDir() bool        { return f.mode.IsDir() }
func (f fileInfo) Sys() any           { return &syscall.Stat_t{Uid: f.uid} }

func TestOnlyTheUsersOwnSocketIsUsed(t *testing.T) {
	me := uint32(os.Getuid())
	if !ownSocket(fileInfo{os.ModeSocket | 0o755, me}, int(me)) {
		t.Error("the user's own socket was refused")
	}
	if ownSocket(fileInfo{os.ModeSocket | 0o777, me + 1}, int(me)) {
		t.Error("another user's socket was accepted")
	}
	if ownSocket(fileInfo{0o644, me}, int(me)) {
		t.Error("a plain file was accepted as a socket")
	}

	// End to end: a file where the socket should be is not dialled.
	dir := t.TempDir()
	fake := filepath.Join(dir, "discord-ipc-0")
	if err := os.WriteFile(fake, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := dialIPC(fake); err == nil {
		t.Error("dialled something that is not a socket")
	}
	// Nor a link to a real socket, which could point anywhere.
	listener, err := net.Listen("unix", filepath.Join(dir, "real"))
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	link := filepath.Join(dir, "discord-ipc-1")
	if err := os.Symlink(filepath.Join(dir, "real"), link); err != nil {
		t.Fatal(err)
	}
	if _, err := dialIPC(link); err == nil {
		t.Error("followed a link to a socket")
	}
}

func TestTheClaimDirectoryMustBePrivate(t *testing.T) {
	dir := t.TempDir()
	if err := os.Chmod(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if !privateDir(dir) {
		t.Error("a private directory was refused")
	}
	if err := os.Chmod(dir, 0o777); err != nil {
		t.Fatal(err)
	}
	if privateDir(dir) {
		t.Error("a directory anyone can write in was accepted")
	}
	os.Chmod(dir, 0o700)
	link := filepath.Join(t.TempDir(), "link")
	if err := os.Symlink(dir, link); err != nil {
		t.Fatal(err)
	}
	if privateDir(link) {
		t.Error("a link to a directory was accepted")
	}
}
