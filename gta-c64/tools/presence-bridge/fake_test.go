// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeDiscord speaks enough of Discord's IPC to stand in for the client: it accepts the handshake,
// answers pings, and records every SET_ACTIVITY it is sent.
type fakeDiscord struct {
	mu         sync.Mutex
	activities []string // the activity of each SET_ACTIVITY as JSON, "null" for a clear
	handshakes int
	dials      int // every attempt to connect, answered or not
	down       bool
	conns      []io.Closer
}

func (f *fakeDiscord) serve(rw io.ReadWriteCloser) {
	defer rw.Close()
	send := func(op uint32, body []byte) error {
		head := make([]byte, 8)
		binary.LittleEndian.PutUint32(head, op)
		binary.LittleEndian.PutUint32(head[4:], uint32(len(body)))
		_, err := rw.Write(append(head, body...))
		return err
	}
	for {
		head := make([]byte, 8)
		if _, err := io.ReadFull(rw, head); err != nil {
			return
		}
		body := make([]byte, binary.LittleEndian.Uint32(head[4:]))
		if _, err := io.ReadFull(rw, body); err != nil {
			return
		}
		var err error
		switch binary.LittleEndian.Uint32(head) {
		case opHandshake:
			f.mu.Lock()
			f.handshakes++
			f.mu.Unlock()
			err = send(opFrame, []byte(`{"cmd":"DISPATCH","evt":"READY"}`))
		case opPing:
			err = send(opPong, body)
		case opFrame:
			var msg struct {
				Cmd  string `json:"cmd"`
				Args struct {
					Activity json.RawMessage `json:"activity"`
				} `json:"args"`
			}
			json.Unmarshal(body, &msg)
			f.mu.Lock()
			f.activities = append(f.activities, string(msg.Args.Activity))
			f.mu.Unlock()
			err = send(opFrame, []byte(`{"cmd":"SET_ACTIVITY","evt":null}`))
		}
		if err != nil {
			return
		}
	}
}

// dial is what the bridge calls in place of dialDiscord.
func (f *fakeDiscord) dial() (io.ReadWriteCloser, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.dials++
	if f.down {
		return nil, errors.New("fake Discord is not running")
	}
	client, srv := net.Pipe()
	f.conns = append(f.conns, srv)
	go f.serve(srv)
	return client, nil
}

// stop is Discord quitting: every connection drops and new ones are refused until start.
func (f *fakeDiscord) stop() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.down = true
	for _, c := range f.conns {
		c.Close()
	}
	f.conns = nil
}

func (f *fakeDiscord) start() {
	f.mu.Lock()
	f.down = false
	f.mu.Unlock()
}

func (f *fakeDiscord) seen() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.activities...)
}

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time { return c.t }

type rig struct {
	t       *testing.T
	b       *Bridge
	discord *fakeDiscord
	clock   *fakeClock
	logs    []string
}

func newRig(t *testing.T) *rig {
	r := &rig{t: t, discord: &fakeDiscord{}, clock: &fakeClock{time.Unix(1_800_000_000, 0)}}
	r.b = &Bridge{
		schema: loadSchema(),
		appID:  "123456789012345678",
		now:    r.clock.now,
		random: func() int { return 0 },
		dial:   r.discord.dial,
		logf:   func(format string, args ...any) { r.logs = append(r.logs, fmt.Sprintf(format, args...)) },
	}
	return r
}

// pass lets seconds go by, ticking the bridge once for each as the real program does.
func (r *rig) pass(seconds int) {
	for i := 0; i < seconds; i++ {
		r.clock.t = r.clock.t.Add(time.Second)
		r.b.Tick()
	}
}

func heat(n int) *int { return &n }

func state(mode, district, transport string, h int) State {
	return State{V: 1, Mode: mode, District: district, Transport: transport, Heat: heat(h)}
}

// details pulls the first line out of a recorded activity.
func details(t *testing.T, activity string) string {
	t.Helper()
	var a struct {
		Details string `json:"details"`
	}
	if err := json.Unmarshal([]byte(activity), &a); err != nil {
		t.Fatalf("not an activity: %s", activity)
	}
	return a.Details
}

func (r *rig) logged(fragment string) int {
	n := 0
	for _, l := range r.logs {
		if strings.Contains(l, fragment) {
			n++
		}
	}
	return n
}
