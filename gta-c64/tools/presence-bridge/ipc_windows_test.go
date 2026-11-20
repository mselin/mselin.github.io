// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"fmt"
	"os"
	"syscall"
	"testing"
	"time"
	"unsafe"
)

// A named pipe served by the fake Discord, to check that the way the bridge opens Discord's pipe on
// Windows really carries the protocol. Only the standard library's syscall package is used.
func TestOverARealNamedPipe(t *testing.T) {
	const (
		pipeAccessDuplex = 0x3
		invalidHandle    = ^uintptr(0)
	)
	name := fmt.Sprintf(`\\.\pipe\sleazeburg-presence-test-%d`, os.Getpid())
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	namePtr, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		t.Fatal(err)
	}
	// Byte mode, blocking, one instance, 4 KB buffers.
	handle, _, callErr := kernel32.NewProc("CreateNamedPipeW").Call(
		uintptr(unsafe.Pointer(namePtr)), pipeAccessDuplex, 0, 1, 4096, 4096, 0, 0)
	if handle == invalidHandle {
		t.Fatalf("CreateNamedPipe: %v", callErr)
	}
	fake := &fakeDiscord{}
	go func() {
		// Returns when a client connects (or reports that one already has, which is as good).
		kernel32.NewProc("ConnectNamedPipe").Call(handle, 0)
		fake.serve(os.NewFile(handle, name))
	}()

	rw, err := dialIPC(name)
	if err != nil {
		t.Fatalf("opening the pipe: %v", err)
	}
	conn := &discordConn{rw}
	defer rw.Close()
	if err := conn.handshake("123456789012345678"); err != nil {
		t.Fatalf("handshake: %v", err)
	}
	if err := conn.ping(); err != nil {
		t.Fatalf("ping: %v", err)
	}
	a := Activity{Details: "READY.", State: "On the title screen", LargeImage: "logo", LargeText: "Sleazeburg 64"}
	if err := conn.setActivity(&a, time.Unix(1_800_000_000, 0), "1"); err != nil {
		t.Fatalf("set activity: %v", err)
	}
	if err := conn.setActivity(nil, time.Time{}, "2"); err != nil {
		t.Fatalf("clear: %v", err)
	}
	got := fake.seen()
	if len(got) != 2 || details(t, got[0]) != "READY." || got[1] != "null" {
		t.Fatalf("the fake Discord recorded %v", got)
	}
}

func TestNoDiscordIsAnErrorNotAHang(t *testing.T) {
	if _, err := dialIPC(`\\.\pipe\sleazeburg-presence-test-nobody-home`); err == nil {
		t.Error("opened a pipe that does not exist")
	}
}
