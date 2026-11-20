// SPDX-License-Identifier: GPL-2.0-or-later

//go:build !windows

package main

import (
	"fmt"
	"io"
	"net"
	"os"
	"runtime"
	"syscall"
)

const goos = runtime.GOOS

// dialIPC connects to Discord's socket, but only to one that belongs to the user running the bridge. Where no
// per-user directory is known the bridge looks in the shared /tmp, and another user could have put a socket
// there for it to find.
func dialIPC(path string) (io.ReadWriteCloser, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !ownSocket(info, os.Getuid()) {
		return nil, fmt.Errorf("%s is not a socket of this user's", path)
	}
	return net.DialTimeout("unix", path, ipcTimeout)
}

func ownSocket(info os.FileInfo, uid int) bool {
	st, ok := info.Sys().(*syscall.Stat_t)
	return ok && info.Mode()&os.ModeSocket != 0 && int(st.Uid) == uid
}

// privateDir reports whether path is a real directory (not a symlink) of this user's that no one else may
// write in, so that a file written there cannot be swapped for a link to somewhere else.
func privateDir(path string) bool {
	info, err := os.Lstat(path)
	if err != nil || !info.IsDir() {
		return false
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	return ok && int(st.Uid) == os.Getuid() && info.Mode().Perm()&0o022 == 0
}
