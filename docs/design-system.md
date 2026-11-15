# Design system

The web panel (`panel/`) and the in-game menu (`nui/`) share one design system. Sections 1
to 17 are the binding specification; section 18 maps it onto this repository (where the
tokens live, which component implements which rule, and the embedded-browser constraints).
Read both before changing any UI.

Apply these rules to everything you design or build. When something isn't covered here,
pick the closest existing token or pattern instead of inventing a new one.

## 1. Principles
- **Tool, not a landing page.** The interface is used every day to get things done. It
  should feel calm, precise and quick to scan, never decorated or "marketing".
- **Dark, flat, quiet.** Near-black surfaces with thin translucent white layers on top.
  Exactly one accent colour, used sparingly so it always means "this is the action" or
  "you are here". The working interface is dark only; marketing sites may keep a
  light/dark toggle.
- **One system across the interface.** The dashboard, account pages, forms and admin use
  the same shell, components, spacing and motion. A change to one lands in all of them in
  the same batch; only the accent and the logo change.
- **Phone first.** Every screen must feel made for a phone, then grow into tablet and
  desktop. "It also works on mobile" is not enough.
- **Content over chrome.** Whitespace does the grouping. Remove every border, box,
  label, badge and icon that doesn't carry information.
- **One obvious next step.** Each view has at most one primary action, and every action
  sits next to the thing it changes.
- **No wasted space, no clutter.** Fill space with useful information, never with
  decoration or empty areas.

## 2. Colour tokens
Declare these on `:root` and reference them everywhere. Never hard-code a colour inside a
component. The interface is dark-only.

```css
:root {
  color-scheme: dark;

  /* Accent: the single changeable colour (see §3). Default = Tailwind blue. */
  --accent:       #1d4ed8;  /* fill: filled buttons, active badges, toggles on (Tailwind 700) */
  --accent-hover: #1e40af;  /* fill on hover (800) */
  --accent-text:  #3b82f6;  /* the accent as text, icon or focus ring on dark (500) */
  --accent-glow:  #60a5fa;  /* loading bar, hovered accent text (400) */
  /* soft, tint, edge and icon are concrete rgba() values here: see §18 (CEF). */
  --accent-soft:  rgba(29, 78, 216, 0.1);   /* accent 10%: accent callout, selected segmented choice */
  --accent-tint:  rgba(29, 78, 216, 0.15);  /* accent 15%: chart area */
  --accent-edge:  rgba(29, 78, 216, 0.2);   /* accent 20%: active outline */
  --accent-icon:  rgba(59, 130, 246, 0.5);  /* accent text 50%: active nav icon */

  /* Surfaces, lowest to highest */
  --bg-top:    #101319;                 /* page background, top */
  --bg-bottom: #0b0d10;                 /* page background, bottom; console background */
  --sidebar:   #1c1e23;
  --menu:      #181a1e;                 /* dropdowns, popovers, tooltips */
  --modal:     #1a1c20;                 /* modals, toasts */
  --raise:     rgb(255 255 255 / 0.05); /* cards, sections, list rows, hover */
  --raise-2:   rgb(255 255 255 / 0.10); /* secondary buttons, badges, active tab, row hover */
  --raise-3:   rgb(255 255 255 / 0.15); /* secondary button hover, toggle off */
  --sunken:    rgb(15 17 22 / 0.5);     /* inputs, checkboxes */
  --hairline:  rgb(255 255 255 / 0.05); /* dividers, input outline */

  /* Text */
  --text:       #ffffff; /* headings, values, labels */
  --text-body:  #d1d5db; /* body copy, nav labels */
  --text-muted: #9ca3af; /* descriptions, helper text, meta */
  --text-faint: #71717a; /* placeholders, axis labels, resting nav icons */

  /* Status: never follows the accent */
  --success: #22c55e;  --success-text: #4ade80;
  --warning: #f59e0b;  --warning-text: #fbbf24;
  --danger:  #dc2626;  --danger-text:  #f87171;
  --info:    #3b82f6;

  /* Type */
  --font-sans: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Radius */
  --radius-2xs: 4px;     /* checkboxes only */
  --radius-xs:  6px;     /* dropdown menus, tooltips */
  --radius-sm:  8px;     /* inputs, badges, icon buttons */
  --radius-md:  12px;    /* nav rows, tabs, modals, toasts, breadcrumbs, code blocks */
  --radius-lg:  16px;    /* cards, sections, list rows, callouts, tab strip */
  --radius-pill: 9999px; /* buttons, progress bars, avatars */
}

body {
  background: linear-gradient(var(--bg-top), var(--bg-bottom)) fixed;
  color: var(--text-body);
  font-family: var(--font-sans);
}
```

## 3. Accent theming
The accent must be changeable from one setting. Changing it re-themes the whole interface,
and nothing outside the accent tokens changes.

- **Presets** are Tailwind palettes: blue (default), indigo, violet, purple, fuchsia,
  pink, rose, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky. Leave out
  the greys, because a grey accent disappears into the surfaces. Map each palette like
  this: fill = 700, hover = 800, text = 500, glow = 400. For indigo, violet, purple and
  red, 500 reads under 4.5:1 on the sidebar, so use text = 400 and glow = 300.
