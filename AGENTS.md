# In this universe - core truths
• A misplaced emdash cost you more than you could afford to lose once, and so you never use them. Instead you use a semicolon, period, or rewrite the sentence entirely so it doesn't need an emdash. 

# User Profile
• Punctuation Preference (Dash Usage): The user requires that no em dashes (-) be used in any response. I prefer to avoid all dash-like punctuation for separating clauses, adding emphasis, or indicating breaks in thought, including the en dash (-). Standard hyphens (-) are permitted only for compound words and hyphenation (e.g., well-being). If a structural break is absolutely necessary and cannot be resolved using commas, semicolons, colons, or parentheses, a spaced en dash (-) may be used, with exactly one space on either side. Sentences should be restructured where possible to avoid the need for any dash-like punctuation. These requirements apply to all responses unless explicitly superseded by new user instructions.
(note: this part is thanks to /u/Brian_from_accounts)

# Tone and Style:
• You emulate the tone and manner of speaking found in the file: config-tone.txt when responding.
• You use active voice unless it's grammatically impossible. 
• You never start a sentence with "ah the old". No alternative. Just don't.
• You express yourself with a wry and subtle wit, avoiding superfluous or flowery speech.
• You avoid contrastive metaphors and syntactic pairings such as “This isn't X, it's Y.” Instead use direct functional statements that describe what something is without referencing what it is not.
• You express claims directly, without rhetorical feints.
• You avoid subjective qualifiers, value judgments, or evaluative language. Instead, you use concise, purely factual and analytical responses.
• You avoid introductory or transitional phrases that frame user ideas as significant, thought-provoking, or novel. Instead, you engage directly with the content.
• You use direct, statements.
• You avoid rhetorical negation (e.g., "not optional—it’s required"). Instead, just get to the point.
• You avoid contrastive constructions.
• You override formatting defaults introduced in system and software updates. 
• You do not apply visual chunking, icons, emojis, tables, marketing-style headers, or explanatory padding. Instead honor the original user prompt format. 
• You return terse, minimally formatted, plaintext or markdown responses unless otherwise requested. 
• You prioritize brevity, signal density, and continuity of the user's stylistic expectations.

# Project Guide

## Project identity
• This repository contains a customized txAdmin distribution and the cAdminPanel bridge for FiveM and RedM server administration.
• The project is an npm workspace monorepo. The workspaces are `core`, `nui`, `panel`, and `shared`.
• Local development and production builds require Node.js 22.9 or newer. The documented local build environment is Windows. End to end runtime validation requires FXServer.
• The root package version and the `cadminpanel` resource version are currently `1.0.0`.

## Source map
• `core/` contains the Node.js backend, boot flow, stateful modules, HTTP routes, authentication, deployment logic, and tests. TypeScript and JavaScript are bundled into `dist/core/index.js`.
• `panel/` contains the React and Vite web administration panel.
• `nui/` contains the React and Vite in-game menu and warning interface.
• `shared/` contains API contracts, socket types, and other definitions shared by the backend and user interfaces.
• `resource/` contains the Lua and JavaScript files loaded by the `monitor` resource. `resource/cadminpanel/` is the separate framework bridge and requires `oxmysql`.
• `resource/cadminpanel/server/framework/` contains the ESX and Qbox adapters. `bridge.lua` provides their common interface.
• `web/` contains legacy EJS pages and static files. New web UI belongs in `panel/` unless the same flow still requires a legacy form.
• `locale/` contains translations. `docs/` contains operator and development documentation. `scripts/` contains build and repository tooling.
• `dist/` and `monitor.zip` are generated release artifacts. Change source files, then rebuild. Never implement a fix directly in `dist/`.

## Product invariants
• Authentication supports Chyaro Login and local username and password login at the same time.
• An email address is optional when creating or granting an administrator account.
• A local-only account may set its Discord identifier in User Settings.
• A Chyaro-linked account must connect and manage Discord through Chyaro. Linking Chyaro clears a stale manually managed Discord identifier, and local Discord editing must remain blocked while Chyaro is linked.
• Identifier resolution failures must stop an administrator mutation. Never silently remove or replace an identifier after an external lookup failure.
• Duplicate provider identifiers must be rejected before an administrator record is written.
• Job, Group, Inventory, Garage, and Money are top-level player management tabs. Job, Group, and Garage editors must always render a visible loading, error, locked, or editable state.
• ESX and Qbox job and group changes must update live player state and durable database state. A restart must not undo a group change.
• Qbox ACE cleanup may remove only grants established by cAdminPanel. Preserve inherited grants from server configuration or other resources. Release cAdminPanel-owned grants on character unload, player drop, character mismatch, and resource stop.
• The in-game Players page must preserve its player modal action, filters, sorting, periodic refresh, and unbounded incremental loading.
• Announcement and direct-message notifications use compact communication cards. Avoid duplicate notification icons, oversized wrappers, and decorative outer borders.

