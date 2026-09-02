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
• `dist/` and `monitor.zip` are generated release artifacts and are both untracked by git. Change source files, then rebuild. Never implement a fix directly in `dist/`.

## Product invariants
• Authentication is local only. Administrators sign in with a username and password stored in `admins.json`; there is no external identity provider, OAuth callback, or remote identity API. The first master account is created through `POST /auth/bootstrap`, authorized by the one-time PIN printed on the txAdmin console, and is signed in immediately. Both `/auth/password` and `/auth/bootstrap` stay behind `authLimiter`.
• Panel sessions are persisted to `txData/<profile>/data/sessions.json` with owner-only permissions and must survive a txAdmin restart. The session cookie name is derived from the profile path so a restored session id still matches the cookie the browser holds. A missing, malformed, or version-mismatched file resets the store instead of failing startup, and expired entries are dropped on load, on read, and by the periodic sweep. The session cookie is always `httpOnly` and `sameSite=lax`, and carries `Secure` only when the koa request itself is encrypted; `app.proxy` stays disabled, so `X-Forwarded-Proto` must never be trusted to decide that flag.
• Only the master account may view or change the Discord bot token. Delegated Discord settings changes must preserve the stored token without returning it. Token values must not enter panel URLs, action logs, or non-master command output. Discord embeds must not add the txAdmin branded footer.
• Discord status embeds must not include the legacy txAdmin logo thumbnail. Preserve administrator-configured thumbnail URLs.
• Discord status embed JSON and status configuration JSON are edited in Appearance. Administrators with `settings.appearance` may change only those Discord fields and the existing branding fields through that card; the Discord bot token and connection settings remain in Discord.
• Player-facing kick, ban, shutdown, and connection-deferral messages must never include `[txAdmin]` or visible txAdmin branding. Panel translations and Discord responses present the product as cAdminPanel while internal protocol names remain unchanged.
• Console output, log files, and the FXServer config header must not name txAdmin. The console prefix is `[monitor]`, the startup banner reads `Starting cAdminPanel v<version>`, and generated `server.cfg` blocks are labelled for cAdminPanel. Internal function names, variables, convars, statebags, events, and headers keep their `txAdmin` spelling.
• Connection-screen denial messages render as one accent-headed card. The panel builds it in `rejectMessageTemplate()` inside `core/routes/player/checkJoin.ts`; the monitor resource builds the same card in `buildConnectionCard()` inside `resource/sv_main.lua`, reading `panelName` and `accentColor` from `GlobalState.txAdminServerCtx`. Keep the two in visual sync, escape any interpolated player or server value, and use comma-form `rgb()` so the game browser accepts it. `deferrals.update()` progress text stays plain text.
• User-facing text names the server's own panel, not the product: `panelDisplayName()` in `core/lib/branding.ts` and the `%{panelName}` and `%{serverName}` placeholders injected by `core/modules/Translator.ts` and by the NUI `tBranded()` wrapper. `Powered by cAdminPanel` is the one fixed attribution.
• Administrator records hold no email address. Staff & Permissions creates and edits a local username, an optional Cfx.re identifier, an optional Discord user ID, and the permission set; game identifiers exist for in-game administrator matching and are never a sign-in path on their own.
• Every account manages its own Cfx.re and Discord identifiers in User Settings. Clearing a field unlinks it. Removing a staff member revokes their local panel access and leaves their game identifiers untouched.
• Identifier resolution failures must stop an administrator mutation. Never silently remove or replace an identifier after an external lookup failure.
• Duplicate provider identifiers must be rejected before an administrator record is written.
• Job, Group, Inventory, Garage, and Money are top-level player management tabs. Job, Group, and Garage editors must always render a visible loading, error, locked, or editable state.
• Saving a changed Character Management enabled state reloads the panel so every capability-gated surface receives the new value. When enabled, player detail surfaces must show an explicit loading, empty, permission, or bridge error state instead of silently hiding character tools.
• Character Management is opt-in and never forced. When `cadmin.enabled` is false, or the administrator lacks `cadmin.players.view`, the Players list drops its character column and its character and vehicle metrics, the player detail page drops the cash and vehicle metrics, the five character tabs, the character record card, and the character notice, and the clicked-player modal drops its Character tab. Nothing may request the bridge in that state.
• A successful Character Management connection test means the resource has detected ESX or Qbox and its database preparation has completed. HTTP reachability alone must not be reported as a usable connection.
• Installing Character Management from Settings against a running server applies the change live: the convars are set through commands, then `refresh`, then `ensure cadminpanel`, so a reinstall reloads the files it just wrote. `ensure` is required because `start` on an already-running resource is a no-op. The post-deploy install path deliberately sends no live commands, because `finalizeDeployment` spawns the server immediately afterwards and the written `server.cfg` block is read on boot.
• ESX and Qbox job and group changes must update live player state and durable database state. A restart must not undo a group change.
• Qbox groups are written as ACE principals directly through `add_principal`, `add_ace`, `remove_ace`, and `remove_principal`, in the exact `player.<src>` and `group.<name>` strings qbx_core itself uses, followed by the two `OnPermissionUpdate` events. Do not route them back through qbx_core's deprecated `AddPermission` and `RemovePermission` exports: both guard on the bare ace name while granting the `group.`-prefixed pair, so removal silently no-ops on the grant the add path made. Group names reach a console command, so validate them against `^[%w_%-]+$` in the adapter as well as in the handler. A grant is confirmed by a bounded `Wait(0)` loop, because the ACL can refuse the command outright and leave nothing behind; a release cannot fail and must log when an unrelated ACE still grants the group.
• Those four ACE commands are only permitted to a resource the ACL allows, so `server.cfg` needs `add_ace resource.cadminpanel command.add_principal allow` and the same for `add_ace`, `remove_principal`, and `remove_ace`. `cadminResourceAceLines` in `core/lib/cadminInstaller.ts` is the one definition: the installer writes each line into `server.cfg` and replays it over the FXServer stdin channel, which runs as the console principal, the one context always allowed to edit the ACL. Without the grants every group change is answered with `Access denied for command add_principal` and applies nothing. The adapter's own `aclError` check fails open when `IsPrincipalAceAllowed` is unavailable and gates only the paths that write no ACE, so a misreporting native can never block a change the server would have accepted.
• A group change that leaves a different effective group in place reports that value back to the panel, which warns naming both. Never present an inherited server configuration grant as a completed demotion.
• Qbox ACE cleanup may remove only grants established by cAdminPanel. Preserve inherited grants from server configuration or other resources. Release cAdminPanel-owned grants on character unload, player drop, character mismatch, and resource stop.
• The in-game Players page must preserve its player modal action, filters, sorting, periodic refresh, and unbounded incremental loading. Clicked-player modal loads, WebPipe mutations, and native actions must validate the intended per-connection identity. Preserve that identity through monitor resource restarts, and revalidate it throughout long-running native flows such as spectate.
• Monitor startup must resynchronize every already-connected player into the backend player mirror without recording artificial joins. Kick and ban delivery must carry and validate the selected connection reference; ban must directly drop that live target and may additionally drop sessions matching normalized identifiers.
• On Qbox servers, vehicles spawned from the in-game menu receive keys through the server-side `qbx_vehiclekeys` `GiveKeys` export. Missing or failed key exports must leave the spawned vehicle usable and emit a diagnostic message.
• Direct messages to online players must carry and validate the selected connection reference. In-game announcements deliver once inside the monitor resource after permission validation; the command bridge records the action and sends Discord output without rebroadcasting it.
• Resource reports use the FXServer structured trace as their primary delivery path and retain the HTTP callback as a compatibility fallback. Warm the report cache when the monitor resource starts, accept cached data after a refresh deadline, and clear the cache when FXServer stops.
• The clicked-player modal uses a fresh request for its selected target and must show explicit loading, disconnected, error, and retry states while preserving permission-gated player actions.
• The in-game menu exposes no troll actions or `players.troll` permission. Startup removes stale `players.troll` grants from administrator records.
• Announcement and direct-message notifications use compact communication cards. Avoid duplicate notification icons, oversized wrappers, and decorative outer borders.
• FXServer settings and Master Actions are master-only in navigation, routing, and backend enforcement. Restart scheduling belongs in General settings so delegated settings access does not expose FXServer configuration.
• The sidebar power controls expose Schedule in place of Kick All. When a restart exists, the same control cancels it; when the next configured restart is skipped, it offers Enable. Schedule and cancellation mutations require `control.server` on the backend.
• Master Actions uses the React panel workspace for database backup, cleanup, and allowlist maintenance. Keep destructive actions explicit and confirmed.
• New local administrator accounts always receive a generated temporary password that is shown once and must be changed on first login.
• Administrators cannot reset another registered administrator's local password through Staff & Permissions. Each registered administrator changes their own local password in User Settings.
• Personal language and accent preferences are stored on the administrator account and apply to both the web panel and that administrator's in-game menu across devices. They must not use browser storage as their authority, change server-wide preferences, or reauthenticate unrelated administrators when updated.
• Character Management bridge URLs derive their FXServer port from the active TCP endpoint in server.cfg when no explicit URL is stored.
• Character lookup passes up to 16 distinct `license:` and `license2:` identifiers stored on the txAdmin player record, then merges characters without changing their framework identifiers. Reject ambiguous record associations and larger identifier sets instead of partially merging them. ESX and Qbox adapters accept prefixed and bare table values, including ESX multicharacter suffixes. A resolved character must expose Money, Job, Group, Inventory, and Garage tools according to server-side permissions.
• Player records and framework characters treat the bare values of `license:` and `license2:` as identity aliases. Reuse one uniquely matched player record when the primary prefix changes, reject ambiguous record associations, and expose identifier conflicts instead of silently creating or merging duplicates.
• Punishment details use the responsive React Info, IDs, and Revoke interface. Rejection cards must not embed the legacy tx logo.
• Web and in-game branding share the configured accent and logo. Keep the web panel theme isolated from NUI theme construction while synchronizing branding values through intercom. Route panel branding assets and full page navigations through WebPipe inside NUI, load remote NUI branding only while the authenticated menu is visible, and keep dynamic accent CSS compatible with the embedded game browser.
• The web panel and the in-game menu share their typefaces: Space Grotesk for text and JetBrains Mono for identifiers and code. NUI loads them through `@fontsource-variable` imports in `nui/src/index.css`, declares the families once in `nui/src/styles/nuiTokens.ts` as `fontSans` and `fontMono`, and applies `fontSans` through `typography.fontFamily` in both MUI themes because MUI components ignore the body rule. The emitted `.woff2` files ship through the `files { 'nui/**/*' }` block of the resource manifest.
• Existing installations must boot with their current configuration. There is no version-gated post-update review, no release-notes surface, and no configuration, database, player-drop, or browser-storage migration path; 1.0.0 is the first public release and reads only current formats. Never send an upgraded profile through initial server setup.
• Sidebar entries carry an optional `requires` of `configured` or `online`, evaluated in `panel/src/layout/ServerSidebar/ServerMenu.tsx`. An entry whose requirement is unmet is hidden unless it is the current route, so an open page never disappears under the administrator. Route-level permission checks stay independent of that hiding.
• History is a date-grouped, incrementally loaded activity timeline at `/administration/history`. Preserve search, administrator and action filters, timestamp sorting, URL state, action details, and explicit loading, empty, error, and retry states.
• History search uses a short local debounce, supports keyboard focus and reset controls, and keeps summary refreshes separate from timeline pagination. Timeline refresh is explicit, and action cards preserve stable render identities while loading more records.
• Every authenticated panel route uses the shared reduced-motion-aware page transition and resets its content scroll position. Long pages expose a keyboard-accessible skip link and a scroll-to-top control. Sidebar groups animate without discarding their mounted links.
• Canonical organization routes are `/administration/history`, `/server/allowlist`, `/system/cfg-editor`, and `/system/panel-log`. The removed `/history`, `/whitelist`, `/allowlist`, `/system/allowlist`, `/server/cfg-editor`, `/system/txadmin-log`, and `/cadmin/*` document routes carry no redirects and must resolve to the panel 404 state.
• There is no Linked Accounts page, sidebar entry, or identity API. Character work reaches the bridge only through the player management surfaces.
• The optional `general.publicPanelUrl` setting lives in General settings, accepts `http` or `https`, and is stored without trailing slashes. It only fills the `cadmin_panel_url` convar for the game resource, so a plain-port or private address is valid and the field must never be constrained to HTTPS.
• Recipe deployment uses the React panel at `/server/deployer`. Preserve all four resumable stages, master-only backend enforcement, recipe and CFG editors, live progress, cancellation, refresh recovery, and the post-deploy Character Management decision.
• `BUNDLED_RECIPES` in `core/deployer/bundledRecipes.ts` mirrors the recipes upstream txAdmin ships in `citizenfx/txAdmin-recipes` (`indexv4.json` and `indexv5.json`), minus `default-fivem-enhanced`: cAdminPanel is not compatible with FiveM Enhanced, so that template must stay out of the list even when syncing against upstream. Every entry is fetched over the network at deploy time as a trusted source. Only add one after confirming its `$engine` is at least `RECIPE_DEPLOYER_VERSION` and every action it uses exists in `recipeEngine.js`. `tags[0]` carries the game, because the wizard filters on it when `TXHOST_GAME_NAME` forces one; keep an entry tagged `redm` present, or a RedM host reaches the template step with nothing to pick. `framework` must stay `none` unless an adapter for it exists under `resource/cadminpanel/server/framework/`, so QBCore stays `none`: the Qbox adapter detects `qbx_core`, not `qb-core`, and a non-`none` value promises a post-deploy Character Management install that would never report ready.
• RedM is a supported target, not a best effort. `IS_FIVEM` in `resource/shared.lua` and `useIsRedmValue()` in the NUI are the game flags, and `fxsRuntime:gameName` is the backend one. A native that rdr3 renamed must be resolved by name, as `NetworkSetEntityInvisibleToNetwork or NetworkSetEntityOnlyExistsForParticipants` is, never by an assumed hash and never by calling the FiveM name unguarded: a nil call aborts the handler mid-toggle and can leave an administrator invisible and frozen. Every state a game-gated block sets must be cleared on all exit paths, including early returns.
• RedM registers no keymappings, because `cl_base.lua` gates them on `IS_FIVEM`. It also has no `redm://` protocol handler, is not listed on `servers.fivem.net`, supports only OneSync On, resets no world area, and has no framework bridge adapter, since both ESX and Qbox are FiveM frameworks. Copy or a link that assumes any of those must be game-aware or stated as FiveM-only, and a string added for one game needs its key in every file under `locale/`. The fallbacks that reach the in-game menu and the panel title, in `core/lib/branding.ts` and `core/modules/FxRunner/utils.ts`, must stay game-neutral.
• Both NUI themes are selected wholesale in `nui/src/index.tsx`, so a component that hardcodes a FiveM colour paints RedM in the wrong palette. Read the live theme through `sx` callbacks and `alpha()`, and mirror a `components` override added to one theme in the other.
• The setup and deployer data routes know the live `TxConfigState`; the cached one in the panel may be seconds behind. A route that answers with a redirect must have its state written through `useSetTxConfigState` before navigating, otherwise the stale value bounces the administrator straight back and the resulting `useEffect` loop surfaces as React error #185. Per-mount `useRef` guards cannot break that loop, because `MainRouterInner` keys the page subtree on the location and remounts it.
• Both Monaco editors read their palette from `editorThemeColors` in `panel/src/lib/monacoTheme.ts`. Defining the colours per page let the gutter and the editor background drift apart; keep the single shared record.
• The Diagnostics page, report routes, and process collectors are removed. The encrypted runtime heartbeat may collect only its lightweight cached OS and CPU description through `core/lib/host/getHostStaticData.ts`.
• File downloads use authenticated API requests with CSRF protection and save blobs without navigating away from the React panel. Do not restore HTML logout or download pages.
• The exact attribution `Powered by cAdminPanel` appears only in panel footers.
• HTTP responses and client-facing error bodies name the product without its version. Version disclosure stays on the console, in the log header, and in the authenticated panel.

