# Compatibility

> [!WARNING]
> **Check before you update, and update nothing until you have.** A firmware update can
> permanently close the root path on your TV. The numbers below are what keep that decision
> yours — and getting it wrong is unrecoverable.

## The one rule

**There is no such thing as "rooting a webOS version".** Root exploits target a specific
**OTA ID** (a platform/region/suffix triple burned into your TV) at or below a specific
**firmware version**. Two 2021 LG TVs can be identical to look at and have completely
different ceilings, because they are different OTA IDs or they are on different firmware.

So the first thing to find out is your own two numbers.

```sh
# on the TV, as root
luna-send -n 1 luna://com.webos.service.tv.systemproperty/getSystemInfo \
  '{"keys":["otaId","modelName","firmwareVersion","sdkVersion","boardType"]}'
```

You want `otaId`, and the newest number in `firmwareVersion`. Then check them at
**[cani.rootmy.tv](https://cani.rootmy.tv)** — or offline, with the same dataset this page
is built from:

```sh
npm i @webosbrew/caniroot
node tools/caniroot-report.mjs HE_DTV_W21U_AFADATAA
```

That prints every exploit available on that device, the newest firmware each one still
works on, and the firmware that patched it. **Do this before you update anything.**

---

## Which TVs

Aggregated from [`@webosbrew/caniroot`](https://github.com/webosbrew/caniroot) (v1.3.7):
119 devices, 8 exploit families. The numbers are *device counts per model year*, not
firmware versions — they tell you which years are still open.

| Model year | Devices | `nvm` | `mvpd` | `rootmytv` | `crashd` | `asm` | `wta` | `dejavuln` | `faultmanager` |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 2015 | 11 | 11 | 11 | | | | | | |
| 2016 | 14 | 14 | 14 | 14 | | | | | |
| 2017 | 8 | 8 | | 8 | | | | 8 | |
| 2018 | 10 | | | 10 | 10 | 10 | | 10 | 10 |
| 2019 | 12 | | | 12 | 12 | 12 | | 12 | 12 |
| 2020 | 12 | | | 12 | 12 | 12 | 12 | 12 | 12 |
| 2021 | 6 | | | 6 | 6 | 6 | 6 | 6 | 6 |
| 2022 | 6 | | | 6 | 8 | 8 | 8 | 8 | 10 |
| 2023 | 8 | | | | 8 | 8 | 8 | 8 | 16 |
| **2024** | 7 | | | | | | | | **7** |
| **2025+** | **0** | | | | | | | | |

Read it like this:

* **2015–2016** sets predate webOS 3.5 and use the `nvm` / `mvpd` routes. Nothing in this
  repo is tested there.
* **2017–2023** is the sweet spot. `dejavuln` — the exploit used for this build — is
  present on **82 devices** across 2017–2023.
* **2024** models have exactly one route left: `faultmanager`.
* **2025 and later have nothing.** No 2025 device appears in the dataset with any exploit.
  Treat a new TV as unrootable.

`faultmanager` is the modern fallback: it covers 2018→2024, including all of webOS 9, and
on several 2022/2023 devices it reaches *further* than `dejavuln` does. If `dejavuln` is
patched on your set, it is worth checking whether `faultmanager` is still open.

---

## My TV, exactly

Everything in this repo was built and verified on:

| | |
|---|---|
| Model | LG `OLED55A16LA` — OLED A1, sizes 48/55/65/77", DVB, regions DE/PL/UK |
| OTA ID | `HE_DTV_W21U_AFADATAA` |
| Codename | `kisscurl` (machine `lm21u`) |
| webOS | `6.3.3-438` |
| Firmware at build time | `03.36.30` |
| Board | `LM21U_DVB_EU` |

Its full exploit list, straight from the dataset:

| Exploit | Newest firmware still vulnerable | First patched firmware |
|---|---|---|
| `rootmytv` | 03.21.40 | 03.30.10 |
| `wta` | 03.36.30 | 03.40.70 |
| `crashd` | 03.40.70 | 03.40.80 |
| `asm` | 03.40.70 | 03.40.80 |
| **`dejavuln`** | **03.40.82** | **03.41.00** |
| `faultmanager` | 03.51.17 | 03.52.60 |

**This corrected my own assumption, so it is worth being blunt about it.** I had assumed
03.36.30 was the newest rootable firmware on this panel. It is not: `dejavuln` keeps
working up to **03.40.82**, and `faultmanager` up to **03.51.17**. The practical advice for
anyone with this OTA ID:

> Stay at or below **03.40.82** to keep the `dejavuln` route. Staying below **03.51.17**
> keeps the `faultmanager` route as a fallback. Past 03.52.60, this TV is closed.

Update servers are in the blocklist precisely so this decision stays yours.

---

## Will it work on yours?

Three separate questions, and people usually only ask the first.

**1. Can the TV be rooted?**
Check [cani.rootmy.tv](https://cani.rootmy.tv) with your OTA ID and firmware. Start at
[webosbrew.org/rooting](https://www.webosbrew.org/rooting/).

**2. Does the unspy boot mechanism apply?**
Yes, if you are rooted through Homebrew Channel — this repo relies on
`/var/lib/webosbrew/init.d` (a `run-parts` pass on every boot) and on `startup.sh` living
on the writable `/var/lib/webosbrew/`, right next to it. Both come from Homebrew Channel
and exist on every rooted webOS TV I am aware of.

**3. Will the launcher render?**
The launcher targets **webOS 6 / Chromium 79**. That is the renderer it was written
against, and it uses the restricted syntax that implies (no optional chaining, no `??`, no
`gap`, no `aspect-ratio`, no `@property`, no ES modules over `file://`).

* **webOS 6 (2021–2022)** — as tested.
* **webOS 5 (2020)** — Chromium 68. Close enough to be worth trying; expect to fix a few
  CSS features.
* **webOS 7 / 8 / 9 (2022–2025)** — newer Chromium and different app packaging. The UI code
  will run, the *home-screen integration* will need re-probing: the daemon that carries the
  HOME key code, and the app manager behaviour at boot, are both platform-specific.
* **webOS 4 and older** — not a target.

**4. Which daemon carries your HOME button?**
This is the one that cost me the most time. On my set the HOME press is delivered by
**`micomservice`**, not `lginput2`. Hook the wrong one and everything *looks* correct —
the hook loads, the log says it remapped the key — while HOME still opens LG's home
screen. `inputhook-supervisor` in this repo hooks every known candidate for that reason.
To check yours, see the probe walkthrough in [launcher.md](launcher.md#finding-your-own-home-button-carrier).

---

## Unspy on other TV brands

It doesn't run on them. This is LG webOS specific — the `luna://` service bus, the signed
squashfs app partitions, `com.webos.app.home`, the `micomservice` input path and the
`/var/lib/webosbrew/init.d` hook are all webOS concepts.

The *method* — don't fight the read-only partition, bind-mount an empty directory over it;
don't replace the home app, redirect the button; blackhole endpoints at the hosts file —
generally transfers to any Linux-based TV you can get a shell on. Samsung Tizen and
Android TV have their own equivalents and their own communities.
