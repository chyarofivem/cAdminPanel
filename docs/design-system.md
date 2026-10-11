# Design system

The web panel (`panel/`) and the in-game menu (`nui/`) share one design system: a dark, flat,
compact control panel. Near-black surfaces carry thin translucent white layers, and there is
exactly one accent colour, which each administrator can change. Every screen is designed for a
390px phone first and then grows into desktop.

This file is the implementation reference. If a value is missing here, use the closest existing
token or pattern; never invent a colour, font, radius, shadow or decoration.

## Where the tokens live

| Concern | Web panel | In-game menu |
| --- | --- | --- |
| CSS custom properties | `panel/src/globals.css` (`:root`) | `nui/src/styles/menu.css` (`:root`) |
| Utility names | `panel/tailwind.config.cjs` | plain classes in `menu.css` |
| Accent presets and derivation | `shared/accent.ts` | `shared/accent.ts` |
| Applying the accent at runtime | `panel/src/hooks/theme.ts` | `nui/src/styles/applyAccent.ts` |

`shared/accent.ts` is the only place that knows accent colours. The backend (`core/lib/theme.ts`)
re-exports it, validates stored values with `isValidAccent()`, injects the configured accent into
the panel's `index.html`, and sends the fill hex to the game resource as `accentColor`.

### Embedded browser constraint

The in-game menu and the web panel inside it (WebPipe iframe) run in CEF, which tracks Chrome 103.
It has no `color-mix()`, no `oklch()`, no `:has()` in older builds, and no CSS nesting outside
PostCSS. Therefore:

- accent soft, tint and edge are concrete `rgba()` values computed in `shared/accent.ts`;
- colour math for custom accents runs in TypeScript, never in CSS;
- HTML rendered by the game's connection screen uses comma-form `rgb()`/`rgba()` only.

## Tokens

### Accent (the one knob)

| Token | Tailwind | Use |
| --- | --- | --- |
| `--accent` | `bg-accent` | filled primary button, active badge, on-state of switch, checkbox, radio, progress fill |
| `--accent-hover` | `hover:bg-accent-hover` | primary button hover |
| `--accent-text` | `text-accent-text`, `ring-accent-text`, `border-accent-text` | links, focus rings, active tab label |
| `--accent-glow` | `text-accent-glow`, `bg-accent-glow` | hovered link, top loading bar |
| `--accent-soft` | `bg-accent-soft` | active nav row |
| `--accent-tint` | `bg-accent-tint` | callout background |
| `--accent-edge` | `ring-accent-edge` | active outline, text selection |

Never use `--accent` as text: it is a fill colour and fails contrast on dark surfaces.
`text-accent` is a bug; use `text-accent-text`.

What follows the accent: the primary button, links, the active nav row, the active tab underline,
focus rings, on-states of checkboxes, toggles and radios, progress bar fills, the top loading bar
and callouts. What never follows it: status colours, text and surface colours, chart series, logos.

Presets are the Tailwind palettes blue (default), indigo, violet, purple, fuchsia, pink, rose, red,
orange, amber, yellow, lime, green, emerald, teal, cyan and sky, mapped fill = 700, hover = 800,
text = 500, glow = 400. Indigo, violet, purple and red read under 4.5:1 at 500 on the sidebar, so
they use text = 400 and glow = 300.

A custom accent is stored as a lowercase `#rrggbb` string in the same field as a preset id
(`general.accent` for the server, `preferences.accent` for an administrator). Its tokens are
derived in `deriveCustomAccent()`: the fill is darkened in 0.01 OKLCH lightness steps until white
text reaches 4.5:1; hover is lightness -0.065 and chroma x0.85; text is the same hue at lightness
0.68, or 0.75 when 0.68 reads under 4.5:1 on `#1c1e23`; glow is one step lighter than text.

### Surfaces

