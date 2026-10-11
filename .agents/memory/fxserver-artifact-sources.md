---
name: fxserver-artifact-sources
description: Where FXServer build lists and downloads really come from in 2026, for anyone touching core/modules/FxBuilds/sources.ts.
metadata:
  type: reference
---

Checked by hand on 2026-10-11:

- The old artifact index pages (`https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/`
  and `build_proot_linux/master/`) now answer 301 and land on a docs.fivem.net download page. That
  page links absolute URLs, and lists Windows builds as `server.7z`.
- `server.zip` still downloads for the same `<build>-<hash>` folder (HTTP 200 for builds 37150 and
  37175), so `parseIndexPage` accepts either name and always rebuilds the URL as
  `<root>/<build>-<hash>/server.zip` (or `fx.tar.xz` on Linux). Downloading `server.7z` would need a
  7z extractor the panel does not ship.
- `https://changelogs-live.fivem.net/api/changelog/versions/{win32|linux}/server` is the stable
  source: `recommended`, `latest`, `optional`, `critical` as strings plus `*_download` URLs.

**Why:** a parser written for the old listing finds nothing on the docs page, and that page's
format may change again without notice.
**How to apply:** if Recent builds comes back empty, fetch the index URL first and look at what it
links before touching the regex. Never accept a URL from the page as is; keep rebuilding it from the
build number and hash. Related: [[ui-preview-without-game]].
