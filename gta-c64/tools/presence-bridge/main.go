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
		log.Fatalf("cannot listen on 127.0.0.1:%d: %v", *port, err)
	}
	srv := &http.Server{Handler: &server{bridge: b, port: *port, origins: origins}, ReadHeaderTimeout: 5 * time.Second}
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

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
