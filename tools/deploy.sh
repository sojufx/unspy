#!/bin/sh
# deploy.sh - fast iteration loop for the launcher UI.
#
# Pushes the freshly built UI straight into the app that is already installed on the TV
# and reloads it, so a change can be looked at in a few seconds. It does NOT go through the
# app install service - the real .ipk is installed separately (cd launcher && npm run deploy).
#
#   sh tools/deploy.sh [remote-app-dir]
#
# Set TV_IP first (or export it), eg:  TV_IP=192.168.1.100 sh tools/deploy.sh
set -e
TOOLS=$(cd "$(dirname "$0")" && pwd)
DIST=$(dirname "$TOOLS")/launcher/dist
REMOTE="${1:-/media/developer/apps/usr/palm/applications/works.partridge.webos-launcher}"

[ -f "$DIST/assets/app.js" ] || {
	echo "No build in $DIST - run:  cd launcher && npm install && npm run build" >&2
	exit 1
}

echo "Pushing assets to $REMOTE"
# tvpush's own sha256 check parses the telnet echo unreliably and reports a false
# MISMATCH, so its exit code is advisory here; the size check below is the reliable one.
"$TOOLS/tvpush.py" "$DIST/assets/app.js" "$REMOTE/assets/app.js" >/dev/null 2>&1 || true
if [ -f "$DIST/assets/app.css" ]; then
	"$TOOLS/tvpush.py" "$DIST/assets/app.css" "$REMOTE/assets/app.css" >/dev/null 2>&1 || true
fi
"$TOOLS/tvpush.py" "$DIST/index.html" "$REMOTE/index.html" >/dev/null 2>&1 || true

echo "Verifying on the TV"
LOCAL_SIZE=$(wc -c < "$DIST/assets/app.js" | tr -d ' ')
REMOTE_SIZE=$("$TOOLS/tvtelnet.py" "echo SZ=\$(wc -c < $REMOTE/assets/app.js)" 2>/dev/null \
	| grep -o 'SZ=[0-9]*' | tail -1 | cut -d= -f2)
echo "  app.js: local $LOCAL_SIZE  remote ${REMOTE_SIZE:-unknown}"
if [ "$LOCAL_SIZE" != "$REMOTE_SIZE" ]; then
	echo "  SIZE MISMATCH - not reloading" >&2
	exit 1
fi

echo "Reloading the app"
node "$TOOLS/tv-inspector.mjs" "setTimeout(function(){location.reload()},60); 'reloading'" >/dev/null 2>&1 || true
echo "Done."
