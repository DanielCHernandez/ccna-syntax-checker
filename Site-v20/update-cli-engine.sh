#!/bin/sh
# Copies the newest CLI Engine version into Site-v20/cli-engine/ under its
# stable name, so nothing in study-hub/ or syntax-checker-simple/ ever has
# to change when the engine gets a new version.
#
# Run from anywhere:   sh Site-v20/update-cli-engine.sh
#
# The engine is a single self-contained HTML file (the ios-engine-vX.js
# next to it is only a reference copy for Node testing; the HTML does not
# load it), so only the HTML is copied.
set -e
SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SITE_DIR")"

# Highest version number among the "Syn-Checker vX.Y.Z" folders (numeric sort, so 1.41.0 > 1.9.0)
VERSION="$(ls -d "$REPO_DIR"/Syn-Checker\ v*/ | sed -E 's:.*Syn-Checker v([0-9.]+)/$:\1:' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)"
SRC="$REPO_DIR/Syn-Checker v$VERSION/terminal-v$VERSION.html"

if [ ! -f "$SRC" ]; then
  echo "Could not find $SRC" >&2
  exit 1
fi

cp "$SRC" "$SITE_DIR/cli-engine/ccna-cli-engine.html"
echo "Copied v$VERSION -> Site-v20/cli-engine/ccna-cli-engine.html"
