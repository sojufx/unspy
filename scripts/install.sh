#!/bin/sh
# install.sh - put the unspy boot hooks onto a rooted LG webOS TV.
#
# Run this ON THE TV, as root, with the scripts/ directory sitting next to it:
#
#   export TV_IP=<your-tv-ip>
#   python3 tools/tvpush.py -r scripts /tmp/unspy
#   python3 tools/tvtelnet.py 'sh /tmp/unspy/scripts/install.sh'
#
# A rooted webOS TV gives you a telnet root shell (dejavuln / Homebrew Channel),
# not SSH - the two helpers above are stdlib-only, so there is nothing to
# install. Over SSH, scp/ssh work equally well.
#
# It is idempotent, it backs up anything it modifies, and it never touches a
# read-only partition. Undo everything with:
#
#   sh install.sh --revert
#
# Read ../docs/safety.md first.

HERE=$(cd "$(dirname "$0")" && pwd)
BREW=/var/lib/webosbrew
INITD=$BREW/init.d
SS=$BREW/startup.sh
LINE='[ -x /var/lib/webosbrew/early-hooks ] && /var/lib/webosbrew/early-hooks'
APP=works.partridge.webos-launcher
INPUTHOOK=/media/developer/apps/usr/palm/services/org.webosbrew.inputhook.service/inputhook

INITD_FILES="50-debloat-blocklist 60-debloat-hideapps 65-debloat-homescreen 70-debloat-novoice 80-debloat-nodiscovery 85-homebutton"
BREW_FILES="early-hooks inputhook-supervisor boot-home"

say() { echo "[unspy] $*"; }
warn() { echo "[unspy] WARNING: $*" >&2; }
die() { echo "[unspy] ERROR: $*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "run me as root, from the TV's root shell"
[ -d "$INITD" ] || die "$INITD is missing. Is Homebrew Channel installed on a rooted TV?"

# ---------------------------------------------------------------- revert
if [ "$1" = "--revert" ]; then
	say "reverting"
	for f in $INITD_FILES; do
		[ -f "$INITD/$f" ] && rm -f "$INITD/$f" && say "  removed init.d/$f"
	done
	for f in $BREW_FILES; do
		[ -f "$BREW/$f" ] && rm -f "$BREW/$f" && say "  removed $f"
	done
	if [ -f "$SS" ] && grep -qF "$LINE" "$SS"; then
		grep -vF "$LINE" "$SS" > "$SS.tmp" && mv "$SS.tmp" "$SS" && chmod +x "$SS"
		say "  removed the early-hooks line from startup.sh"
	fi
	say "done. bind-mounts and stopped units clear on the next reboot."
	say "note: TV *settings* live in the system settings service, not in files,"
	say "      so --revert does not touch them - flip them back in the TV menus"
	say "      or re-run debloat-settings.sh with your original values."
	exit 0
fi

# ---------------------------------------------------------------- preflight
cat <<'BANNER'

  ============================================================================
   unspy - AT YOUR OWN RISK

   Rooting voids the warranty and can permanently brick your TV. This was
   tested on ONE television. There is no support and no warranty.

   Have a root shell open RIGHT NOW so you can undo this without rebooting,
   and know your firmware ceiling before you update anything:
       docs/safety.md   and   docs/compatibility.md
  ============================================================================

BANNER

say "preflight"
if [ -d "$INPUTHOOK" ]; then
	say "  LG Input Hook found - HOME can be remapped"
else
	warn "LG Input Hook is NOT installed ($INPUTHOOK missing)."
	warn "The debloat hooks will work, but HOME cannot be remapped and the"
	warn "launcher cannot take over the home screen. Install 'Input Hook' from"
	warn "the Homebrew Channel, then re-run this script."
fi

if grep -q "\"id\"[[:space:]]*:[[:space:]]*\"$APP\"" "/media/developer/apps/usr/palm/applications/$APP/appinfo.json" 2>/dev/null; then
	say "  launcher ($APP) found"
else
	warn "the launcher ($APP) does not appear to be installed yet."
	warn "The hooks will still install; install the launcher, then reboot."
fi

# ---------------------------------------------------------------- files
say "installing boot hooks into $INITD"
for f in $INITD_FILES; do
	[ -f "$HERE/$f" ] || die "$HERE/$f is missing - copy the whole scripts/ directory over"
	cp "$HERE/$f" "$INITD/$f" || die "could not write $INITD/$f"
	chmod +x "$INITD/$f"
	say "  $f"
done

say "installing launcher helpers into $BREW"
for f in $BREW_FILES; do
	[ -f "$HERE/$f" ] || die "$HERE/$f is missing"
	cp "$HERE/$f" "$BREW/$f" || die "could not write $BREW/$f"
	chmod +x "$BREW/$f"
	say "  $f"
done

# ---------------------------------------------------------------- startup.sh
# The whole reason this repo gets to the launcher before you can press anything:
# startup.sh runs at ~21s, init.d does not run until ~42s.
patch_startup() {
	if [ ! -f "$SS" ]; then
		warn "no $SS - skipping the early-boot patch."
		warn "85-homebutton in init.d still starts the hooks, about 8s later."
		return 0
	fi
	if grep -qF "$LINE" "$SS"; then
		say "startup.sh already patched"
		return 0
	fi

	[ -f "$SS.orig" ] || cp "$SS" "$SS.orig"
	say "patching startup.sh (pristine copy kept at startup.sh.orig)"

	awk -v line="$LINE" '
		{ if (!done && $0 ~ /^SERVICE_DIR=/) { print line; done = 1 } print }
		END { exit done ? 0 : 1 }
	' "$SS" > "$SS.new" || {
		rm -f "$SS.new"
		warn "could not find the insertion point in startup.sh - left it alone."
		warn "85-homebutton still covers you."
		return 0
	}

	if command -v bash >/dev/null 2>&1 && ! bash -n "$SS.new" 2>/dev/null; then
		rm -f "$SS.new"
		die "the patched startup.sh failed a syntax check - aborted, original untouched"
	fi
	# the patched file must still be a superset of the original
	if [ "$(wc -l < "$SS.new")" -le "$(wc -l < "$SS")" ]; then
		rm -f "$SS.new"
		die "the patched startup.sh looks wrong - aborted, original untouched"
	fi

	cp "$SS.new" "$SS" && rm -f "$SS.new" && chmod +x "$SS"
	say "  done: early hooks will now run at ~21s instead of ~42s"
}
patch_startup

