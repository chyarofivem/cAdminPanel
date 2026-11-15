---
name: design-rebuild-2026-10
description: Context for the October 2026 rebuild of the web panel and in-game menu onto one design system, and the November 2026 move onto the owner's full design.md spec, including what was removed on purpose.
metadata:
  type: project
---

In October 2026 the user supplied a strict design specification (dark, flat, one changeable accent,
phone first) and asked for the in-game menu to be redone from scratch to match the web panel, and
for the panel itself to follow the same rules.

On 2026-11-15 (release 1.1.1) the user dropped a fuller spec, `design.md`, at the repository root
(left untracked) and asked for the UI to be "fully based" on it. Its sections 1 to 17 now form
`docs/design-system.md` verbatim apart from dash punctuation and the CEF rgba notes; section 18 maps
it onto the code. Follow that file, not older screenshots or commits. If the user updates
`design.md` again, re-diff it against sections 1 to 17 of the doc.

What design.md changed relative to the October spec (these look like reversals but are intended):

- Icons are allowed where they have a job: 24px sidebar nav icons, status icons in callouts, toasts
  and badges, 16px icons inside create/download/upload/start-stop/copy buttons, optional 32px
  empty-state icons. Decorative icons (icon boxes, an icon on every heading) stay banned.
- Callouts lost their 4px start-edge bar: one flat 10% tint, optional 24px status icon. The same
  went for toasts (modal surface plus status icon) and the connection-screen card.
- The sidebar has one shared sliding pill instead of an accent-soft active row.
- Modals, menus and tooltips fade and scale in from 0.98 (150ms); reduced motion keeps the fades.
- Charts follow the accent (single series), then neutral greys.

Decisions from October that still stand:

- The in-game menu has no MUI or emotion (plain React and `nui/src/styles/menu.css`). FiveM and
  RedM share one palette; `isRedm` only changes behaviour.
- Avatars do not use random per-user colours.
- The sidebar nav is flat everyday pages plus one collapsed "More" group.
- 17 accent presets plus a custom `#rrggbb` colour, stored in the same field; fills are Tailwind 700.
- The in-game ban form has a confirmation step; filled red appears only on its confirm button.
- The in-game Panel tab opens the dashboard.

**How to apply:** Do not reintroduce removed decoration to restore an old look, and do not strip
the purposeful icons design.md asks for. New UI work starts from `docs/design-system.md`.