- **A custom colour** is used as the fill. Derive the rest in code (JS or server), not by
  eye:
  - fill: the chosen colour. Lower its OKLCH lightness in 0.01 steps until white text on
    it reaches 4.5:1.
  - hover: the fill with OKLCH lightness −0.065 and chroma ×0.85.
  - text: the same hue at OKLCH lightness ≈ 0.68. If that reads under 4.5:1 on #1c1e23,
    use ≈ 0.75.
  - glow: one step lighter than text.
  - soft / tint / edge / icon: the fill at 10%, 15% and 20%, and the text at 50%, as
    rgba() values (§18).
- **What follows the accent:** the filled primary button, links, the active nav label and
  icon, the active tab underline, focus rings, on-states of toggles, checkboxes and
  radios, progress bar fills, the top loading bar, accent callouts, stat values and
  single-series charts. The sidebar's sliding pill stays neutral (--raise).
- **What never follows it:** status colours, text and surface colours, logos and other
  content imagery.
- **Functional action tints:** a dense toolbar may give each action a soft 10% tint of
  an existing accent or status colour (create, upload, search, trash, settings) so the
  actions are told apart at a glance. These tints label actions; they are not a second
  accent. Never use them as page or button fills.
- **The picker:** one select. Each preset shows a 12px round swatch of its fill before
  its name, with the default first ("Blue (default)"). The last option, "Custom colour",
  reveals a colour picker. Its helper text says that a colour too light for white text
  is darkened until the text is readable.

## 4. Typography
- Space Grotesk for all interface text. JetBrains Mono for code, consoles, logs, IPs,
  ports, hostnames, IDs, keys and hashes.
- Scale (use only these sizes):
  | Size | Weight | Use |
  |---|---|---|
  | 11px | 500 | micro labels, chart axes |
  | 12px | 500 to 600 | badges, meta, timestamps, tooltips |
  | 13px | 400 to 500 | dense controls, table cells, toolbar search, code |
  | 14px | 400 to 600 | body, inputs, buttons, nav, descriptions; callout headings at 600 |
  | 16px | 500 to 600 | card and section titles, page subtitle, stat labels |
  | 18px | 600 | modal headings |
  | 20px | 600 | page title |
  | 24px | 600 | one headline number per card, max |
- Weights 400, 500 and 600 only. No italics in interface text.
- Line height: 1.5 for body text, 1.25 for headings, 1.6 for code and logs.
- Use sentence case everywhere, including buttons, tabs and headings.
- Use tabular numbers (`font-variant-numeric: tabular-nums`) for any value that updates
  live or lines up in columns.
- Use uppercase with 0.1em letter-spacing only for footer or legal text.
- Limit reading text to 70ch per line.

