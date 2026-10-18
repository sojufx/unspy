#!/bin/sh
# Installs the packaged .ipk on a TV and launches it.
#
# Two transports, picked by which variable you set (in the environment or in a
# git-ignored `tv.env` at the project root - copy tv.env.example):
#
#   TV_IP=192.0.2.10    a rooted TV. Rooted webOS gives you a *telnet* root
#                       shell, not SSH, so this path uses the repo's own
#                       stdlib-only helpers (tools/tvpush.py, tools/tvtelnet.py).
#   TV_HOST=root@...    a TV with SSH (Developer Mode, or sshd you installed).
#
# Both end in the same call: webOS's developer install service, the one the
# Homebrew Channel and ares-install use. Nothing outside the app's own
# directory is touched.
#
# Without either: `npx ares-setup-device`, then `npx ares-install --device <name> build/*.ipk`.
set -e
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f tv.env ] && . ./tv.env
TOOLS="$(cd .. && pwd)/tools"

APP_ID="$(sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' public/appinfo.json | head -1)"
IPK="$(ls build/*.ipk 2>/dev/null | head -1)"
[ -n "$IPK" ] || { echo "No .ipk in build/ — run 'npm run package' first" >&2; exit 1; }
REMOTE_IPK="/tmp/$(basename "$IPK")"

INSTALL_CMD="luna-send -w 60000 -i luna://com.webos.appInstallService/dev/install '{\"id\":\"com.ares.defaultName\",\"ipkUrl\":\"$REMOTE_IPK\",\"subscribe\":true}' | grep -oE '\"state\":\"[^\"]*\"|\"errorText\":\"[^\"]*\"' | uniq; rm -f '$REMOTE_IPK'"
# luna-send only prints when it has a tty; both transports give it one.
LAUNCH_CMD="luna-send -n 1 luna://com.webos.applicationManager/launch '{\"id\":\"$APP_ID\"}'"

if [ -n "$TV_IP" ]; then
	echo "Copying $(basename "$IPK") to TV_IP=$TV_IP (telnet root shell)..."
	python3 "$TOOLS/tvpush.py" "$IPK" "$REMOTE_IPK"

	echo "Installing $APP_ID..."
	python3 "$TOOLS/tvtelnet.py" "$INSTALL_CMD"

	echo "Launching $APP_ID..."
	python3 "$TOOLS/tvtelnet.py" "$LAUNCH_CMD"
	exit 0
fi

[ -n "$TV_HOST" ] || { echo "Set TV_IP=<tv-ip> (rooted, no SSH) or TV_HOST=root@<tv-ip> (SSH). Copy tv.env.example to tv.env and edit it." >&2; exit 1; }

echo "Copying $(basename "$IPK") to $TV_HOST..."
scp -q "$IPK" "$TV_HOST:$REMOTE_IPK"

echo "Installing $APP_ID..."
# luna-send needs a tty (-tt) to print anything; the subscription ends when the install does.
ssh -tt "$TV_HOST" "$INSTALL_CMD" | tr -d '\r'

echo "Launching $APP_ID..."
ssh -tt "$TV_HOST" "$LAUNCH_CMD" | tr -d '\r'