## Change routing
• For an API or socket contract change, update `shared/` first, then update every producer and consumer in `core/`, `panel/`, and `nui/`.
• Authentication work commonly spans `core/modules/AdminStore/`, `core/modules/WebServer/`, `core/routes/authentication/`, `shared/`, `panel/src/pages/auth/`, and `panel/src/pages/UserSettingsPage.tsx`. Session persistence lives in `core/modules/WebServer/middlewares/sessionMws.ts`.
• Player character management commonly spans `panel/src/pages/PlayerManagement/`, `panel/src/pages/CAdmin/`, the core cAdmin API, and `resource/cadminpanel/`. Capability gating for it lives in `PlayerManagementPage.tsx`, `PlayerDetailPage.tsx`, and `panel/src/layout/PlayerModal/PlayerModal.tsx`, each combining `window.txConsts.cadminEnabled` with `cadmin.players.view`.
• Player-facing branding work spans `core/lib/branding.ts`, `core/lib/theme.ts`, `core/modules/Translator.ts`, `core/routes/player/checkJoin.ts`, `resource/sv_main.lua`, `resource/sv_ctx.lua`, and the NUI translation wrapper.
• In-game menu work belongs in `nui/src/` and the corresponding Lua handlers under `resource/menu/` when behavior changes.
• Keep permission enforcement server-side. Client-side hiding and disabled states are usability measures only.
• Preserve user changes in a dirty worktree. Inspect `git status` and the relevant diff before editing, and avoid unrelated cleanup.
• Update this AGENTS.md after every functional change. Record new product invariants, cross-workspace routing, validation requirements, or operator behavior introduced by the change before handoff.

## Development commands
Run commands from the repository root unless a workflow says otherwise.

```powershell
npm.cmd run test -w core -- run
npm.cmd run test -w panel -- run
npm.cmd run typecheck --workspaces
npm.cmd run build -w nui
npm.cmd run build -w panel
```

• The trailing `-- run` is required. Without it vitest starts in watch mode and never exits.
• `npm run typecheck --workspaces` covers core, nui, and panel. The `shared` workspace prints `Typechecked as part of the core, panel and nui projects. Skipping...`; report that as a documented skip rather than a pass.

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
