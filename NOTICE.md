# Third-party notices

The MIT licence in [LICENSE](LICENSE) covers **this repository's own code**: the boot hooks
in `scripts/`, the host-side tooling in `tools/`, the documentation, and the photographs and
screenshots in `media/`.

It does **not** cover anything listed below. Nothing in this repository is affiliated with,
endorsed by or sponsored by LG Electronics or any app vendor.

---

## Software this repo depends on or installs

| Component | Licence | Copyright | Role here |
|---|---|---|---|
| [`throwaway96/dejavuln-autoroot`](https://github.com/throwaway96/dejavuln-autoroot) | **AGPL-3.0** | © throwaway96 | the root exploit, run once from USB. **Not redistributed here** — download it from upstream. Its licence is not this repo's licence. |
| [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel) | MIT | © webosbrew contributors | provides `/var/lib/webosbrew/`, the `init.d` run-parts pass, the failsafe, and the `startup.sh` this repo edits by one line. **Not redistributed here.** |
| [`Simon34545/lginputhook`](https://github.com/Simon34545/lginputhook) (`org.webosbrew.inputhook`) | BSD-3-Clause | © Simon34545 | intercepts remote key codes and launches apps. **Not redistributed here** — install it from the Homebrew Channel. |
| [`partridgeworks/webos-launcher`](https://github.com/partridgeworks/webos-launcher) | MIT | © webos-launcher contributors | the app that `launcher/` in this repo is a fork of, redistributed **with** its licence and notices intact |
| [`webosbrew/caniroot`](https://github.com/webosbrew/caniroot) | MIT | © webosbrew contributors | the compatibility dataset behind `docs/compatibility.md` and `tools/caniroot-report.mjs`. **Not redistributed here** — it is an optional npm dependency. |

`faultmanager-autoroot`, referenced in the compatibility docs as a fallback root path, is
likewise a separate project with its own licence and is not redistributed here.

---

## `launcher/`

The `launcher/` directory is a fork of `partridgeworks/webos-launcher` (MIT). It keeps its
own [LICENSE](launcher/LICENSE) and
[THIRD_PARTY_NOTICES.md](launcher/THIRD_PARTY_NOTICES.md) — **read those for anything you
reuse from that directory.** In summary, from upstream:

* **Preact** — MIT, © Jason Miller. Compiled into `assets/app.js`.
* **Inter** typeface — SIL Open Font License 1.1, © The Inter Project Authors.
* **App and input icons** in `launcher/public/icons/` are the trademarks or copyright of
  their respective owners. They are included in good faith, only so that tiles are
  recognisable for apps the user already has installed. Rights holders can request removal
  by opening an issue on this repository or on upstream.

The restyle added by this project lives in `launcher/src/theme/`, `src/components/Backdrop.tsx`,
`src/lib/accent.ts` and parts of `src/screens/Home.tsx` and `src/components/Row.tsx`.

---

## Media

The photographs in `media/` were taken by the author on a television they own, and show the
author's own device with the author's own installed apps visible.

Screenshots contain app names, logos and artwork belonging to their owners, displayed for
identification purposes only. `media/launcher-settings.png` and `media/launcher-scroll.png`
are renders of the launcher itself.

If you are a rights holder and would like an image or an icon removed, open an issue and it
will be removed.
