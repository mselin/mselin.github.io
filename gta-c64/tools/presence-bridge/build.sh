#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Builds a release binary of the presence bridge exactly as the release workflow does, so that anyone can
# rebuild a release from its tag and get the same file, byte for byte.
#
#   ./build.sh <version> <goos> <goarch>        for example: ./build.sh 0.1.0 windows amd64
#
# Writes dist/sleazeburg-presence-<goos>-<goarch>, with .exe on Windows, and prints its SHA-256.
# Needs Go 1.22 or later and network access to the Go module proxy: the exact Go release named in go.mod is
# fetched and used, so the result does not depend on which Go happens to be installed.
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -ne 3 ] || ! [[ $1 =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "usage: $0 <version as N.N.N> <goos> <goarch>" >&2
  exit 2
fi
version=$1 goos=$2 goarch=$3
major=${BASH_REMATCH[1]} minor=${BASH_REMATCH[2]} patch=${BASH_REMATCH[3]}

export GOTOOLCHAIN="$(awk '$1 == "toolchain" { print $2 }' go.mod)"
export CGO_ENABLED=0 GOOS=$goos GOARCH=$goarch GOFLAGS=-mod=readonly

out=dist/sleazeburg-presence-$goos-$goarch
mkdir -p dist
rm -f resource_windows_*.syso
trap 'rm -f resource_windows_*.syso' EXIT

if [ "$goos" = windows ]; then
  out=$out.exe
  # Product name and version, shown in the file's properties and checked by code-signing services.
  # The tool runs only here, at build time; nothing of it is linked into the program.
  info=$(mktemp)
  cat >"$info" <<JSON
{
  "FixedFileInfo": {
    "FileVersion": { "Major": $major, "Minor": $minor, "Patch": $patch, "Build": 0 },
    "ProductVersion": { "Major": $major, "Minor": $minor, "Patch": $patch, "Build": 0 },
    "FileFlagsMask": "3f", "FileFlags": "00", "FileOS": "040004", "FileType": "01", "FileSubType": "00"
  },
  "StringFileInfo": {
    "ProductName": "Sleazeburg 64 presence bridge",
    "FileDescription": "Sleazeburg 64 presence bridge",
    "ProductVersion": "$version",
    "FileVersion": "$version",
    "InternalName": "sleazeburg-presence",
    "OriginalFilename": "sleazeburg-presence.exe",
    "CompanyName": "mselin",
    "LegalCopyright": "Copyright (C) 2026 mselin. GNU GPL version 2 or later."
  },
  "VarFileInfo": { "Translation": { "LangID": "0409", "CharsetID": "04B0" } }
}
JSON
  [ "$goarch" = amd64 ] || { echo "only windows/amd64 is set up" >&2; exit 2; }
  GOOS= GOARCH= go run github.com/josephspurrier/goversioninfo/cmd/goversioninfo@v1.7.0 \
    -64 -o resource_windows_amd64.syso "$info"
  rm -f "$info"
fi

go build -trimpath -buildvcs=false -ldflags="-s -w -buildid= -X main.version=$version" -o "$out" .
sha256sum "$out" 2>/dev/null || shasum -a 256 "$out"
