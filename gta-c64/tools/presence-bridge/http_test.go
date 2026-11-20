// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

const gameOrigin = "https://mselin.github.io"

// listen starts the HTTP side of a rig on a free loopback port and returns its base URL.
func (r *rig) listen() string {
	return r.listenWith(defaultOrigins)
}

// listenWith is listen, allowing the given origins.
func (r *rig) listenWith(origins []string) string {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		r.t.Fatal(err)
	}
	port := l.Addr().(*net.TCPAddr).Port
	srv := newHTTPServer(&server{bridge: r.b, port: port, origins: origins})
	go srv.Serve(l)
	r.t.Cleanup(func() { srv.Close() })
	return fmt.Sprintf("http://127.0.0.1:%d", port)
}

type request struct {
	method, url, origin, body, contentType, host string
}

func do(t *testing.T, q request) (*http.Response, string) {
	t.Helper()
	req, err := http.NewRequest(q.method, q.url, strings.NewReader(q.body))
	if err != nil {
		t.Fatal(err)
	}
	if q.origin != "" {
		req.Header.Set("Origin", q.origin)
	}
	if q.contentType != "" {
		req.Header.Set("Content-Type", q.contentType)
	}
	if q.host != "" {
		req.Host = q.host
	}
	res, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	return res, string(body)
}

func post(base, origin, body string) request {
	return request{method: "POST", url: base + "/v1/presence", origin: origin, body: body, contentType: "application/json"}
}

func TestTheGameCanPostAStateAndStopIt(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	res, body := do(t, post(base, gameOrigin, `{"v":1,"mode":"chase","district":"hoa_heights","transport":"on_foot","heat":2}`))
	if res.StatusCode != 200 || res.Header.Get("Access-Control-Allow-Origin") != gameOrigin {
		t.Fatalf("status %d, CORS %q: %s", res.StatusCode, res.Header.Get("Access-Control-Allow-Origin"), body)
	}
	var status map[string]any
	json.Unmarshal([]byte(body), &status)
	if status["showing"] != true || status["discord_connected"] != true || status["app_id_configured"] != true {
		t.Errorf("status after a post: %s", body)
	}
	got := r.discord.seen()
	if len(got) != 1 || details(t, got[0]) != "Running from the law in HOA Heights" {
		t.Fatalf("Discord saw %v", got)
	}

	res, _ = do(t, request{method: "DELETE", url: base + "/v1/presence", origin: gameOrigin})
	if got = r.discord.seen(); res.StatusCode != 200 || len(got) != 2 || got[1] != "null" {
		t.Fatalf("DELETE: status %d, Discord saw %v", res.StatusCode, got)
	}
}

func TestOtherWebsitesAreRefused(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	good := `{"v":1,"mode":"menu"}`
	for name, q := range map[string]request{
		"a foreign origin":           post(base, "https://evil.example", good),
		"a look-alike origin":        post(base, "https://mselin.github.io.evil.example", good),
		"the same site over http":    post(base, "http://mselin.github.io", good),
		"the string null":            post(base, "null", good),
		"no origin at all":           post(base, "", good),
		"a foreign origin, deleting": {method: "DELETE", url: base + "/v1/presence", origin: "https://evil.example"},
		"a foreign origin, asking":   {method: "GET", url: base + "/v1/status", origin: "https://evil.example"},
		"a foreign preflight":        {method: "OPTIONS", url: base + "/v1/presence", origin: "https://evil.example"},
		"a hostname aimed at us":     {method: "POST", url: base + "/v1/presence", origin: gameOrigin, body: good, contentType: "application/json", host: "evil.example"},
	} {
		res, _ := do(t, q)
		if res.StatusCode != 403 {
			t.Errorf("%s: status %d, want 403", name, res.StatusCode)
		}
		if h := res.Header.Get("Access-Control-Allow-Origin"); h != "" {
			t.Errorf("%s: a refusal must carry no CORS header, got %q", name, h)
		}
	}
	if len(r.discord.seen()) != 0 || r.discord.handshakes != 0 {
		t.Error("a refused request reached Discord")
	}
}

