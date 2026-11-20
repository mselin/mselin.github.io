// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"fmt"
	"os"
	"runtime"
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

// Whoever serves a pipe called discord-ipc-0 may not be Discord. Check what such a server can do with the bridge's
// connection: it may learn who connected (identification), but must not be able to act as them (impersonation).
func TestThePipesServerCannotActAsTheBridgesUser(t *testing.T) {
	const securityIdentification = 1
	name := fmt.Sprintf(`\\.\pipe\sleazeburg-presence-sqos-%d`, os.Getpid())
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	advapi32 := syscall.NewLazyDLL("advapi32.dll")
	namePtr, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		t.Fatal(err)
	}
	handle, _, callErr := kernel32.NewProc("CreateNamedPipeW").Call(
		uintptr(unsafe.Pointer(namePtr)), 0x3, 0, 1, 4096, 4096, 0, 0)
	if handle == ^uintptr(0) {
		t.Fatalf("CreateNamedPipe: %v", callErr)
	}
	defer syscall.CloseHandle(syscall.Handle(handle))

	type outcome struct {
		level uint32
		err   string
	}
	result := make(chan outcome, 1)
	go func() {
		// Impersonation applies to one OS thread.
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		kernel32.NewProc("ConnectNamedPipe").Call(handle, 0)
		var buf [1]byte
		var n uint32
		// A server can only impersonate a client it has read from.
		if err := syscall.ReadFile(syscall.Handle(handle), buf[:], &n, nil); err != nil {
			result <- outcome{err: "read: " + err.Error()}
			return
		}
		if ok, _, e := advapi32.NewProc("ImpersonateNamedPipeClient").Call(handle); ok == 0 {
			result <- outcome{err: "ImpersonateNamedPipeClient: " + e.Error()}
			return
		}
		defer advapi32.NewProc("RevertToSelf").Call()
		thread, _, _ := kernel32.NewProc("GetCurrentThread").Call()
		var token syscall.Token
		if ok, _, e := advapi32.NewProc("OpenThreadToken").Call(
			thread, syscall.TOKEN_QUERY, 1, uintptr(unsafe.Pointer(&token))); ok == 0 {
			result <- outcome{err: "OpenThreadToken: " + e.Error()}
			return
		}
		defer token.Close()
		var level, size uint32
		if err := syscall.GetTokenInformation(token, syscall.TokenImpersonationLevel,
			(*byte)(unsafe.Pointer(&level)), 4, &size); err != nil {
			result <- outcome{err: "GetTokenInformation: " + err.Error()}
			return
		}
		result <- outcome{level: level}
	}()

	rw, err := dialIPC(name)
	if err != nil {
		t.Fatalf("opening the pipe: %v", err)
	}
	defer rw.Close()
	if _, err := rw.Write([]byte{0}); err != nil {
		t.Fatal(err)
	}
	select {
	case r := <-result:
		if r.err != "" {
			t.Fatal(r.err)
		}
		if r.level != securityIdentification {
			t.Fatalf("the pipe's server got impersonation level %d; want %d (identification only)",
				r.level, securityIdentification)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the pipe's server did not finish")
	}
}
