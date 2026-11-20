// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

func TestEveryStateRendersToLinesDiscordAccepts(t *testing.T) {
	s := loadSchema()
	districts := []string{""}
	for id := range s.Districts {
		districts = append(districts, id)
	}
	for _, mode := range s.Modes {
		for _, transport := range append([]string{""}, s.Transports...) {
			for _, district := range districts {
				for h := s.Heat.Min; h <= s.Heat.Max; h++ {
					st := State{V: 1, Mode: mode, Transport: transport, District: district, Heat: heat(h)}
					for pick := 0; pick < 6; pick++ {
						a := s.Render(st, pick)
						for _, line := range []string{a.Details, a.State} {
							if n := len([]rune(line)); n < 2 || n > 128 || strings.Contains(line, "{") {
								t.Fatalf("%+v pick %d gives %q", st, pick, line)
							}
						}
					}
				}
			}
		}
	}
}

func TestSchemaTablesAreComplete(t *testing.T) {
	s := loadSchema()
	if len(s.State.Heat) != s.Heat.Max+1 || len(s.Assets.SmallImage) != s.Heat.Max+1 {
		t.Error("one heat line and one small image key are needed for each heat level")
	}
	for mode := range s.Details {
		if !contains(s.Modes, mode) {
			t.Errorf("details for %q, which is not a mode", mode)
		}
	}
	for mode := range s.State.Fixed {
		if !contains(s.Modes, mode) {
			t.Errorf("fixed state line for %q, which is not a mode", mode)
		}
	}
}

func TestEveryModeHasALineThatNeedsNeitherTransportNorDistrict(t *testing.T) {
	s := loadSchema()
	for _, mode := range s.Modes {
		found := false
		for _, line := range s.Details[mode]["*"] {
			if !strings.Contains(line, "{district}") {
				found = true
			}
		}
		if !found {
			t.Errorf("mode %q needs a general line without {district}", mode)
		}
	}
}

func TestParseStateRejectsWhatItDoesNotKnow(t *testing.T) {
	s := loadSchema()
	good := `{"v":1,"mode":"chase","district":"gentrifia","transport":"car","heat":3}`
	if st, err := s.ParseState([]byte(good)); err != nil || st.Mode != "chase" || *st.Heat != 3 {
		t.Fatalf("a valid state was refused: %v", err)
	}
	if _, err := s.ParseState([]byte(`{"v":1,"mode":"menu"}`)); err != nil {
		t.Errorf("only v and mode are required: %v", err)
	}
	for _, bad := range []string{
		`{"v":1,"mode":"dancing"}`,
		`{"v":2,"mode":"menu"}`,
		`{"mode":"menu"}`,
		`{"v":1,"mode":"chase","district":"downtown"}`,
		`{"v":1,"mode":"chase","transport":"helicopter"}`,
		`{"v":1,"mode":"chase","heat":6}`,
		`{"v":1,"mode":"chase","heat":-1}`,
		`{"v":1,"mode":"menu","details":"buy my mixtape"}`,
		`{"v":1,"mode":"menu","district":"<b>"}`,
		`{"v":1,"mode":"menu"}{"v":1,"mode":"menu"}`,
		`[]`,
		`not json`,
	} {
		if _, err := s.ParseState([]byte(bad)); err == nil {
			t.Errorf("accepted %s", bad)
		}
	}
}

func TestIPCCandidatesForEachSystem(t *testing.T) {
	env := func(vars map[string]string) func(string) string {
		return func(name string) string { return vars[name] }
	}
	win := ipcCandidates("windows", env(nil))
	if len(win) != 10 || win[0] != `\\.\pipe\discord-ipc-0` || win[9] != `\\.\pipe\discord-ipc-9` {
		t.Errorf("windows: %v", win)
	}
	slash := func(list []string) []string {
		out := make([]string, len(list))
		for i, p := range list {
			out[i] = strings.ReplaceAll(p, `\`, "/")
		}
		return out
	}
	linux := slash(ipcCandidates("linux", env(map[string]string{"XDG_RUNTIME_DIR": "/run/user/1000", "TMPDIR": "/elsewhere"})))
	want := []string{"/run/user/1000/discord-ipc-0", "/run/user/1000/discord-ipc-1"}
	if !reflect.DeepEqual(linux[:2], want) {
		t.Errorf("linux should prefer XDG_RUNTIME_DIR: %v", linux[:2])
	}
	for _, sub := range []string{"app/com.discordapp.Discord", "snap.discord"} {
		if !contains(linux, fmt.Sprintf("/run/user/1000/%s/discord-ipc-0", sub)) {
			t.Errorf("linux should also look in %s", sub)
		}
	}
	if mac := slash(ipcCandidates("darwin", env(map[string]string{"TMPDIR": "/var/folders/xy/T"}))); mac[0] != "/var/folders/xy/T/discord-ipc-0" {
		t.Errorf("macOS should use TMPDIR: %s", mac[0])
	}
	if bare := slash(ipcCandidates("linux", env(nil))); bare[0] != "/tmp/discord-ipc-0" {
		t.Errorf("with nothing set it should fall back to /tmp: %s", bare[0])
	}
}
