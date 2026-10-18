# Safety and rollback

> [!WARNING]
> **At your own risk.** Rooting an LG TV voids its warranty and can permanently brick it.
> This was tested on one television. Have a root shell open *before* you change anything,
> so you can undo it without rebooting. If you cannot recover a bricked TV from a USB
> stick, do not start.

## The design rule

**Nothing in this repo writes to a read-only partition, and nothing replaces a system
component.** Every change is one of:

* a **file** on the writable `/var/lib/webosbrew/` — delete it;
* a **bind-mount** of an empty directory over a read-only one — `umount` it;
* a **setting** written through LG's own settings service — flip it back in the TV's menus;
* an **app** installed with the normal installer — uninstall it.

There is no patched binary, no modified system app, no custom kernel, and no change to
`com.webos.app.home`. The worst case is a TV that boots to LG's normal home screen.

> **The one change that is genuinely uncounted for: rooting.** The exploit itself is not
> this repo's work and is not reversible by deleting a file. Do that step deliberately, on
> a TV you can afford to lose. See [compatibility.md](compatibility.md).

---

## What each piece touches

| Artifact | Lives at | What it does | Undo |
|---|---|---|---|
| `50-debloat-blocklist` | `/var/lib/webosbrew/init.d/` | generates `/tmp/debloat-hosts`, bind-mounts it over `/etc/hosts` | delete the file, then `umount /etc/hosts` |
| `60-debloat-hideapps` | `init.d` | bind-mounts an empty dir over 25 app dirs in `/usr/palm/applications` and `/mnt/otncabi/…` | delete the file; `umount` each dir, or reboot |
| `65-debloat-homescreen` | `init.d` | same, for 11 home-screen promo apps | `sh scripts/65-debloat-homescreen --revert` |
| `70-debloat-novoice` | `init.d` | `systemctl stop voiceinput/voiceconductor` | delete the file; `systemctl start voiceinput.service voiceconductor.service` |
| `80-debloat-nodiscovery` | `init.d` | stops 6 units, unmounts 2 Luna services, adds 4 `iptables` rules | delete the file and reboot (see the header of the script for the exact commands) |
| `early-hooks` | `/var/lib/webosbrew/` | starts the two helpers below, detached | delete the file |
| `inputhook-supervisor` | `/var/lib/webosbrew/` | injects LG Input Hook into the input daemons, retry loop | delete the file; reboot clears the injection anyway |
| `boot-home` | `/var/lib/webosbrew/` | puts the launcher in front at boot, for a limited window | delete the file |
| `85-homebutton` | `init.d` | fallback starter for the two above | delete the file |
| **the `startup.sh` line** | `/var/lib/webosbrew/startup.sh` | calls `early-hooks` 8s earlier | remove that one line (below) |
| the launcher | installed app | a normal app, `systemApp: false` | uninstall it from the Homebrew Channel |
| the keybind | LG Input Hook service dir | maps key 773 → launcher | delete the keybind file |

**Those bind-mounts are the only "invisible" changes**, and they are all visible. Note the
one gotcha: on this TV a bind-mount of a directory that lives on tmpfs is reported with
**`tmpfs` in the source field**, not the source path — so search the *mount point*:

```sh
# every app dir that got masked (a tmpfs mounted over a read-only one)
awk '$1=="tmpfs" && $2 ~ /palm\/applications/ {print $2}' /proc/mounts

# the blocklist, by its content rather than by how it is mounted
# (the generated section starts at the line containing "webos-debloat")
sed -n '/webos-debloat/,$p' /etc/hosts | grep -c '^127\.0\.0\.1'   # -> 21 names blackholed
```

---

## The `startup.sh` edit, exactly

`startup.sh` belongs to **Homebrew Channel**, not to me. I added **one line** to it, and
kept a pristine copy of the original on the TV before touching it:

```sh
# the backup
/media/developer/apps/usr/palm/services/org.webosbrew.hbchannel.service/startup.sh

# the one added line, immediately after `touch "${once}"`
[ -x /var/lib/webosbrew/early-hooks ] && /var/lib/webosbrew/early-hooks
```

It is guarded (`-x`) and idempotent, so:

* if `early-hooks` is ever missing, the line is a no-op and the boot is untouched;
* if Homebrew Channel is updated and overwrites `startup.sh`, the line disappears and the
  hooks still come up from `85-homebutton` in `init.d` — just 8 seconds later.

To remove it by hand:

```sh
cd /var/lib/webosbrew
cp startup.sh startup.sh.mine
grep -v 'early-hooks' startup.sh.mine > startup.sh
chmod +x startup.sh
```

---

## Rollback

**One thing:**

```sh
rm /var/lib/webosbrew/init.d/50-debloat-blocklist
umount /etc/hosts
reboot
```

**Everything this repo installed:**

```sh
rm -f /var/lib/webosbrew/init.d/{50-debloat-blocklist,60-debloat-hideapps,65-debloat-homescreen,70-debloat-novoice,80-debloat-nodiscovery,85-homebutton}
rm -f /var/lib/webosbrew/{early-hooks,inputhook-supervisor,boot-home}
reboot
```

