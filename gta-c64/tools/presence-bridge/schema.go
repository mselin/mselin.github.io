// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

// The schema is the one file the game and the bridge share. The game reads it to know which values exist;
// the bridge embeds its own copy, so the text shown on a profile always comes from this program and never
// from a web page.
//
//go:embed schema.json
var schemaJSON []byte

// Schema lists the values a state may hold and the text each turns into.
type Schema struct {
	V          int                            `json:"v"`
	Modes      []string                       `json:"modes"`
	Districts  map[string]string              `json:"districts"`
	Transports []string                       `json:"transports"`
	Heat       struct{ Min, Max int }         `json:"heat"`
	Details    map[string]map[string][]string `json:"details"`
	State      struct {
		Heat  []string          `json:"heat"`
		Fixed map[string]string `json:"fixed"`
	} `json:"state"`
	Assets struct {
		LargeImage string   `json:"large_image"`
		LargeText  string   `json:"large_text"`
		SmallImage []string `json:"small_image"`
	} `json:"assets"`
}

// State is what the game sends: a handful of enumerated values and nothing else.
type State struct {
	V         int    `json:"v"`
	Mode      string `json:"mode"`
	District  string `json:"district,omitempty"`
	Transport string `json:"transport,omitempty"`
	Heat      *int   `json:"heat,omitempty"`
}

// Activity is the text and artwork shown on the profile.
type Activity struct {
	Details, State, LargeImage, LargeText, SmallImage, SmallText string
}

func loadSchema() *Schema {
	s := new(Schema)
	if err := json.Unmarshal(schemaJSON, s); err != nil {
		panic("schema.json: " + err.Error())
	}
	return s
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// ParseState decodes a request body. Unknown fields and unknown values are errors.
func (s *Schema) ParseState(body []byte) (State, error) {
	var st State
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&st); err != nil {
		return st, fmt.Errorf("not a valid state: %v", err)
	}
	if dec.More() {
		return st, fmt.Errorf("not a valid state: more than one value")
	}
	switch {
	case st.V != s.V:
		return st, fmt.Errorf("schema version %d, this bridge speaks %d", st.V, s.V)
	case !contains(s.Modes, st.Mode):
		return st, fmt.Errorf("unknown mode")
	case st.Transport != "" && !contains(s.Transports, st.Transport):
		return st, fmt.Errorf("unknown transport")
	case st.Heat != nil && (*st.Heat < s.Heat.Min || *st.Heat > s.Heat.Max):
		return st, fmt.Errorf("heat out of range")
	}
	if _, ok := s.Districts[st.District]; st.District != "" && !ok {
		return st, fmt.Errorf("unknown district")
	}
	return st, nil
}

// variants returns the candidate first lines for a state: those for its transport if the mode has any,
// otherwise the mode's general ones, leaving out lines that name a district when none was given.
func (s *Schema) variants(st State) []string {
	usable := func(list []string) []string {
		var out []string
		for _, line := range list {
			if st.District != "" || !strings.Contains(line, "{district}") {
				out = append(out, line)
			}
		}
		return out
	}
	byTransport := s.Details[st.Mode]
	if list := usable(byTransport[st.Transport]); len(list) > 0 {
		return list
	}
	return usable(byTransport["*"])
}

// Render turns a state into profile text. pick chooses among the variants; the caller keeps it steady
// for as long as the mode lasts.
func (s *Schema) Render(st State, pick int) Activity {
	a := Activity{LargeImage: s.Assets.LargeImage, LargeText: s.Assets.LargeText}
	if list := s.variants(st); len(list) > 0 {
		a.Details = strings.ReplaceAll(list[pick%len(list)], "{district}", s.Districts[st.District])
	}
	if fixed, ok := s.State.Fixed[st.Mode]; ok {
		a.State = fixed
		return a
	}
	heat := 0
	if st.Heat != nil {
		heat = *st.Heat
	}
	a.State = s.State.Heat[heat]
	if img := s.Assets.SmallImage[heat]; img != "" {
		a.SmallImage, a.SmallText = img, a.State
	}
	return a
}
