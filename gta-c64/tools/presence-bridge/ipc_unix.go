// SPDX-License-Identifier: GPL-2.0-or-later

//go:build !windows

package main

import (
	"io"
	"net"
	"runtime"
)

const goos = runtime.GOOS

func dialIPC(path string) (io.ReadWriteCloser, error) {
	return net.DialTimeout("unix", path, ipcTimeout)
}
