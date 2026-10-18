# The launcher

The home screen that replaces LG's. How it looks, how it is built, and how it ends up in
front of you at every boot.

[![The unspy launcher: "Good evening" greeting, clock, and APPS / SOURCES / MORE rows](../media/launcher-cdp.png)](../media/launcher-cdp.png)

> My build is a **restyle** of [`partridgeworks/webos-launcher`](https://github.com/partridgeworks/webos-launcher)
> (MIT), installed as `works.partridge.webos-launcher` **1.1.0**. Upstream wrote the
> plumbing — the Luna bridge, the app catalogue, the packaging, the remote-key handling.
> I rebuilt the visual layer and invented the home-screen integration. Both are credited
> in [NOTICE.md](../NOTICE.md).

---

## The look

The brief was "Apple TV, but for webOS 6", and the engine is a 2019 Chromium with no
flexbox `gap`, so almost everything is absolute positioning against layout tokens.

**Ambient lighting from the icon you are on.** This is the signature of the design. When
you move along a row, the backdrop takes on the dominant colour of the selected app's
icon — Netflix red, Disney+ blue, iPlayer pink. It is not a decorative gradient: it is
sampled from the actual pixels.

[![The home screen with the APPS row scrolled and BBC iPlayer focused: the backdrop has taken on iPlayer's pink, and the focused tile carries a white border](../media/launcher-scroll.png)](../media/launcher-scroll.png)

<sub>The same screen one press to the right: iPlayer focused, the room washed pink.</sub>

```
components/Backdrop.tsx   two stacked layers, cross-faded, each two radial gradients:
                          a bright core above the shelf + a wide ambient behind it
lib/accent.ts             draw the icon into a 20x20 canvas, average the pixels that
                          are not transparent, near-black or blown-out white, then
                          stretch the max channel to 236 so the colour can actually
                          light a room; fall back to a brand table per app ID
```

Two details worth stealing:

* **A single wide gradient reads as coloured fog.** Light needs a core, so the wash is two
  gradients — a tight, brighter ellipse near the shelf and a faint, wide one behind it — plus
  a bottom scrim that keeps the lowest row legible over any colour.
* **Chrome 79 cannot animate a gradient.** The backdrop is *two identical layers*; when the
  colour changes, the hidden one is repainted and the pair cross-fades via `opacity`. That
  is the whole trick.

**Focus is elevation first.** The selected tile grows to `1.14`, lifts on its shadow, and
takes a 1px white border (`tileBorderFocus`); the rest of the row drops to `88%` opacity.
It reads as the tile coming forward rather than as a cursor. The pointer is hidden on open
(`webOSSystem.setCursorHidden(true)`) — shake the Magic Remote to get it back.

**Everything is a token.** Colours, type scale, layout and motion live in one file:

```ts
// launcher/src/theme/tokens.ts
export const COLOR  = { bg: '#05050A', textPrimary: '#F4F4F6', tileBorderFocus: 'rgba(255,255,255,0.88)', ... };
export const FONT   = { greeting: 30, clockTime: 52, rowLabel: 16, tileLabel: 18, ... };
export const LAYOUT = { screenWidth: 1920, edgePadding: 110, rowsTop: 194, tileSize: 168,
                        tileGap: 28, tileRadius: 38, rowGap: 26, ... };
export const MOTION = { focusMs: 180, scrollMs: 320, focusScale: 1.14, unfocusedRowOpacity: 0.88 };
```

`applyTokens()` publishes them to `:root` as CSS custom properties, so the stylesheet and
the components read the same numbers. Change `tileRadius` from `38` to `8`, rebuild, and
every tile follows.

---

## The rows

| Row | Contents | Source |
|---|---|---|
| **APPS** | your apps, in your order | bundled catalogue ∩ what the TV says is installed |
| **SOURCES** | Live TV and HDMI inputs | `com.webos.service.eim/getAllInputStatus` — real inputs, with the names you set in the TV's Input settings |
| **MORE** | LG Home, Settings | LG's own home screen is still reachable from here |

**Why a catalogue rather than the live app list?** On webOS 6, sideloaded web apps are
*denied* `listLaunchPoints`, `listApps`, `getAppInfo` and `getForegroundAppInfo` — a web app
cannot see what is installed or read its icons. It *is* allowed
`applicationManager/getAppLoadStatus`, so the launcher shows catalogue entries only for
apps the TV confirms are there. Apps with no bundled icon get a monogram tile.

If you are rooted, there is an opt-in escape hatch: **Settings → Options → Live app list via
Homebrew Channel**, which asks the Homebrew Channel's service (running as root) to run the
blocked calls and base64-encode the real icons. It sends fixed commands only; icon paths
are validated and shell-quoted, and app IDs never reach the shell.

To add your own apps without editing tracked files:

```sh
cp src/config/catalog.local.example.ts src/config/catalog.local.ts   # git-ignored
```

---

## Controls

| Where | Key | Does |
|---|---|---|
| Home | ↑ ↓ | move between rows |
| Home | ← → | move along a row |
| Home | OK | open the app or input |
| Settings | OK | add or remove an app/source |
| Settings | Hold OK / **Re-order** | enter or leave re-order mode |
| Re-order | OK, arrows, OK | pick a tile up, move it, put it down |
| Anywhere | Back | return home / leave re-order |

[![The launcher's Settings screen: APPS / SOURCES / OPTIONS tabs, a grid of tiles with check badges, and a "Re-order apps" button](../media/launcher-settings.png)](../media/launcher-settings.png)

Adding and removing is a grid of every app it knows about, with the ones currently on your
shelf badged. Re-ordering is a mode, so you cannot do it by accident.

---

## How it becomes the home screen

Three mechanisms. Any one alone is not enough.

### 1. It installs as a normal app

`works.partridge.webos-launcher`, `version 1.1.0`, `systemApp: false`. Nothing is written to
a system partition, LG's home screen still exists underneath, and uninstalling it returns
you to stock.

```sh
cd launcher
npm install
cp tv.env.example tv.env      # TV_HOST=root@<your-tv>
npm run deploy                # build -> package -> install -> launch
```

### 2. The HOME button is remapped

[LG Input Hook](https://github.com/Simon34545/lginputhook) injects a shared library into the
running input daemons and matches key codes against a keybind file. Key code **773** is Home:

```json
{"773": {"action": "launch", "id": "works.partridge.webos-launcher"}}
```

Written to the Input Hook service's keybind file. It hot-reloads, so no reboot is needed to
test. `launch` is one of four actions: `launch`, `exec`, `replace`, `ignore` — which is how
you would map other buttons.

**The trap.** On this TV the HOME press is carried by **`micomservice`**, not `lginput2`.
`micomservice` writes key codes to `/dev/uinput` and starts *before* `lginput2`. Hook only
`lginput2` and the log will happily tell you the key was remapped while HOME still opens
LG's home screen — because the press never went through the daemon you hooked.

### Finding your own HOME-button carrier

Do this on your TV before blaming the keybind file. With the hook loaded:

```sh
# which processes have the hook?
for p in /proc/[0-9]*; do
  comm=$(cat $p/comm 2>/dev/null)
  grep -q libinputhookpp $p/maps 2>/dev/null && echo "hooked: $comm (${p#/proc/})"
done

# then watch Input Hook's own log while you press HOME
tail -f /tmp/lginput-hook-micomservice.log
tail -f /tmp/lginput-hook-lginput2.log
```

Whichever log shows `code=773 → Key 773 is launch → luna-send …/launch` when you press HOME
is your carrier. Mine is `micomservice`. `inputhook-supervisor` hooks every known candidate
(`micomservice lginput2 tvservice RELEASE testapp`) for exactly this reason.

### 3. Boot lands on the launcher

**The problem.** `/var/lib/webosbrew/init.d` is a `run-parts` pass, and on this TV it does
not run until **≈42s** uptime. The input daemons are up at **≈13s** and the TV is usable
from **≈30s**. Forty-two is too late: the TV is already showing LG's home screen.

**The fix.** `startup.sh` sits on the writable `/var/lib/webosbrew/` and is executed by
`devmode.service` at **≈21s**. So one guarded line near its top starts my hooks a full
8 seconds earlier, and everything in it is backgrounded so the boot is not delayed:

```bash
# in /var/lib/webosbrew/startup.sh, immediately after `touch "${once}"`
[ -x /var/lib/webosbrew/early-hooks ] && /var/lib/webosbrew/early-hooks
```

`early-hooks` just launches two detached processes:

```sh
setsid /var/lib/webosbrew/inputhook-supervisor >>/tmp/inputhook-boot.log 2>&1 &
setsid /var/lib/webosbrew/boot-home            >>/tmp/boot-home.log     2>&1 &
```

**`inputhook-supervisor`** polls for the daemons and injects the hook, then keeps polling
(slowly, forever) so a restarted daemon gets re-hooked. It logs a failure **once per
process** rather than once per poll, and it touches `/tmp/inputhook` so Input Hook's own
loader knows not to inject twice.

**Why retrying matters.** Early injection into `micomservice` is load-dependent and does
fail. On one measured boot it failed at 37s and succeeded at 51s. A one-shot injector would
have left HOME unremapped for that entire session.

**`boot-home`** is the safety net for the window before the hook lands — and it has to be
careful, because "keep the launcher in front" and "let the user open Netflix" are the same
instruction if you are clumsy about it:

* it re-asserts the launcher only for the first `SETTLE=20` seconds after boot;
* after the launcher has held the foreground for 3 consecutive checks, it **stops
  re-asserting it entirely**;
* until the hook is confirmed live it also replaces LG's home screen whenever *that* grabs
  the foreground;
* the moment `hook_live` is true — a `micomservice` process with `libinputhookpp` in its
  maps — it stops and exits. That is what keeps the launcher's own "LG Home" tile working
  normally, because after that point LG's home screen is something you asked for.

**`85-homebutton`** in `init.d` runs the same two helpers as a fallback, in case a Homebrew
Channel update ever overwrites `startup.sh`. Both helpers are single-instance (pidfile), so
running them twice is harmless.

### The measured boot

```
[34s] startup.sh early hooks
[36s] micomservice hooked
[38s] foreground 'com.webos.app.hdmi1' at boot -> showing the launcher
[40s] lginput2 hooked
[41s] hook is live, stopping
[47s] foreground = works.partridge.webos-launcher
```

Verified across four cold reboots. Logs at `/tmp/inputhook-boot.log` and `/tmp/boot-home.log`.

---

## Developing the UI

The TV exposes a Chrome DevTools endpoint on port **9998**, which is how a 1080p screenshot
was taken without leaving the desk.

```sh
node tools/tv-cdp.mjs Emulation.clearDeviceMetricsOverride
node tools/tv-shot.mjs     shot.png          # page screenshot
node tools/tv-inspector.mjs "document.title" # evaluate JS in the running app
node tools/tv-keys.mjs     LEFT RIGHT OK     # drive the remote
```

Fast iteration without rebuilding the ipk:

```sh
sh tools/deploy.sh          # push dist/ straight into the installed app, then reload
cd launcher && npm run dev  # or design in a desktop browser against the same build
```

`deploy.sh` verifies the pushed file size on the TV before reloading, because the telnet
helper's own sha256 readback is unreliable and reports a false mismatch.

> **Stop here and read this if you are porting.** `find` segfaults on this TV. Use `ls` and
> `grep`. Busybox `cp -n` silently fails. The telnet shell drops after ~3s idle, so
> background long remote commands and poll for the output.

---

## Known limits

* **Not instant-on.** LG's UI is on screen first; the launcher takes over once the panel is usable
  — a few seconds. This is a redirect, not a bootloader.
* **The hook is volatile.** It lives in the daemons, so every reboot loses it and the
  supervisor has to re-inject. If injection is ever permanently broken by a firmware
  update, you get the stock home screen and nothing breaks.
* **HOME can still open LG's home screen** if you press it *before* the hook is live. That
  window is 2–3 seconds on a normal boot, and `boot-home` covers it.
* **The launcher does not replace `com.webos.app.home`.** `com.webos.app.home` is a signed,
  read-only native shell — it cannot be rebuilt, and hiding it bricks the TV.
* **Twelve-second boot tax, measured on one TV.** Do not assume the same timings on a
  different model; measure first, then decide whether `early-hooks` earns its place.