| Token | Tailwind | Use |
| --- | --- | --- |
| `--bg-top` / `--bg-bottom` | (body) | page background gradient, top to bottom |
| `--sidebar` | `bg-sidebar` | sidebar and drawer |
| `--menu` | `bg-menu` | dropdowns, popovers, tooltips, toasts |
| `--modal` | `bg-modal` | dialogs |
| `--raise` | `bg-raise` | cards, sections, list rows, hover |
| `--raise-2` | `bg-raise-2` | secondary buttons, badges, active tab |
| `--raise-3` | `bg-raise-3` | secondary button hover |
| `--sunken` | `bg-sunken` | inputs |
| `--hairline` | `ring-hairline`, `border-hairline`, `divide-hairline` | dividers, input outline |

### Text

| Token | Tailwind | Use |
| --- | --- | --- |
| `--text` | `text-white` | headings, values, active labels |
| `--text-body` | `text-body` (body default) | body copy, nav labels |
| `--text-muted` | `text-muted-foreground` | descriptions, labels, meta |
| `--text-faint` | `text-faint` | placeholders, footer |

### Status (never follows the accent)

| Token | Tailwind |
| --- | --- |
| `--success` / `--success-text` | `bg-success`, `bg-success/15`, `text-success-text` |
| `--warning` / `--warning-text` | `bg-warning`, `bg-warning/15`, `text-warning-text` |
| `--danger` / `--danger-text` | `bg-danger`, `bg-danger/15`, `text-danger-text` |
| `--info` | `bg-info`, `bg-info/15`, `text-info-text` |

Status is never colour alone: pair it with a word ("Online", "Stopped").

### Type, spacing, shape

- Space Grotesk everywhere; JetBrains Mono (`font-mono`) for consoles, code, IPs, ports, IDs, keys.
- Scale: `text-micro` 11 · `text-xs` 12 · `text-dense` 13 · `text-sm` 14 · `text-base` 16 (card
  title) · `text-lg` 18 (callout heading) · `text-xl` 20 (page title) · `text-2xl` 24 (one
  headline number). Larger sizes are clamped to 24px in the Tailwind config.
- Weights 400, 500, 600 (`font-bold` is clamped to 600). Body line height 1.5, headings 1.25.
- `tabular-nums` on every value that updates live.
- Uppercase with wide letter-spacing only in footer or legal text.
- 4px base scale: 4 · 8 · 12 · 16 · 24 · 32. Page padding 16/24/32px (phone/tablet/desktop).
  Sections 24px apart (`gap-6`). Card padding `p-4 sm:p-6`. Gaps inside a group 8 to 12px.
- Radii: `rounded-xs` 6 · `rounded-sm` 8 · `rounded-md` 12 · `rounded-lg` 16 · `rounded-full`.
- Touch targets at least 44px tall on phones (`min-h-11`).

## Components (web panel)

| Need | Use |
| --- | --- |
| Primary action (one per screen or section) | `<Button>` |
| Any other action, including destructive ones on a page | `<Button variant="secondary">` (`outline-destructive` for red text) |
| Filled red | only `ConfirmDialog`'s confirm button (`variant="destructive"`) |
| Text link | `<TxAnchor>` or `<Button variant="link">` |
| Icon-only action | `<IconButton label="…" icon={…} />` (aria-label and tooltip are built in) |
| Card / section | `<Section title description actions>` or `Card` + `CardHeader` |
| Records | `<ListRows>` + `<ListRow>`; never inside a card |
| Addresses, ports, IDs, keys | `<CopyRow value label>` |
| Usage | `<UsageBar label valueLabel="4 / 16 GB" percent>` |
| Progress | `<UsageBar kind="progress" …>` (always the accent); `indeterminate` when the end is unknown |
| Empty state | `<EmptyState message action>` |
| Callout | `<Alert>` (accent) or `<Alert variant="warning|destructive|success|info">` |
| Status badge | `<Badge variant="success|warning|danger|info">Word</Badge>` |
| Page header | `<PageHeader title subtitle parentName parentLink>{actions}</PageHeader>` |
| Breadcrumbs | `<Breadcrumbs items>` |
| Tabs | `Tabs` / `TabsList` / `TabsTrigger` (strip), or class `tx-tab-underline` on triggers |

Specs the primitives already implement:

