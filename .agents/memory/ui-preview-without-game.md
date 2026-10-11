---
name: ui-preview-without-game
description: How the panel and in-game menu can be viewed without FiveM, so the user can be told the right commands.
metadata:
  type: reference
---

- In-game menu: `npm.cmd run browser -w nui` serves http://localhost:40121/nui/ with mock data
  (`debugData()` calls in the NUI source set visibility, permissions, players and `setGameName`).
  Other menu states are driven by dispatching `window` `message` events (`setServerCtx`,
  `setMenuPage`, `setPlayerList`, `setWarnOpen`, `addAnnounceMessage`, ...), exactly as the Lua
  side does.
- Web panel: there is no mock mode. Run `npm.cmd run dev -w panel` (Vite) and
  `npm.cmd run dev -w core` (starts FXServer from `TXDEV_FXSERVER_PATH` in `.env`), then open the
  panel on its usual port. Without the backend, `index.html` shows "Panel configuration was not
  injected".
- The in-game browser is CEF on Chrome 103: no `color-mix()`, `oklch()`, `dvh`/`svh` units, or
  reliable native `<select>` popups. A desktop browser will not catch these; check
  `docs/design-system.md` before using newer CSS.

- A "removeChild ... not a child of this node" (Firefox) or "Failed to execute 'removeChild'" (Chrome)
  crash in the panel dev server is almost always a Vite hot reload leaving React's DOM stale, eg while
  agents edit panel files under the user's running `npm run dev`. `isDomDesyncError()` in
  `panel/src/components/ErrorFallback.tsx` auto-reloads it in dev mode for every browser's wording;
  only investigate the page itself if it reproduces after a full refresh with no edits in flight.

The user does the visual testing; see [[user-watches-ui-live]].
