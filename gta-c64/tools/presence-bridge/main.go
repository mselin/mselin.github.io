// SPDX-License-Identifier: GPL-2.0-or-later

// sleazeburg-presence shows what you are doing in Sleazeburg 64 on your Discord profile.
//
// It does two things and nothing else: it listens on 127.0.0.1 for the game's page to say what is
// happening, and it passes that on to the Discord client running on the same computer. It makes no other
// network connection, does not update itself, and writes no file except a small claim file in a directory
// that another presence program on the machine must already have created.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/debug"
	"strings"
	"syscall"
	"time"
)

// version is set when a release is built.
var version = "dev"

// defaultAppID is the Discord application the presence appears under. It is public: every copy of the
// bridge uses the same one. While it is empty the bridge runs but shows nothing.
const defaultAppID = "1573107526919266335"

const defaultPort = 26464

func main() {
	port := flag.Int("port", defaultPort, "port to listen on, on 127.0.0.1 only")
	appID := flag.String("app-id", envOr("SLEAZEBURG_APP_ID", defaultAppID), "Discord application id")
	extra := flag.String("allow-origin", "", "extra origins allowed to use the bridge, comma separated (for development)")
	showVersion := flag.Bool("version", false, "print the version and exit")
	flag.Parse()
	if version == "dev" {
		// Installed with go install: the module version is the release.
		if info, ok := debug.ReadBuildInfo(); ok && strings.HasPrefix(info.Main.Version, "v") {
			version = strings.TrimPrefix(info.Main.Version, "v")
		}
	}
	if *showVersion {
		fmt.Println("sleazeburg-presence", version)
		return
	}
	log.SetFlags(0) // the service manager adds its own timestamps

	b := &Bridge{
		schema: loadSchema(),
		appID:  *appID,
		now:    time.Now,
		random: rand.Int,
		dial:   dialDiscord,
		logf:   log.Printf,
	}
	if dir := os.Getenv("XDG_RUNTIME_DIR"); dir != "" && goos == "linux" {
		b.claimDir = filepath.Join(dir, "discord-rpc")
	}
	origins := defaultOrigins
	for _, o := range strings.Split(*extra, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		log.Fatalf("cannot listen on 127.0.0.1:%d: %v\n"+
			"If the port is in use, another copy of the bridge may already be running, for example as a "+
			"service. If it is not, another program has the port, and the game would be talking to it: "+
			"find out which before you use the game's Discord setting.", *port, err)
	}
	srv := newHTTPServer(&server{bridge: b, port: *port, origins: origins})
	go srv.Serve(listener)
	log.Printf("sleazeburg-presence %s listening on 127.0.0.1:%d", version, *port)
	if *appID == "" {
		log.Printf("no Discord application id is configured, so nothing will be shown")
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	tick := time.NewTicker(time.Second)
	for {
		select {
		case <-tick.C:
			b.Tick()
		case <-stop:
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			srv.Shutdown(ctx)
			cancel()
			b.Close()
			return
		}
	}
}

// newHTTPServer limits how long a connection may take and stay: without limits, a program on this computer
// could hold connections open until the bridge has none left for the game.
func newHTTPServer(h http.Handler) *http.Server {
	return &http.Server{
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
}

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