func TestBadBodiesAreRejectedBeforeDiscord(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	for name, want := range map[string]struct {
		q      request
		status int
	}{
		"an unknown mode":     {post(base, gameOrigin, `{"v":1,"mode":"dancing"}`), 400},
		"an unknown district": {post(base, gameOrigin, `{"v":1,"mode":"chase","district":"downtown"}`), 400},
		"free text":           {post(base, gameOrigin, `{"v":1,"mode":"menu","details":"buy my mixtape"}`), 400},
		"an old schema":       {post(base, gameOrigin, `{"v":0,"mode":"menu"}`), 400},
		"not JSON":            {post(base, gameOrigin, `mode=menu`), 400},
		"an oversized body":   {post(base, gameOrigin, `{"v":1,"mode":"menu","district":"`+strings.Repeat("x", 2000)+`"}`), 413},
		"a form post":         {request{method: "POST", url: base + "/v1/presence", origin: gameOrigin, body: `{"v":1,"mode":"menu"}`, contentType: "text/plain"}, 415},
		"an unknown path":     {request{method: "POST", url: base + "/v1/run", origin: gameOrigin, body: `{}`, contentType: "application/json"}, 404},
	} {
		if res, _ := do(t, want.q); res.StatusCode != want.status {
			t.Errorf("%s: status %d, want %d", name, res.StatusCode, want.status)
		}
	}
	if len(r.discord.seen()) != 0 || r.discord.handshakes != 0 {
		t.Error("a rejected body reached Discord")
	}
}

func TestPreflightAndStatus(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	res, _ := do(t, request{method: "OPTIONS", url: base + "/v1/presence", origin: gameOrigin})
	h := res.Header
	if res.StatusCode != 204 || h.Get("Access-Control-Allow-Origin") != gameOrigin ||
		!strings.Contains(h.Get("Access-Control-Allow-Methods"), "DELETE") || h.Get("Access-Control-Allow-Headers") != "Content-Type" {
		t.Errorf("preflight: %d %v", res.StatusCode, h)
	}
	// The deprecated Private Network Access headers are deliberately not sent.
	if h.Get("Access-Control-Allow-Private-Network") != "" {
		t.Error("unexpected Private Network Access header")
	}
	// The game, and a development copy allowed with -allow-origin, may read it; so may curl, with no Origin.
	dev := r.listenWith([]string{gameOrigin, "http://localhost:8064"})
	for _, q := range []request{
		{method: "GET", url: base + "/v1/status", origin: gameOrigin},
		{method: "GET", url: dev + "/v1/status", origin: "http://localhost:8064"},
		{method: "GET", url: base + "/v1/status"},
	} {
		origin := q.origin
		res, body := do(t, q)
		if res.StatusCode != 200 || !strings.Contains(body, `"name":"sleazeburg-presence"`) || !strings.Contains(body, `"showing":false`) {
			t.Errorf("status for origin %q: %d %s", origin, res.StatusCode, body)
		}
	}
	// localhost is the same machine by another name.
	port := strings.TrimPrefix(base, "http://127.0.0.1:")
	if res, _ := do(t, request{method: "GET", url: base + "/v1/status", host: "localhost:" + port}); res.StatusCode != 200 {
		t.Errorf("Host localhost: status %d", res.StatusCode)
	}
}

