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
• `panel/` is the only web administration UI. The legacy `web/` EJS and static tree has been removed and must not be restored.
• `locale/` contains translations. `docs/` contains operator and development documentation. `scripts/` contains build and repository tooling.
• `dist/` and `monitor.zip` are generated release artifacts. Change source files, then rebuild. Never implement a fix directly in `dist/`.

## Product invariants
• Authentication supports Chyaro Login and local username and password login at the same time.
• Only the master account may view or change the Discord bot token. Delegated Discord settings changes must preserve the stored token without returning it. Token values must not enter panel URLs, action logs, or non-master command output. Discord embeds must not add the txAdmin branded footer.
• An email address is optional when creating or granting an administrator account.
• A local-only account may set its Discord identifier in User Settings.
• A Chyaro-linked account must connect and manage Discord through Chyaro. Linking Chyaro clears a stale manually managed Discord identifier, and local Discord editing must remain blocked while Chyaro is linked.
• Identifier resolution failures must stop an administrator mutation. Never silently remove or replace an identifier after an external lookup failure.
• Duplicate provider identifiers must be rejected before an administrator record is written.
• Job, Group, Inventory, Garage, and Money are top-level player management tabs. Job, Group, and Garage editors must always render a visible loading, error, locked, or editable state.
• Saving a changed Character Management enabled state reloads the panel so every capability-gated surface receives the new value. When enabled, player detail surfaces must show an explicit loading, empty, permission, or bridge error state instead of silently hiding character tools.
• A successful Character Management connection test means the resource has detected ESX or Qbox and its database preparation has completed. HTTP reachability alone must not be reported as a usable connection.
• ESX and Qbox job and group changes must update live player state and durable database state. A restart must not undo a group change.
• Qbox ACE cleanup may remove only grants established by cAdminPanel. Preserve inherited grants from server configuration or other resources. Release cAdminPanel-owned grants on character unload, player drop, character mismatch, and resource stop.
• The in-game Players page must preserve its player modal action, filters, sorting, periodic refresh, and unbounded incremental loading. Clicked-player modal loads, WebPipe mutations, and native actions must validate the intended per-connection identity. Preserve that identity through monitor resource restarts, and revalidate it throughout long-running native flows such as spectate.
• Monitor startup must resynchronize every already-connected player into the backend player mirror without recording artificial joins. Kick and ban delivery must carry and validate the selected connection reference; ban must directly drop that live target and may additionally drop sessions matching normalized identifiers.
• Direct messages to online players must carry and validate the selected connection reference. In-game announcements deliver once inside the monitor resource after permission validation; the command bridge records the action and sends Discord output without rebroadcasting it.
• Resource reports use the FXServer structured trace as their primary delivery path and retain the HTTP callback as a compatibility fallback. Warm the report cache when the monitor resource starts, accept cached data after a refresh deadline, and clear the cache when FXServer stops.
• The clicked-player modal uses a fresh request for its selected target and must show explicit loading, disconnected, error, and retry states while preserving permission-gated player actions.
• The in-game menu exposes no troll actions or `players.troll` permission. Startup removes stale `players.troll` grants from administrator records.
• Announcement and direct-message notifications use compact communication cards. Avoid duplicate notification icons, oversized wrappers, and decorative outer borders.
• FXServer settings and Master Actions are master-only in navigation, routing, and backend enforcement. Restart scheduling belongs in General settings so delegated settings access does not expose FXServer configuration.
• The sidebar power controls expose Schedule in place of Kick All. When a restart exists, the same control cancels it; when the next configured restart is skipped, it offers Enable. Schedule and cancellation mutations require `control.server` on the backend.
• Master Actions uses the React panel workspace for database backup, cleanup, and allowlist maintenance. Keep destructive actions explicit and confirmed.
• New local administrator accounts receive a generated temporary password that is shown once and must be changed on first login. When a chyarologin email is supplied, verify that it belongs to a registered chyarologin user and do not generate a local password.
• Administrators cannot reset another registered administrator's local password through Staff & Permissions. Each registered administrator changes their own local password in User Settings.
• Personal language and accent preferences are stored on the administrator account and apply to both the web panel and that administrator's in-game menu across devices. They must not use browser storage as their authority, change server-wide preferences, or reauthenticate unrelated administrators when updated.
• Character Management bridge URLs derive their FXServer port from the active TCP endpoint in server.cfg when no explicit URL is stored.
• Character lookup passes up to 16 distinct `license:` and `license2:` identifiers stored on the txAdmin player record, then merges characters without changing their framework identifiers. Reject ambiguous record associations and larger identifier sets instead of partially merging them. ESX and Qbox adapters accept prefixed and bare table values, including ESX multicharacter suffixes. A resolved character must expose Money, Job, Group, Inventory, and Garage tools according to server-side permissions.
• Player records and framework characters treat the bare values of `license:` and `license2:` as identity aliases. Reuse one uniquely matched player record when the primary prefix changes, reject ambiguous record associations, and expose identifier conflicts instead of silently creating or merging duplicates.
• Punishment details use the responsive React Info, IDs, and Revoke interface. Rejection cards must not embed the legacy tx logo.
• Web and in-game branding share the configured accent and logo. Keep the web panel theme isolated from NUI theme construction while synchronizing branding values through intercom. Route panel branding assets and full page navigations through WebPipe inside NUI, load remote NUI branding only while the authenticated menu is visible, and keep dynamic accent CSS compatible with the embedded game browser.
• Existing installations must boot with their current configuration after an application update. Never send an upgraded profile through initial server setup. Every version change requires one master-only post-update review containing the changelog followed by any server-defined required fields. Persist the acknowledged version only after validation and successful saves. Fresh profiles acknowledge their initial version automatically, other administrators retain access, and unfinished values disable only the feature that requires them.
• Post-update release notes and required field definitions live in `core/lib/updateSetup.ts`; the public contracts live in `shared/updateSetupApiTypes.ts`. Secret fields must stay masked and configuration paths must remain server-controlled.
• History is a date-grouped, incrementally loaded activity timeline at `/administration/history`. Preserve search, administrator and action filters, timestamp sorting, URL state, action details, and explicit loading, empty, error, and retry states.
• History search uses a short local debounce, supports keyboard focus and reset controls, and keeps summary refreshes separate from timeline pagination. Timeline refresh is explicit, and action cards preserve stable render identities while loading more records.
• Canonical organization routes are `/administration/history`, `/server/allowlist`, and `/system/cfg-editor`. The removed `/history`, `/whitelist`, `/allowlist`, `/system/allowlist`, and `/server/cfg-editor` document routes must resolve to the panel 404 state.
• Recipe deployment uses the React panel at `/server/deployer`. Preserve all four resumable stages, master-only backend enforcement, recipe and CFG editors, live progress, cancellation, refresh recovery, and the post-deploy Character Management decision.
• The Diagnostics page, report routes, and process collectors are removed. The encrypted runtime heartbeat may collect only its lightweight cached OS and CPU description through `core/lib/host/getHostStaticData.ts`.
• File downloads use authenticated API requests with CSRF protection and save blobs without navigating away from the React panel. Do not restore HTML logout or download pages.
• The exact attribution `Powered by cAdminPanel` appears only in panel footers.