The **settings** are the one thing a file-delete does not undo — they live in the TV's own
settings service, so flip them back in the TV's menus (Settings → General / Options), or
re-apply the originals you captured by running `scripts/debloat-settings.sh` *before* you
start. The script prints the before and after values of every key it touches, precisely so
you have them.

Or, non-destructively, undo the mounts for the current session only:

```sh
sh scripts/65-debloat-homescreen --revert                       # the home-screen promo apps
for d in /usr/palm/applications/* /mnt/otncabi/usr/palm/applications/*; do
  awk '{print $2}' /proc/mounts | grep -qx "$d" && umount "$d"
done
systemctl start voiceinput.service voiceconductor.service
systemctl start avahi-daemon.socket avahi-daemon.service mdnsd.service ssc.service
umount /etc/hosts
```

If you used `scripts/install.sh`, it also understands `--revert`, which reverses its own
file installs and the `startup.sh` line.

---

## Failsafe

**None of this disables Homebrew Channel's own safety net**, and that is deliberate — the
TV's recovery path is untouched.

Homebrew Channel's `startup.sh` sets a flag in `/var/luna/preferences/` before the risky
part of the boot and clears it once the boot succeeds, but **only if `startup.sh` gets that
far**:

```sh
if [[ -e /var/luna/preferences/webosbrew_failsafe ]]; then
    "${SERVICE_DIR}/bin/telnetd" -l /bin/sh     # emergency root telnet
    ...                                         # toast + alert asking you to fix it
fi
```

Two consequences worth understanding before you need them:

1. **If the TV boots to a black screen after these changes, it is almost certainly a
   mount or a stopped service, not a brick.** Get in over the emergency telnet, delete the
   file that caused it, reboot.
2. **My `early-hooks` line runs *before* the failsafe flag is set.** It only spawns two
   detached processes and exits, so it cannot hang the boot — but if you write your own
   version of it, do not put anything blocking in there.

The nuclear option — the TV is unusable and you cannot get a shell — is the USB install
path you rooted through. It restores the stock image.

---

## Before you start

- [ ] **You own the TV** and can afford to lose it. Rooting voids the warranty and can
      brick the panel.
- [ ] You checked your OTA ID **and firmware** at [cani.rootmy.tv](https://cani.rootmy.tv)
      and read [compatibility.md](compatibility.md).
- [ ] You know your firmware ceiling and you have **blocked firmware updates** — or you are
      willing to stay off the network's update path deliberately.
- [ ] Homebrew Channel is installed and its failsafe telnet works. Test it **before**
      changing anything.
- [ ] You have a root shell open **right now** (telnet or SSH), so you can undo what you do
      next without rebooting.
- [ ] You have a backup of `startup.sh` (`cp startup.sh startup.sh.orig`) — `install.sh`
      does this for you.
- [ ] You know where the mount points are (`cat /proc/mounts`) so you can spot a stacked one.

## Verify the state at any time

The helper tools read your TV's address from the `TV_IP` environment variable (nothing is
hardcoded — set it once, or pass it per command):

```sh
export TV_IP=192.168.1.100     # or: TV_IP=... python3 tools/tvtelnet.py '...'
```

```sh
# what is hidden: a tmpfs over each masked app dir (grep the MOUNT POINT)
python3 tools/tvtelnet.py 'awk "\$1==\"tmpfs\" && \$2 ~ /palm\/applications/ {print \$2}" /proc/mounts'

python3 tools/tvtelnet.py 'cat /tmp/inputhook-boot.log'              # hook timeline, this boot
python3 tools/tvtelnet.py 'cat /tmp/boot-home.log'                   # launcher at boot
python3 tools/tvtelnet.py 'ps -ef | grep -E "voiceinput|avahi|ssdp"' # what is still running
python3 tools/tvtelnet.py 'iptables -S | grep dport'                 # discovery rules
python3 tools/tvtelnet.py 'sed -n "/webos-debloat/,\$p" /etc/hosts | grep -c "^127\.0\.0\.1"'   # names blackholed
python3 tools/tvtelnet.py 'cat /tmp/debloat-hosts'                   # the blocklist I generated
```

---

## What can go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Black screen at boot, TV otherwise unresponsive | a stop or mount in a hook went wrong | emergency telnet → `rm` the last hook → reboot |
| Boots to LG's home screen, HOME opens LG home | injection failed this boot | wait; the supervisor keeps retrying. Check `/tmp/inputhook-boot.log` |
| HOME works but opens LG home | you hooked the wrong daemon | see [launcher.md](launcher.md#finding-your-own-home-button-carrier) |
| An app disappeared | it was in the hide list | `umount` its dir, then remove it from the script |
| No DLNA / AirPlay / ThinQ | `80-debloat-nodiscovery`, by design | delete that hook and reboot |
| Voice search gone | `70-debloat-novoice`, by design | `systemctl start voiceinput.service` |
| A hidden app is still running | the mount was added after it launched | reboot — hooks run before apps start |
| A dir has several stacked mounts | a hook ran twice without the idempotence check | `umount` until `grep` finds none |