# ---------------------------------------------------------------- run now
# So you do not have to reboot to see the result. Everything here is what the
# init.d pass will do on every boot from now on.
say "applying the hooks now"
for f in $INITD_FILES; do
	"$INITD/$f" >/dev/null 2>&1 || warn "$f reported an error (see its own output on the next boot)"
done
setsid "$BREW/early-hooks" >/dev/null 2>&1 &

# ---------------------------------------------------------------- report
# NOTE: bind-mounts of a directory on tmpfs are reported with "tmpfs" in the SOURCE
# field, not the source path - so grep the MOUNT POINT, never /tmp/debloat-empty.
say "installed. current state:"
echo
echo "  hidden app dirs         : $(awk '$1=="tmpfs" && $2 ~ /palm\/applications/ {n++} END {print n+0}' /proc/mounts 2>/dev/null)"
echo "  blocklist active        : $(grep -q webos-debloat /etc/hosts 2>/dev/null && echo "yes ($(sed -n '/webos-debloat/,$p' /etc/hosts | grep -c '^127\.0\.0\.1') names blackholed)" || echo NO)"
echo "  discovery firewall rules: $(iptables -S 2>/dev/null | grep -c 'dport 1900\|dport 5353') / 4 (IPv4; IPv6 may be unavailable)"
echo "  voice capture stopped   : $(ps -ef 2>/dev/null | grep -v grep | grep -q /usr/sbin/voiceinput && echo NO || echo yes)"
echo
say "logs (this boot): /tmp/inputhook-boot.log  /tmp/boot-home.log"
say "reboot to verify the full boot path: reboot"