## Change routing
• For an API or socket contract change, update `shared/` first, then update every producer and consumer in `core/`, `panel/`, and `nui/`.
• Authentication work commonly spans `core/modules/AdminStore/`, `core/modules/WebServer/`, `core/routes/authentication/`, `shared/`, `panel/src/pages/auth/`, and `panel/src/pages/UserSettingsPage.tsx`.
• Version-gated post-update work spans `core/lib/updateSetup.ts`, `core/routes/updateSetup/`, `shared/updateSetupApiTypes.ts`, `shared/authApiTypes.ts`, and `panel/src/pages/UpdateSetup/`.
• Player character management commonly spans `panel/src/pages/PlayerManagement/`, `panel/src/pages/CAdmin/`, the core cAdmin API, and `resource/cadminpanel/`.
• In-game menu work belongs in `nui/src/` and the corresponding Lua handlers under `resource/menu/` when behavior changes.
• Keep permission enforcement server-side. Client-side hiding and disabled states are usability measures only.
• Preserve user changes in a dirty worktree. Inspect `git status` and the relevant diff before editing, and avoid unrelated cleanup.
• Update this AGENTS.md after every functional change. Record new product invariants, cross-workspace routing, validation requirements, or operator behavior introduced by the change before handoff.

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
• `npm run fullcompile` performs the complete production build and then replaces `monitor.zip`. It uses the root package version when `GITHUB_REF` is unset, and every archived path is stored under one top-level `monitor/` directory.
• Static files copied into `dist/` may retain their source modification timestamps. Verify freshness through a clean output directory, successful build logs, current generated bundle timestamps, and hashes where needed.
• Workspace typechecks are the useful default. The current core and shared TypeScript project references form a cycle for build-mode typechecking; report that condition accurately and do not remove references as an incidental fix.
• Panel and NUI typechecks prepare dependency declarations through `scripts/prepare-typecheck.js`. Keep this cross-platform preparation step when shared or core contracts change; direct `tsc` calls can otherwise report TS6305 against a clean `.tsc/` directory.

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
• Keep NUI React contexts explicitly typed and preserve nullable player state at the Recoil boundary. Update browser mocks whenever shared player or server-context contracts change so strict typechecks remain useful.
