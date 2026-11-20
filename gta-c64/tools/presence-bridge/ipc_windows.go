// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"io"
	"os"
)

const goos = "windows"

// A named pipe can be opened like a file. That is all the bridge needs, so no extra module is used.
func dialIPC(path string) (io.ReadWriteCloser, error) {
	return os.OpenFile(path, os.O_RDWR, 0)
}
