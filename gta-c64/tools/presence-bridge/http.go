// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"strings"
)

// The game's own address, plus where the game is served during development (npm start).
var defaultOrigins = []string{"https://mselin.github.io", "http://localhost:8064", "http://127.0.0.1:8064"}

// The helper window, for browsers that will not let the game's https page reach http://127.0.0.1 (Safari).
// The game opens it at /relay and talks to it with postMessage; it passes the game's requests on from here.
//
//go:embed relay
var relayFiles embed.FS

var relayPage = template.Must(template.ParseFS(relayFiles, "relay/relay.html"))

// relayAssets are the helper window's other files, by path, with their types.
var relayAssets = map[string]string{
	"/relay.js":  "text/javascript; charset=utf-8",
	"/relay.css": "text/css; charset=utf-8",
}

// The helper window may load its own script and style and talk to the bridge, and nothing else. No page may
// frame it. (It must not set Cross-Origin-Opener-Policy: that would cut it off from the game that opened it.)
const relayPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; " +
	"base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

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
	// The bridge's own pages (the helper window) may use it too: only the bridge can serve a page there.
	self := origin == fmt.Sprintf("http://127.0.0.1:%d", s.port) || origin == fmt.Sprintf("http://localhost:%d", s.port)
	if origin != "" && !self && !contains(s.origins, origin) {
		// No CORS headers on a refusal, so the page that asked learns nothing.
		http.Error(w, "this origin may not use the bridge", http.StatusForbidden)
		return
	}
	// Only the status, read by curl, and the helper window's files, which a browser fetches without an Origin
	// when it opens the window, may be had without one.
	if origin == "" && !(r.Method == http.MethodGet && (r.URL.Path == "/v1/status" || isRelayFile(r.URL.Path))) {
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
	case r.Method == http.MethodGet && r.URL.Path == "/relay":
		relayHeaders(w, "text/html; charset=utf-8")
		relayPage.Execute(w, struct{ Origins string }{strings.Join(s.origins, " ")})
	case r.Method == http.MethodGet && relayAssets[r.URL.Path] != "":
		body, _ := relayFiles.ReadFile("relay" + r.URL.Path)
		relayHeaders(w, relayAssets[r.URL.Path])
		w.Write(body)
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

func isRelayFile(path string) bool {
	return path == "/relay" || relayAssets[path] != ""
}

func relayHeaders(w http.ResponseWriter, contentType string) {
	h := w.Header()
	h.Set("Content-Type", contentType)
	h.Set("Content-Security-Policy", relayPolicy)
	h.Set("X-Frame-Options", "DENY")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Cache-Control", "no-store") // a newer bridge's window, not a remembered older one
}

func (s *server) reply(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.bridge.Status())
}