func TestTheHelperWindowIsServedLockedDown(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	// A browser opening the window sends no Origin, for the page or for its script and style.
	res, body := do(t, request{method: "GET", url: base + "/relay"})
	if res.StatusCode != 200 || !strings.HasPrefix(res.Header.Get("Content-Type"), "text/html") {
		t.Fatalf("GET /relay: %d %s", res.StatusCode, res.Header.Get("Content-Type"))
	}
	for name, want := range map[string]string{
		"Content-Security-Policy": relayPolicy,
		"X-Frame-Options":         "DENY",
		"X-Content-Type-Options":  "nosniff",
		"Referrer-Policy":         "no-referrer",
		"Cache-Control":           "no-store",
	} {
		if got := res.Header.Get(name); got != want {
			t.Errorf("%s: %q, want %q", name, got, want)
		}
	}
	for _, part := range []string{"frame-ancestors 'none'", "script-src 'self'", "connect-src 'self'", "default-src 'none'"} {
		if !strings.Contains(relayPolicy, part) {
			t.Errorf("the policy lacks %s", part)
		}
	}
	if res.Header.Get("Cross-Origin-Opener-Policy") != "" {
		t.Error("an opener policy would cut the window off from the game")
	}
	if res.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Error("the window's page is not for other pages to read")
	}
	if !strings.Contains(body, `data-origins="https://mselin.github.io"`) {
		t.Errorf("the page does not list the game's addresses:\n%s", body)
	}
	if !strings.Contains(body, `src="relay.js"`) || !strings.Contains(body, `href="relay.css"`) {
		t.Errorf("the page does not load its script and style:\n%s", body)
	}

	for path, kind := range map[string]string{"/relay.js": "text/javascript", "/relay.css": "text/css"} {
		res, body := do(t, request{method: "GET", url: base + path})
		if res.StatusCode != 200 || !strings.HasPrefix(res.Header.Get("Content-Type"), kind) || len(body) < 100 {
			t.Errorf("GET %s: %d %s, %d bytes", path, res.StatusCode, res.Header.Get("Content-Type"), len(body))
		}
		if res.Header.Get("Content-Security-Policy") != relayPolicy {
			t.Errorf("%s has no policy", path)
		}
	}
	// Nothing else is served without an Origin, the template behind the page included.
	for _, path := range []string{"/relay.html", "/relay/relay.js", "/v1/presence", "/"} {
		if res, _ := do(t, request{method: "GET", url: base + path}); res.StatusCode != 403 {
			t.Errorf("GET %s without an Origin: %d", path, res.StatusCode)
		}
	}
	// Nor from a hostname that is not this computer's (DNS rebinding).
	if res, _ := do(t, request{method: "GET", url: base + "/relay", host: "evil.example:26464"}); res.StatusCode != 403 {
		t.Errorf("GET /relay through another hostname: %d", res.StatusCode)
	}
	// Nor for another website to read.
	if res, _ := do(t, request{method: "GET", url: base + "/relay", origin: "https://evil.example"}); res.StatusCode != 403 {
		t.Errorf("GET /relay from another website: %d", res.StatusCode)
	}
}

func TestTheHelperWindowCanUseTheBridgeAndNothingElseCanPretendTo(t *testing.T) {
	r := newRig(t)
	base := r.listen()
	self := strings.Replace(base, "127.0.0.1", "localhost", 1)
	for _, origin := range []string{base, self} {
		res, body := do(t, post(base, origin, `{"v":1,"mode":"menu"}`))
		if res.StatusCode != 200 {
			t.Fatalf("POST from the window at %s: %d %s", origin, res.StatusCode, body)
		}
	}
	if got := r.discord.seen(); len(got) != 1 {
		t.Fatalf("Discord saw %v", got)
	}
	// Another program on another port of this computer is not the bridge's own page.
	other := "http://127.0.0.1:1"
	if res, _ := do(t, post(base, other, `{"v":1,"mode":"menu"}`)); res.StatusCode != 403 {
		t.Errorf("POST from %s: %d", other, res.StatusCode)
	}
}

func TestTheHelperWindowListsOriginsSafely(t *testing.T) {
	r := newRig(t)
	base := r.listenWith([]string{`https://x.example"><script>alert(1)</script>`})
	_, body := do(t, request{method: "GET", url: base + "/relay"})
	if strings.Contains(body, "<script>alert") {
		t.Fatalf("an origin was written into the page unescaped:\n%s", body)
	}
}
