// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// Discord's local IPC: frames of a little-endian opcode, a little-endian length and a JSON body, over a
// Unix socket (Linux, macOS) or a named pipe (Windows).
const (
	opHandshake = 0
	opFrame     = 1
	opClose     = 2
	opPing      = 3
	opPong      = 4
)

const ipcTimeout = 5 * time.Second

// ipcCandidates lists where Discord's IPC endpoint may be, most likely first. It is a pure function of
// the system name and the environment so that every system's rules can be tested on any of them.
func ipcCandidates(goos string, getenv func(string) string) []string {
	var out []string
	if goos == "windows" {
		for n := 0; n < 10; n++ {
			out = append(out, fmt.Sprintf(`\\.\pipe\discord-ipc-%d`, n))
		}
		return out
	}
	base := "/tmp"
	for _, name := range []string{"XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"} {
		if v := getenv(name); v != "" {
			base = v
			break
		}
	}
	// Flatpak and Snap builds of Discord keep the socket in a subdirectory.
	for _, sub := range []string{"", "app/com.discordapp.Discord", "snap.discord", "app/com.discordapp.DiscordCanary"} {
		for n := 0; n < 10; n++ {
			out = append(out, filepath.Join(base, sub, fmt.Sprintf("discord-ipc-%d", n)))
		}
	}
	return out
}

// dialDiscord opens the first endpoint that answers.
func dialDiscord() (io.ReadWriteCloser, error) {
	for _, path := range ipcCandidates(goos, os.Getenv) {
		if conn, err := dialIPC(path); err == nil {
			return conn, nil
		}
	}
	return nil, errors.New("Discord is not running, or its IPC endpoint was not found")
}

type discordConn struct{ rw io.ReadWriteCloser }

// call sends one frame and reads the reply. Discord answers every frame, so the exchange is kept strictly
// one at a time; that also suits Windows, where reads and writes on one pipe handle cannot overlap.
// If nothing comes back in time the connection is closed, which unblocks the exchange.
func (c *discordConn) call(op uint32, payload []byte) (uint32, []byte, error) {
	type reply struct {
		op   uint32
		body []byte
		err  error
	}
	done := make(chan reply, 1)
	go func() {
		head := make([]byte, 8)
		binary.LittleEndian.PutUint32(head, op)
		binary.LittleEndian.PutUint32(head[4:], uint32(len(payload)))
		if _, err := c.rw.Write(append(head, payload...)); err != nil {
			done <- reply{err: err}
			return
		}
		if _, err := io.ReadFull(c.rw, head); err != nil {
			done <- reply{err: err}
			return
		}
		n := binary.LittleEndian.Uint32(head[4:])
		if n > 1<<20 {
			done <- reply{err: errors.New("oversized reply")}
			return
		}
		body := make([]byte, n)
		_, err := io.ReadFull(c.rw, body)
		done <- reply{binary.LittleEndian.Uint32(head), body, err}
	}()
	select {
	case r := <-done:
		return r.op, r.body, r.err
	case <-time.After(ipcTimeout):
		c.rw.Close()
		return 0, nil, errors.New("Discord did not answer")
	}
}

func (c *discordConn) handshake(appID string) error {
	body, _ := json.Marshal(map[string]any{"v": 1, "client_id": appID})
	op, reply, err := c.call(opHandshake, body)
	if err != nil {
		return err
	}
	if op != opFrame {
		return fmt.Errorf("Discord refused the application id: %s", brief(reply))
	}
	return nil
}

// setActivity shows an activity, or clears it when a is nil.
func (c *discordConn) setActivity(a *Activity, start time.Time, nonce string) error {
	var activity any
	if a != nil {
		assets := map[string]string{"large_image": a.LargeImage, "large_text": a.LargeText}
		if a.SmallImage != "" {
			assets["small_image"], assets["small_text"] = a.SmallImage, a.SmallText
		}
		activity = map[string]any{
			"details":    a.Details,
			"state":      a.State,
			"assets":     assets,
			"timestamps": map[string]int64{"start": start.Unix()},
		}
	}
	body, _ := json.Marshal(map[string]any{
		"cmd":   "SET_ACTIVITY",
		"nonce": nonce,
		"args":  map[string]any{"pid": os.Getpid(), "activity": activity},
	})
	op, reply, err := c.call(opFrame, body)
	if err != nil {
		return err
	}
	var r struct {
		Evt string `json:"evt"`
	}
	if op != opFrame || json.Unmarshal(reply, &r) != nil || r.Evt == "ERROR" {
		return fmt.Errorf("Discord rejected the activity: %s", brief(reply))
	}
	return nil
}

// brief quotes the start of what came back from the other end, for the log. Whatever is on the other end of
// the socket or pipe may not be Discord, so its words are kept short and their control characters escaped.
func brief(reply []byte) string {
	const most = 200
	if len(reply) > most {
		return strconv.Quote(string(reply[:most])) + "..."
	}
	return strconv.Quote(string(reply))
}

func (c *discordConn) ping() error {
	op, _, err := c.call(opPing, []byte(`{}`))
	if err == nil && op != opPong {
		err = errors.New("unexpected reply to ping")
	}
	return err
}
