---
name: design-rebuild-2026-10
description: Context for the October 2026 rebuild of the web panel and in-game menu onto one design system, including what was removed on purpose.
metadata:
  type: project
---

In October 2026 the user supplied a strict design specification (dark, flat, one changeable accent,
phone first) and asked for the in-game menu to be redone from scratch to match the web panel, and
for the panel itself to follow the same rules. The specification is captured in
`docs/design-system.md`; follow that file, not older screenshots or commits.

Decisions that look like regressions but are intentional:

- The in-game menu dropped MUI and emotion entirely (plain React and `nui/src/styles/menu.css`).
  FiveM and RedM share one palette; the RedM brown theme was removed. `isRedm` only changes
  behaviour.
- No icons on headings or inside text buttons; icon-only buttons go through `IconButton` with a
  label. Avatars no longer use random per-user colours.
- Exception: the web panel sidebar keeps an icon on every nav row. The rebuild first removed them
  as the specification demands, and the user asked for them back right after ("add back icons to
  sidebar"). Do not strip them again; the spec's no-icon rule still applies everywhere else.
- No entrance animations: route transitions, dialog zooms and toast slides were removed. The phone
  drawer is the only sliding surface.
- The sidebar nav is flat everyday pages plus one collapsed "More" group. The unused
  `ServerStatus`, `ServerSchedule`, `PlayerlistSidebar` and global menu sheets were deleted.
- Accents grew from 12 to 17 presets plus a custom `#rrggbb` colour, stored in the same field.
  Fills moved from Tailwind 600 to 700, so `accentColor` values sent to the game changed.
- The in-game ban form has a confirmation step; filled red appears only on its confirm button.
- The connection-screen denial card became an accent callout (`checkJoin.ts` and `sv_main.lua`).
- The in-game Panel tab used to open `/server/server-log`, a route that no longer existed (404); it
  now opens the dashboard.

**How to apply:** Do not reintroduce removed decoration to restore the old look. New UI work starts
from the tokens and building blocks listed in `docs/design-system.md`.
