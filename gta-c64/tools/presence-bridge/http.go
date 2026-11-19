// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// The game's own address, plus where the game is served during development (npm start).
var defaultOrigins = []string{"https://mselin.github.io", "http://localhost:8064", "http://127.0.0.1:8064"}

type server struct {
	bridge  *Bridge
	port    int
	origins []string
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// A page elsewhere could point a hostname of its own at 127.0.0.1; insisting on the Host header stops that.
	if r.Host != fmt.Sprintf("127.0.0.1:%d", s.port) && r.Host != fmt.Sprintf("localhost:%d", s.port) {
		http.Error(w, "wrong host", http.StatusForbidden)
		return
	}
	origin := r.Header.Get("Origin")
	if origin != "" && !contains(s.origins, origin) {
		// No CORS headers on a refusal, so the page that asked learns nothing.
		http.Error(w, "this origin may not use the bridge", http.StatusForbidden)
		return
	}
	// Only a request with no Origin at all (curl, not a browser) may read the status without one.
	if origin == "" && !(r.Method == http.MethodGet && r.URL.Path == "/v1/status") {
		http.Error(w, "an Origin header is required", http.StatusForbidden)
		return
	}
	if origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	switch {
	case r.Method == http.MethodOptions:
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Max-Age", "600")
		w.WriteHeader(http.StatusNoContent)
	case r.Method == http.MethodGet && r.URL.Path == "/v1/status":
		s.reply(w)
	case r.Method == http.MethodPost && r.URL.Path == "/v1/presence":
		// Insisting on JSON means a browser must ask permission (a preflight) before it may send this.
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "send application/json", http.StatusUnsupportedMediaType)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1024))
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		st, err := s.bridge.schema.ParseState(body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		s.bridge.Update(st)
		s.reply(w)
	case r.Method == http.MethodDelete && r.URL.Path == "/v1/presence":
		s.bridge.Stop()
		s.reply(w)
	default:
		http.NotFound(w, r)
	}
}

func (s *server) reply(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.bridge.Status())
}