- Primary button: pill, min-height 44px, 20px padding, 14px/500 white on `--accent`, hover
  `--accent-hover`, 1px soft shadow, press `scale(0.97)`. Secondary: same shape on `--raise-2`.
- Input: `--sunken`, radius-sm, 1px hairline ring, 14px white text, faint placeholder, 2px
  accent-text ring on focus. Label 14px/500 white above, helper 13px muted below. A toolbar search
  is 36px tall on desktop with 13px text.
- Dropdown: `--menu`, radius-xs, items divided by hairlines, menu shadow.
- Modal: `--modal`, radius-md, modal shadow plus hairline ring, black 60% backdrop, no blur.
  Cancel on the left of the footer, confirm on the right.
- Sidebar: 256px on `--sidebar` from 1024px; a slide-in drawer below. Nav rows 44px, 8x14px,
  radius-md, body text; hover raise + white; active accent-soft + accent-text. Each row has a
  16px lucide icon before its label, muted at rest, white on hover and accent-text when active
  (a deliberate exception to rule 3, requested by the project owner).
- Loading bar: 2px accent-glow at the top of the viewport (`TopLoadingBar`), driven by
  `trackRequest()` in `panel/src/lib/requestActivity.ts`.

## Motion

150ms ease on colour, background and border changes. Buttons scale to 0.97 when pressed, nothing
else. No lift, bounce, parallax or entrance animation; dialogs, popovers and toasts appear without
zoom or slide. The phone drawer is the one surface that slides. The top loading bar and an
indeterminate progress bar run the `loading-bar` motion, the only looping animation. `prefers-reduced-motion` disables
all transitions and animations.

## Rules

1. No gradients except the page background and the tab strip (`tx-tab-strip`).
2. No decorative backgrounds: no blobs, glows, floating shapes, dot or grid patterns, noise.
3. No unnecessary icons. Use an icon only when it replaces a word the user acts on quickly
   (close, delete, back, power, copy), always with an aria-label and tooltip. No icons on
   headings, stat labels or in boxes, no icon + text buttons, no empty-state art. Flags, logos
   and game icons are content. Exception: the web panel's sidebar nav rows carry an icon before
   their label.
4. No drop shadows or glassmorphism. The Tailwind config maps `shadow-sm` to `shadow-2xl` and
   every `backdrop-blur-*` to nothing; only `shadow-menu`, `shadow-modal` and `shadow-button` exist.
5. Only the tokens above.
6. At most one filled accent button visible per screen or section.
7. Page actions in the page header, form submit buttons below the form and left-aligned, modal
   actions in the modal footer.
8. Group with whitespace. Never a card inside a card. Never a box with both a border and a fill
   (the callout's bar is the exception). Remove labels, badges and wrappers that add nothing.

## Layout habits

- With few items, use full-width rows instead of a card grid, and fill leftover space with
  useful information (usage, status, help).
- Put every action one click away next to what it changes. No overflow menu hiding two or three
  actions.
- Addresses, ports and IDs are full-width monospace rows with a copy button.
- Everyday pages on top of the navigation, rarely used ones in the collapsed "More" group.
- Settings live next to the feature they control.
- Empty states: one line of muted text and one action.
- Copy is short, plain and specific: "Server stopped", not "Operation completed successfully".

## Accessibility

- Text contrast at least 4.5:1 (`--accent-text` exists for this reason).
- A visible 2px accent-text focus ring on every interactive element, in a logical order.
- Real buttons and links. Icon-only controls carry an aria-label and a tooltip.

## Review checklist

- [ ] Every colour comes from a token; changing the accent alone re-themes the screen.
- [ ] At most one filled accent button visible in each view.
- [ ] No gradients except the page background and tabs; no glows, blobs, blur or extra shadows.
- [ ] Every icon replaces a word and has an aria-label and tooltip.
- [ ] No card inside a card; no box with both a border and a fill.
- [ ] The 390px layout works: 44px targets, drawer navigation, no horizontal scroll.
- [ ] Contrast at least 4.5:1; accent text uses `--accent-text`.