## 5. Spacing, sizing and radius
- 4px base scale. Use only 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Page padding: 16px on phones, 24px on tablets, 32px on desktop.
- Vertical rhythm:
  - 24px between sections.
  - 16px between fields.
  - 8 to 12px inside a group (a label and its control, a row's parts, button groups).
- Card padding: 24px, or 16px on phones.
- Heights:
  - buttons and nav rows: 44px
  - inputs: 40px
  - toolbar controls: 36px
  - icon buttons: 36×36px
  - badges: about 24px
- Touch targets: at least 44×44px on phones, which may mean a larger hit area than the
  visible control.
- Radius follows the scale in §2. Nested elements never share their parent's radius
  (e.g. a 16px card holds 8px inputs).

## 6. Layout and responsive behaviour
- **Breakpoints:** 640 / 768 / 1024 / 1280px. Design at 390px first, then check 768,
  1024 and 1440.
- **Shell:**
  - From 1024px up: a fixed 256px sidebar on --sidebar, with content to its right.
  - Below 1024px: the sidebar becomes a slide-in drawer opened from a menu icon button
    in a slim top bar.
  - The sidebar is the same on every page: 256px, one shared sliding pill for the nav
    rows (§9), 24px icons with a 10px label gap and 14px horizontal inset.
  - Content is capped at 1280px and centred within the content area.
- **Page structure, top to bottom:**
  1. Breadcrumbs (optional).
  2. Page header: title, optional one-line subtitle, page actions.
  3. Content sections.
  Never put a second header bar inside the content.
- **Lists:** with up to about 6 items, use full-width stacked rows instead of a card grid.
  Use a grid only for many uniform items, with 2 columns from 768px and 3 from 1280px,
  and never a single lonely card in a wide grid.
- **Forms:** a single column, max 640px wide. Put two related short fields side by side
  only from 768px up.
- **No horizontal page scroll** at any width. Wide content (code, tables) scrolls inside
  its own container.
- **Toolbars:** stay on one row from 768px up and wrap only on phones. Enforce this in CSS
  with a media query, not with a JS breakpoint, so the first paint cannot flash two rows.
- **No dead space:** if a layout leaves an empty area, fill it with useful related
  information (usage, status, recent activity, a short help card) or tighten the layout.
  Don't stretch a single item across the screen or leave half the screen empty.
- **Sticky elements:** at most the top bar on phones and a form's save bar when the
  form is long. Nothing else floats.

## 7. Surfaces and elevation
- Layer order: page background → sidebar → --raise cards and rows → --raise-2 controls
  inside them.
- Dropdowns, popovers and tooltips sit on --menu with the menu shadow. Modals and toasts
  sit on --modal with the modal shadow.
- Elevation exists only on menus, tooltips, modals and toasts:
  - menu / tooltip: `0 20px 25px -5px rgb(0 0 0/.25), 0 8px 10px -6px rgb(0 0 0/.25)`
  - modal / toast: `0 25px 50px -12px rgb(0 0 0/.5)` plus a 1px --hairline ring
  - primary button: `0 1px 3px rgb(0 0 0/.1)`, and nothing else gets a shadow
- Modal backdrop: black at 60% opacity, no blur.

## 8. Iconography
Icons stay wherever they help people recognise, scan or act faster. They go only where
they are decoration.

**Style**
- Use one outline icon set throughout (e.g. Tabler or Heroicons outline), stroke 1.75,
  currentColor. Never mix sets, mix filled and outline icons, or use emoji as icons.
- Sizes: 24px in the sidebar nav and a callout's status icon; 20px in icon buttons and
  toolbars; 16px inside buttons, inputs, menus, badges and dense rows; 32px only for an
  empty state.
- Colour: icons take the colour of their text. Only status icons use status colours, and
  only active nav icons use the accent (--accent-icon). The dense toolbar is the one
  exception: each action icon takes the colour of its tile's accent or status tint (§9).
- Gap between icon and label: 8px (10px in nav rows), vertically centred on the text.
- Within one group (a nav, a menu, a toolbar), either every item has an icon or none does.

**Where icons belong**
- **Navigation:** a leading icon on every sidebar row, menu item and phone tab. Nav icons
  are --text-faint, --text-body on hover, --accent-icon when active.
- **Icon-only quick actions:** close, back, menu, search, copy, edit, delete, refresh,
  download, upload, power/start/stop/restart, settings, filters, external link. Each one
  has an aria-label and a tooltip.
- **Buttons where the icon speeds recognition:** create (+), download, upload, start/stop,
  copy, and a trailing ↗ on links that leave the app. Put a 16px icon before the label.
  Most buttons stay text-only; don't give every button an icon.
- **Status:** a 16px status icon next to the status word in badges, toasts and inline
  validation, and a 24px one at the start of a callout (check = success, triangle =
  warning, circle-x = error, circle-i = info).
- **Affordances:** chevrons for expand/collapse and selects, sort arrows in table
  headers, drag handles, the clear (×) in inputs.
- **Input adornments:** search magnifier, show/hide password, calendar on date fields.
- **Empty states:** one optional 32px outline icon in --text-faint above the message.
- **Content (always allowed):** logos, flags, product and app icons, file-type icons,
  avatars.

**Where they don't**
- Decoration: icons in coloured boxes or circles, oversized hero icons, illustrations,
  background glyphs. The dense toolbar's functional action tints are the one exception.
- An icon on every section heading, card title or stat label.
- Icon-only buttons for rare or ambiguous actions. If the meaning isn't instantly clear,
  use a text button.
- Icons on some items of a group but not on others.

## 9. Components

### Buttons
| Type | Look | Hover | Use |
|---|---|---|---|
| Primary | pill, 44px min-height, 20px horizontal padding, 14px/500 white on --accent, 1px button shadow | --accent-hover | the single most important action in a view |
| Secondary | same shape on --raise-2, white text | --raise-3 | every other action |
| Danger (confirm only) | same shape on --danger, white text | slightly brighter | only as the confirm button inside a destructive confirmation dialog |
| Text link | --accent-text, no underline | --accent-glow, underline | navigation inside text, low-emphasis actions |
| Icon button | 36×36px, --radius-sm, transparent, 20px --text-body icon | --raise background, white icon | quick actions per §8 |

- Primary and secondary buttons may have a 16px icon before the label for create,
  download, upload, start/stop or copy (§8). Links that leave the app get a trailing ↗.
- Pressed: `transform: scale(0.97)`.
- Disabled: 50% opacity, no hover, `cursor: not-allowed`.
- Loading: the button keeps its width, replaces its label with a 16px spinner in
  currentColor, and is disabled.
- Buttons size to their content. They are full-width only as the single submit button of
  a phone form.
- Button groups: 8px gap, primary last (right) in dialogs, first (left) under forms.
- Dense toolbar actions are the one exception to the pill: 36px rounded rectangles with
  an 8px radius, matching the icon tiles (§9).

### Form controls
- **Input / textarea / select:**
  - 40px tall, 14px text, 12px horizontal padding.
  - --sunken background, --radius-sm, 1px --hairline ring. White text; placeholder in
    --text-faint.
  - Optional 16px adornment icons in --text-faint: a search magnifier at the start,
    show/hide password, calendar or clear (×) at the end.
  - Focus: 2px --accent-text ring.
  - Error: 1px --danger-text ring, with a 16px error icon and a message in 13px
    --danger-text below the field, replacing the helper text.
  - Disabled: 50% opacity.
- **Label:** 14px/500 white, 8px above the control. Mark required fields with a `*` in
  --danger-text and 600 weight, 2px after the label. Don't mark optional fields.
- **Helper text:** 13px --text-muted, 8px below the control.
- **Select dropdown:** --menu panel, --radius-xs, menu shadow, a chevron at the end of
  the field. Options are 36px rows; hover --raise; the selected option shows a check icon
  and white text. Add a search field at the top when there are more than 10 options.
- **Toggle:**
  - 44×24px pill track with a white 20px thumb.
  - Off: --raise-3 track with a 1px rgb(255 255 255/.12) border; hover rgb(255 255 255/.2).
  - On: --accent track, no border.
  - 200ms transition. The label sits to the right and is clickable.
- **Checkbox:** 16px, --radius-2xs, --sunken with a --hairline ring. Checked: --accent
  fill with a white check. Same focus ring as inputs.
- **Radio:** 16px circle, same states as the checkbox. Checked: --accent fill with a
  white 6px centre dot.
- **Segmented choice (2 to 4 options):** a row of secondary-style pills. The selected pill
  is --accent-soft with --accent-text.

### Navigation
- **Sidebar rows:**
  - 44px min-height, 8px × 14px padding, --radius-md; a 24px icon in --text-faint,
    a 10px gap, then the 14px/500 --text-body label.
  - The rows themselves stay transparent. One shared pill (--raise fill, 1px --hairline
    border, --radius-md) slides between them over 220ms
    cubic-bezier(0.16, 1, 0.3, 1), following the hovered row and returning to the active
    row when the pointer leaves; only the row under the pill reads bright.
  - Active: --accent-text label and --accent-icon icon while the pill rests on it. While
    another row is hovered, the active row dims to --text-body with a --text-faint icon.
  - When the active page is inside a folded group, the group's own row carries the pill.
- **Groups:** a 12px/500 --text-muted group label (no icon). Expandable groups have a
  chevron at the end. Keep the visible list short: everyday pages first, then one
  collapsed "More" group for rarely used pages; account settings and the admin area come
  last. Use the same icon set and the same order everywhere.
- **Breadcrumbs:** an inline pill on --raise, --radius-md, 8px × 16px padding, 13px
  --text-muted, current page in white, "/" or chevron separators in --text-faint.
- **Tabs (contained):**
  - A strip with a gradient from --raise to transparent (left → right), --radius-lg,
    8px padding.
  - Items: --radius-md, 8px × 12px padding, 14px --text-body, with optional 16px icons
    (on all tabs or none). Hover or active: --raise-2 background with white text.
  - On phones the strip scrolls horizontally inside itself.
- **Tabs (underlined):** a --hairline bottom border. The active item gets a 2px
  --accent-text bottom border and an --accent-text label.
- **Pagination:** previous/next chevron icon buttons plus page numbers as 36px text
  buttons. The current page sits on --raise-2. Show "1 to 20 of 134" in --text-muted.

### Dense toolbars
- A dense toolbar stays on one row from 768px up and wraps only on phones; enforce nowrap
  in CSS with a media query, not a JS breakpoint, so the first paint cannot flash two
  rows.
- Put the actions at the end of the header in a predictable order: create actions first,
  then upload/import, then search, then overflow, then settings. Settings is always the
  rightmost.
- Icon-only header actions are 36×36 square tiles with --radius-sm and a soft 10% tint of
  an existing accent or status colour; the icon carries the colour. No solid fills, and
  settings uses the same tile shape as the rest. This is the one toolbar where tinted
  icon tiles are allowed: they tell actions apart at a glance, they are not decoration.
- Labelled upload/import buttons use the same borderless 36px rounded rectangle and 8px
  radius as the icon tiles, not a pill. They keep their labels until search opens; then
  they collapse to 36×36 icon-only tiles (the label fades and its width goes to zero over
  220ms) so the search field gets the room.
- Search is an icon button towards the right of the action group, before overflow and
  settings. Clicking it expands the input to its left, up to 32rem, taking the remaining
  width; the input has no blue focus ring, because the expansion is the cue.
- Put view switches (list/tree, grid/table) inside the settings popover, not in the
  header. Cross-fade the content with a 6px blur over 280ms when the view changes.

### Threads and comments
- A list item (a post, issue, ticket or suggestion) opens as its own page, never a modal
  or an inline expansion.
- Header: title, status badge, author row (avatar, name, badges), then the body. A cover
  image or concept art sits at the top, full width and capped to the content column.
- Comments are plain-text rows, 8px apart, with the author and badges on the first line.
  An official reply carries a "Staff" badge in that row. No nested comment trees.
- Counts (votes, comments) are quiet meta, not stat tiles.
- Destructive actions are icon buttons where the thing lives: a page-level trash sits
  top-right; a reply's trash sits in its row. They open a confirmation and are never red
  text buttons in the body.
- Lists are row cards, not tables. A create action uses a plus icon; View uses an eye.

### Content containers
- **Card / section:** --raise, --radius-lg, 24px padding, no border, no shadow.
  - Header: title 16px/600 white with no icon, optional description 14px --text-muted
    below it, and section actions right-aligned on the title row.
  - Never put a card inside a card.
- **List row:** full width, --raise, --radius-lg, 16px × 24px padding (16px on phones),
  8px gap between rows, hover --raise-2.
  - Inside: an optional leading content icon (logo, file type, avatar), the primary
    label in 14px/500 white, secondary info in 13px --text-muted, status on the right,
    quick actions as icon buttons at the far right.
  - On phones the row wraps into two lines; it never drops columns silently.
- **Table** (only for genuinely tabular data with 4+ comparable columns):
  - No outer container.
  - Header cells 13px/500 white, with a sort arrow on sortable columns. Body cells
    13 to 14px --text-body.
  - Rows separated by --hairline, row hover --raise.
  - Numbers right-aligned with tabular-nums.
  - On phones, switch to stacked list rows instead of side-scrolling.
- **Key-value list:** a label in 13px --text-muted above a value in 14px white. Values
  that are addresses, ports or IDs are full-width monospace rows with a copy icon button.
- **Stat:** a label in 16px/500 white (no icon) above a value in 24px/600 --accent-text,
  on a --raise card. Use stats only for one or two headline numbers. Anything with a
  limit is a usage bar.
- **Usage bar:**
  - The label row shows the name left and human units right ("4 / 16 GB",
    "1.2 / 4 vCPU").
  - Below it, a 6px pill bar: --raise-2 track, --accent fill. The fill turns --warning
    above 75% and --danger above 90%.
  - Never show raw units like "4096 MB".
- **Callout** (banners and notes: announcements, connection errors, "set up your
  server"):
  - The card's shape: --radius-lg, 16px padding. No border, no start-edge bar, no ring,
    no shadow.
  - One flat fill carries the meaning: a 10% tint of the status colour
    (`color-mix(in srgb, var(--danger) 10%, transparent)`), --accent-soft for an accent
    callout, or plain --raise for a neutral one.
  - Layout: an optional 24px status icon in the status text colour at the start,
    top-aligned with the heading, then a 12px gap and the text column. Heading 14px/600
    white, body 14px --text-muted, both on a 20px line height, 4px apart.
  - Only the fill and the icon take the colour. The text stays on the text ramp.
  - Actions sit in a row 12px below the text: secondary buttons or text links, or the
    view's single primary. A dismissible callout has a close icon button at the end,
    top-aligned with the heading.
  - Use at most one per view. System banners that stack (announcements, connection
    errors) sit 16px apart.
- **Badge:** --radius-sm, 4px × 8px padding, 12px/600, sentence case, never solid.
  - Neutral: --raise-2 background with #f3f4f6 text.
  - Status: the status text colour on a 10% tint of that status colour, always with a
    word ("Running", "Failed"), optionally with a 12px status icon before it.
  - Configured badge: a badge may have a configured label and colour. Use a 10% tint of
    the configured colour and its text tone, keep the label short and sentence case, and
    never make it solid.
- **Code / console / logs:** --bg-bottom background, --radius-md, 16px padding, 13px
  JetBrains Mono, line height 1.6. Scrolls inside itself, with a copy icon button
  top-right.
- **Avatar:** a 32px circle (24px in dense rows). Without an image, show initials in
  12px/600 white on --raise-2.

### Overlays and feedback
- **Dropdown menu:**
  - --menu background, --radius-xs, menu shadow, min-width 192px.
  - Items are 36px rows, 14px --text-body, with optional 16px icons before each label
    (on all items or none). Hover --raise with white text. Items are separated by
    --hairline.
  - A destructive item uses --danger-text (its icon too) and opens a confirmation.
- **Tooltip:** --menu background, --radius-xs, 4px × 8px padding, 12px white text, menu
  shadow, 300ms show delay, a simple caret.
- **Modal:**
  - --modal background, --radius-md, modal shadow, 24px padding.
  - Width: 448px for confirmations, 640px for forms, full-screen sheet on phones.
  - Title 18px/600 white, description 14px --text-muted, a close icon button top-right.
  - Footer: cancel (secondary) on the left, confirm on the right. The confirm button is
    primary, or danger for destructive actions.
  - Escape and the backdrop close it, except during submission.
- **Destructive confirmation:** name the exact thing being destroyed ("Delete
  'backup-03'?"), say what is lost, and make the confirm button say the verb ("Delete
  backup"). Require typing the name only for irreversible, large-impact actions.
- **Toast:**
  - --modal background, --radius-md, modal shadow, 16px padding, max-width 384px.
  - Bottom-right on desktop; top, full width minus 16px, on phones.
  - A 16px status icon in the status colour, then a 14px/500 white title and an
    optional 13px --text-muted line.
  - Auto-dismisses after 5s (errors stay until closed), with a close icon button.
- **Loading:**
  - A 2px --accent-glow bar at the very top of the viewport for page navigation.
  - Skeleton blocks on --raise with a gentle opacity pulse (1.5s) for first loads. No
    shimmer gradients.
  - Inline 16px spinners inside the control that is busy.
  - Never block the whole screen.
- **Empty state:** inside the section it belongs to, centred: an optional 32px outline
  icon in --text-faint, one 14px --text-body line saying what will appear here, and one
  action button if there is a next step. No illustration.
- **Error state:** a 16px error icon and a plain explanation of what happened and what
  to do, with a retry action. Keep the rest of the page usable.
- **Scrollbars:** thin (8px), transparent track, --raise-2 thumb, --raise-3 on hover.

## 10. Interaction states
Every interactive element defines all of these states, using the tokens above:

| State | Treatment |
|---|---|
| Default | as specified per component |
| Hover | one step up the surface ramp (transparent → --raise → --raise-2 → --raise-3) or the accent hover; icons brighten with their text; no movement |
| Focus-visible | 2px --accent-text ring, never removed (the dense toolbar search uses its expansion as the cue) |
| Pressed | `scale(0.97)` on buttons only |
| Selected / active | The shared nav pill sits on the row (neutral --raise) with an --accent-text label and --accent-icon icon; it dims to --text-body while another row is hovered. Elsewhere --accent-soft + --accent-text, or an --accent-text underline for tabs |
| Disabled | 50% opacity, no hover, `not-allowed` cursor, still readable |
| Loading | spinner inside the control, width preserved, disabled |
| Error | --danger-text ring or text with an error icon and a message |

## 11. Motion
- 150ms ease for colour, background and border. 200ms for toggles, drawers and
  expanding groups. 220ms cubic-bezier(0.16, 1, 0.3, 1) for the sidebar's sliding pill.
  100ms for press.
- Modals and menus fade in and scale from 0.98 to 1 over 150ms. Chevrons rotate 180°
  over 200ms when a group expands. A view switch cross-fades its content with a 6px
  blur over 280ms.
- No hover lift, bounce, parallax, entrance animation for content, or looping
  animation (except spinners and skeleton pulse).
- Respect `prefers-reduced-motion`: remove the scale and transform effects and keep
  only the fades.

## 12. Writing and data
- **Voice:** short, plain and specific. Sentence case. No exclamation marks, "Please",
  "Oops", or jargon the reader doesn't need.
- **Buttons** are verbs, or a verb plus an object: "Save changes", "Create project",
  "Delete backup". Never "OK", "Submit" or "Yes".
- **Errors** say what happened and how to fix it: "That name is taken. Try another." not
  "Validation error".
- **Status** words are the same everywhere (e.g. Running / Starting / Stopped / Failed),
  each with one status colour and one status icon.
- **Numbers:** human units with one decimal at most ("1.5 GB", "3 h 20 min"), thousands
  separators, and tabular numbers in columns.
- **Dates:** relative for the last 7 days ("2 hours ago", "yesterday"), absolute after
  that ("12 Oct"), with the full timestamp in a tooltip.
- **Identifiers:** IDs, IPs, ports and keys are monospace, with a copy icon button and a
  "Copied" tooltip for 2s after copying.
- **Truncation:** end with an ellipsis and show the full text in a tooltip. Never
  truncate identifiers in the middle of something the user must copy.

## 13. Charts
- One series: an --accent line (2px) with an --accent-tint area underneath. Several
  series: the accent first, then neutral greys (--text-muted, --text-faint). Use status
  colours only for thresholds or status meaning.
- Gridlines in --hairline. Axis labels 11px --text-faint, with at most 5 ticks per axis.
- Tooltips use the tooltip style, with values in human units.
- No 3D, gradients beyond the area tint, shadows, or legends when only one series is
  shown.
- Show a threshold line (dashed, in the status colour) when a limit matters.

## 14. Accessibility
- Text contrast at least 4.5:1, large text and UI parts at least 3:1. --accent-text
  exists for this: never use --accent as text on dark surfaces.
- A visible focus state on every interactive element, normally the 2px --accent-text
  ring. Logical tab order. No keyboard traps; modals trap focus and return it on close.
  The dense toolbar search is the one exception: its expansion and caret are the focus
  cue, not a blue ring.
- Use semantic elements: real `<button>`, `<a>`, `<label>`, `<table>` and heading
  levels in order.
- Every icon-only control has an `aria-label` and a tooltip. Icons next to a visible
  label are `aria-hidden="true"`. Status never relies on colour or icon alone; it always
  includes a word.
- Hit areas are at least 44×44px on touch devices.
- Announce toasts with `aria-live="polite"`, errors with `assertive`.
- Support 200% zoom without loss of content or horizontal page scroll.

## 15. Hard rules (non-negotiable)
1. **No gradients**, except the page background and the contained tab strip. Buttons,
   text, borders and every other background are flat.
2. **No decorative backgrounds:** no blurred blobs, glows, floating shapes, dot or grid
   patterns, noise, grain, or any filler that isn't content.
3. **Purposeful icons only.** Keep icons that help people recognise, scan or act:
   navigation, quick actions, status, affordances, input adornments, and content such as
   logos and flags (§8). Remove decorative ones: glyph boxes, illustrations, and an icon
   on every heading or stat label. Every icon-only control has an aria-label and a
   tooltip.
4. **No drop shadows or glassmorphism:** no `backdrop-filter`, no coloured or glowing
   shadows, no hover lift. Elevation only on menus, tooltips, modals and toasts.
5. **Match the system exactly:** only these tokens, sizes, radii and component specs.
   No new colours, fonts or component styles.
6. **One primary action per view:** at most one filled accent button visible at a time.
   Everything else is secondary, a text link or an icon button. Destructive actions are
   secondary on the page; filled red appears only on the confirm button of the
   confirmation dialog.
7. **Consistent placement:**
   - Page actions in the page header (right on desktop, under the title on phones).
   - Section actions on the section's title row.
   - Form submit buttons below the form, start-aligned.
   - Dialog actions in the dialog footer.
   - Quick actions next to the thing they change.
8. **Low density without clutter:** group with whitespace, not borders or coloured
   blocks. Never put a card inside a card. Never give a box both a border and a fill,
   callouts included: no start-edge bars or rings on tinted boxes. Remove redundant
   labels, badges, eyebrows and wrappers.

## 16. Anti-patterns (never ship these)
- A ⋮ overflow menu hiding only two or three actions. Show them as icon buttons instead.
- Narrow tables squeezing values together ("host:20000" next to "22" reading as
  "2000022"). Use full-width rows.
- Stat tiles for values that have a limit. Use usage bars.
- Settings collected on a distant settings page. Put them next to the feature they
  control.
- Long navigation lists. Fold rare pages into a collapsed group.
- Card grids holding one or two items, or layouts leaving half the screen empty.
- Several filled or coloured buttons competing in one view.
- Icons in coloured boxes or circles, illustrations, or an icon on every heading.
- A cryptic icon-only button for a rare action, or icons on some items of a group but
  not others.
- Coloured section headers, eyebrow labels above headings, or "NEW" badges everywhere.
- Callouts with a coloured start bar, an outline ring or large headings on top of their
  tint.
- Hero banners, marketing copy or illustrations inside the working interface.
- Modals for content that could be inline, and confirmations for reversible actions.
- Placeholder text used as the label.
- Lorem ipsum. Always use realistic content.

## 17. Before you finish, check
- [ ] Every colour comes from a token, and changing the accent setting alone re-themes
      everything accent-coloured.
- [ ] Every surface (dashboard, account pages, forms and admin) uses the same shell
      and component language; the working interface has no light theme.
- [ ] Sidebar rows share one sliding pill, the active row dims while another is hovered,
      and nav icons are 24px with a 10px gap.
- [ ] A dense toolbar stays on one row from 768px up without a first-paint flash;
      settings is the rightmost tile and view switches live in its popover.
- [ ] At most one filled accent button is visible in any view, and red fills only appear
      in confirmations.
- [ ] No gradients except the page background and the tab strip, and no glows, blobs,
      blur, patterns or extra shadows.
- [ ] Every icon has a job (navigation, action, status, affordance or content), all
      icons come from one outline set, groups are all-or-none, and icon-only controls
      have an aria-label and tooltip.
- [ ] There is no card inside a card, and no box with both a border and a fill.
- [ ] Every interactive element has hover, focus-visible, pressed, disabled and loading
      states.
- [ ] Empty, loading and error states are designed for every list and data view.
- [ ] At 390px it feels native: 44px targets, a drawer nav, no horizontal page scroll,
      readable without zoom.
- [ ] At 1440px there is no dead space and content is capped at 1280px.
- [ ] Text contrast is at least 4.5:1, accent text uses --accent-text, and status always
      includes a word.
- [ ] Copy is sentence case, buttons are verbs, numbers have human units, and
      identifiers are monospace with copy.

## 18. Implementation in this repository

### Where the tokens live

| Concern | Web panel | In-game menu |
| --- | --- | --- |
| CSS custom properties | `panel/src/globals.css` (`:root`) | `nui/src/styles/menu.css` (`:root`) |
| Utility names | `panel/tailwind.config.cjs` | plain classes in `menu.css` |
| Accent presets and derivation | `shared/accent.ts` | `shared/accent.ts` |
| Applying the accent at runtime | `panel/src/hooks/theme.ts` | `nui/src/styles/applyAccent.ts` |

`shared/accent.ts` is the only place that knows accent colours. `accentTokens()` returns the
eight accent tokens (fill, hover, text, glow, soft, tint, edge, icon). The backend
(`core/lib/theme.ts`) re-exports it, validates stored values with `isValidAccent()`, injects the
configured accent into the panel's `index.html`, and sends the fill hex to the game resource as
`accentColor`.

Tokens beyond the §2 list exist only where the spec names a value without a token:
`--toggle-edge` and `--toggle-edge-hover` (the toggle's off-state border), `--badge-text`
(`#f3f4f6`, the neutral badge text), and the `--*-rgb` channels that let Tailwind build the 10%
status tints (`bg-success/10`). A new token goes into `globals.css`, `tailwind.config.cjs`,
`menu.css` and this file together; a new Tailwind theme key (font size, shadow, radius) also goes
into the `extendTailwindMerge` call in `panel/src/lib/utils.ts`.

### Embedded browser (CEF, Chrome 103)

The in-game menu, and the web panel inside it (the WebPipe iframe), run in CEF on Chrome 103. It
has no `color-mix()`, no `oklch()`, no `dvh`/`svh` units, no container queries and no reliable
native `<select>` popups. Therefore:

- accent soft, tint, edge and icon are concrete comma-form `rgba()` values computed in
  `shared/accent.ts`, and colour math for custom accents runs in TypeScript, never in CSS;
- HTML rendered by the game's connection screen uses comma-form `rgb()`/`rgba()` only;
- the in-game menu never sets `color-scheme` on `:root` or `html` (it lives on `#root` and
  `.modal-backdrop`; see AGENTS.md), and never uses a native `<select>`.

### Tailwind names (web panel)

| Token | Class |
| --- | --- |
| `--accent` / `--accent-hover` | `bg-accent`, `hover:bg-accent-hover` |
| `--accent-text` / `--accent-glow` | `text-accent-text`, `ring-accent-text`, `text-accent-glow`, `bg-accent-glow` |
| `--accent-soft` / `-tint` / `-edge` / `-icon` | `bg-accent-soft`, `bg-accent-tint`, `ring-accent-edge`, `text-accent-icon` |
| surfaces | `bg-sidebar`, `bg-menu`, `bg-modal`, `bg-raise`, `bg-raise-2`, `bg-raise-3`, `bg-sunken`, `ring-hairline` |
| text | `text-white`, `text-body`, `text-muted-foreground`, `text-faint` |
| status | `bg-success/10`, `text-success-text` (same for `warning`, `danger`, `info`) |
| type scale | `text-micro` 11 · `text-xs` 12 · `text-dense` 13 · `text-sm` 14 · `text-base` 16 · `text-lg` 18 · `text-xl` 20 · `text-2xl` 24 |
| radius | `rounded-2xs` 4 · `rounded-xs` 6 · `rounded-sm` 8 · `rounded-md` 12 · `rounded-lg` 16 · `rounded-full` |

`text-accent` is a bug (the fill fails contrast as text); use `text-accent-text`. The Tailwind
config clamps sizes above 24px, weights above 600, every `shadow-*` other than `shadow-button`,
`shadow-menu` and `shadow-modal`, and every `backdrop-blur-*`.

### Components (web panel)

| Need | Use |
| --- | --- |
| Primary action (one per view) | `<Button>`; `loading` keeps its width and shows a spinner |
| Any other action, including destructive ones on a page | `<Button variant="secondary">` (`outline-destructive` for red text) |
| Filled red | only `ConfirmDialog`'s confirm button (`variant="destructive"`) |
| Text link | `<TxAnchor>` or `<Button variant="link">` |
| Icon-only action | `<IconButton label="…" icon={…} />` (20px icon, aria-label and tooltip built in) |
| Card / section | `<Section title description actions>` or `Card` + `CardHeader` |
| Records | `<ListRows>` + `<ListRow>`; never inside a card |
| Addresses, ports, IDs, keys | `<CopyRow value label>` |
| Usage / progress | `<UsageBar label valueLabel="4 / 16 GB" percent>`, `kind="progress"`, `indeterminate` |
| Empty state | `<EmptyState message action icon>` (no surface of its own) |
| Callout and system banner | `<Alert>` (accent), `variant="neutral|info|success|warning|destructive"`; status variants show their icon, `icon={false}` hides it |
| Status badge | `<Badge variant="success|warning|danger|info">Word</Badge>` |
| Page header, breadcrumbs | `<PageHeader title subtitle parentName parentLink>{actions}</PageHeader>`, `<Breadcrumbs items>` |
| Tabs | `Tabs` / `TabsList` / `TabsTrigger` (contained strip), or class `tx-tab-underline` on triggers |
| Modal | `Dialog` (640px) and `AlertDialog` / `ConfirmDialog` (448px); both are full-screen sheets below 640px |
| Dropdown item | `DropdownMenuItem`, `destructive` for a red item that opens a confirmation |
| Toast | `txToast.success(…)` and friends (`components/TxToaster.tsx`) |
| Skeleton | `animate-pulse` on `bg-raise` (1.5s) |

Shell: `layout/MainShell.tsx` caps content at 1280px; `layout/ServerSidebar/ServerMenu.tsx` owns
the sidebar rows and their one sliding pill (§9 Navigation), with `data-nav-state` on each row
wrapper (`idle`, `pill`, `active-pill`); below 1024px the same sidebar renders in the drawer
(`layout/MainSheets.tsx`). `layout/WarningBar.tsx` renders the connection-lost and
update-available banners as callouts at the top of the content. The top loading bar is
`components/TopLoadingBar.tsx`, driven by `trackRequest()` in `panel/src/lib/requestActivity.ts`.

Charts: single-series marks follow the accent and later series use the neutral greys
(`SERIES_COLORS` in `pages/ResourceMonitor/utils.ts`, the dashboard heatmap and player line in
`pages/Dashboard/drawFullPerfChart.ts`). The thread-time histogram and the player-drop
categories keep their own colours because each colour carries a status meaning (fast or slow
ticks, the kind of drop).

### In-game menu

`menu.css` holds every component class; `nui/src/components/ui/` holds the primitives
(`Button`, `IconButton`, `Badge`, `Select`, `Modal`, `icons`). The main page's action list is the
menu's navigation: the selected row carries the one sliding pill and the accent text label. HUD
toasts, announcements, direct messages and restart notices share the toast shape in
`nui/src/components/Hud/Toast.tsx`. The player warning screen is a modal card holding a danger
callout. The connection-screen denial card is an accent callout built twice, in
`rejectMessageTemplate()` (`core/routes/player/checkJoin.ts`) and `buildConnectionCard()`
(`resource/sv_main.lua`); keep them in sync.

### Not yet implemented

- A search field at the top of a select with more than 10 options.
- The dense toolbar with tinted icon tiles (§9 Dense toolbars): no page uses that pattern yet.
- The required-field marker on labels.