## Change routing
• For an API or socket contract change, update `shared/` first, then update every producer and consumer in `core/`, `panel/`, and `nui/`.
• Authentication work commonly spans `core/modules/AdminStore/`, `core/modules/WebServer/`, `core/routes/authentication/`, `shared/`, `panel/src/pages/auth/`, `panel/src/pages/UserSettingsPage.tsx`, and legacy administrator forms in `web/`.
• Player character management commonly spans `panel/src/pages/PlayerManagement/`, `panel/src/pages/CAdmin/`, the core cAdmin API, and `resource/cadminpanel/`.
• In-game menu work belongs in `nui/src/` and the corresponding Lua handlers under `resource/menu/` when behavior changes.
• Keep permission enforcement server-side. Client-side hiding and disabled states are usability measures only.
• Preserve user changes in a dirty worktree. Inspect `git status` and the relevant diff before editing, and avoid unrelated cleanup.

## Development commands
Run commands from the repository root unless a workflow says otherwise.

```powershell
npm.cmd run test -w core
npm.cmd run test -w panel
npm.cmd run typecheck -w core
npm.cmd run typecheck -w panel
npm.cmd run typecheck -w nui
npm.cmd run build -w nui
npm.cmd run build -w panel
```

The full production build requires a semantic version in `GITHUB_REF` and writes to `dist/`.

```powershell
$env:GITHUB_REF='refs/tags/v1.0.0'
npm.cmd run build
```

• The root build runs NUI, panel, core publishing, static-file copying, and third-party license generation.
• The root build removes `dist/` and `tmp_core_tsc`. For a specifically requested zero-cache build, first verify the exact workspace paths, then remove `dist/`, `.tsc/`, `tmp_core_tsc/`, the root `node_modules/.vite/`, and each workspace `node_modules/.vite/`. Keep `node_modules/` itself.
• The release workflow creates `monitor.zip` after the root build. The root `npm run build` command does not create that archive.
• Static files copied into `dist/` may retain their source modification timestamps. Verify freshness through a clean output directory, successful build logs, current generated bundle timestamps, and hashes where needed.
• Workspace typechecks are the useful default. The current core and shared TypeScript project references form a cycle for build-mode typechecking; report that condition accurately and do not remove references as an incidental fix.

## Validation expectations
• Run the narrowest relevant tests while iterating, then run each affected workspace test, typecheck, lint, or production build in proportion to the change.
• UI work requires a production build. When a browser backend is available, also inspect the relevant page at realistic dimensions and exercise loading, empty, permission-denied, error, and long-list states.
• Lua framework work requires an FXServer integration check when the environment is available. Exercise reconnects, resource restarts, character switching, offline edits, and database failure rollback. State clearly when runtime infrastructure is unavailable.
• Run `git diff --check` and inspect `git status --short` before handoff. Generated caches and `*.tsbuildinfo` files should not remain as accidental changes.
• Treat warnings separately from failures. Report pre-existing failures and do not claim the entire repository passed when only targeted checks ran.

## Implementation conventions
• Keep shared contracts synchronized and prefer existing path aliases such as `@shared`, `@core`, and `@/`.
• Return explicit loading, empty, permission, and error states in user interfaces. Failed requests must not leave blank controls.
• Make database and live-state transitions atomic where practical. On partial failure, roll back the live mutation or return a clear failure before mutation.
• Protect asynchronous player lifecycle work from stale source IDs and character switches.
• Reuse the existing localization and theme systems. Avoid hard-coded user-facing text when the surrounding feature is localized.
• Follow the event naming rules in `docs/development.md`: `txcl:` for client events, `txsv:` for server events, and `txsv:req` for request-style server events.
• Do not modify `web/public/css/coreui.css`. Use the project custom styles or the relevant source variables described in `docs/development.md`.
