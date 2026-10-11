---
name: user-watches-ui-live
description: The user tests UI changes visually themselves; give them the dev commands early and do not install browsers or screenshot tooling.
metadata:
  type: user
---

During the 2026-10 design rebuild the user asked mid-task how to watch the work with `npm run dev`,
and then said not to install Chromium or similar for testing because they test it themselves.

**Why:** They review visually and want to follow along; a browser install is slow (hundreds of MB)
and duplicates what they already do.

**How to apply:** Do not install Playwright, Chromium or other browsers. At the start of UI work,
give the exact commands (see [[ui-preview-without-game]]) and say when the UI is runnable. Order the
work so it compiles again quickly, say when a broken intermediate state is expected, and verify with
typecheck, tests and builds instead of screenshots. Hand over a short list of what to look at.
