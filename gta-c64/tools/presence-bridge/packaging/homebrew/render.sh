#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Fills in the Homebrew formula template for one release.
#
#   render.sh <version> <source archive URL> [local copy of the archive]
#
# Without a local copy the archive is downloaded to work out its checksum. Prints the formula.
set -euo pipefail
version=$1 url=$2 file=${3:-}
if [ -z "$file" ]; then
  file=$(mktemp)
  trap 'rm -f "$file"' EXIT
  curl -fsSL -o "$file" "$url"
fi
sum=$( (sha256sum "$file" 2>/dev/null || shasum -a 256 "$file") | cut -d' ' -f1)
sed -e "s|@URL@|$url|" -e "s|@VERSION@|$version|" -e "s|@SHA256@|$sum|" \
  "$(dirname "$0")/sleazeburg-presence.rb.in"
