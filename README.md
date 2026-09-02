# cAdminPanel

A self-hosted web panel and in-game menu for managing a FiveM/RedM server, with first-class
character management for ESX and Qbox built in.

cAdminPanel is a fork of [txAdmin](https://github.com/tabarra/txAdmin) (MIT). It keeps the
monitoring, deployment and moderation tooling of the original and replaces the account layer with
local-only authentication, adds a rebrandable panel, and adds a Character Management module that
reads and writes your framework's character data directly.

## Main Features

**Server management**
- Start/Stop/Restart the FXServer instance or individual resources
- Live console with log file, command history and search
- CFG editor and validator
- Recipe-based server deployer ([docs/recipe.md](docs/recipe.md))
- Scheduled restarts with warning announcements and custom events ([docs/events.md](docs/events.md))

**Monitoring**
- Auto-restart FXServer on crash or hang
- CPU/RAM consumption and server thread performance charts with player count
- Player drop tracking and crash-reason classification
- Combined panel log: server events and administrator actions on one timeline
- Update notices for new cAdminPanel releases and recommended FXServer builds

**Player management**
- Real-time playerlist
- Warning and ban systems with ban templates
- Allowlist (Discord member, Discord role, approved license, admin-only)
- Player notes, play time and session time tracking
- Self-contained player database, no MySQL required

**Character Management** (optional, off by default)
- Detects ESX and Qbox (`qbx_core`) automatically
- View connected and offline characters, jobs, groups and money
- Add/remove/set money, set job, set permission group
- Give inventory items, including `ox_inventory` support
- View and manage a character's garage

**In-game admin menu**
- Player mode: NoClip, God, SuperJump
- Teleport to waypoint, coords, and back
- Vehicle spawn, fix, delete, boost
- Heal yourself or everyone
- Send announcements, show player IDs, reset world area (FiveM only)
- Player search/sort by distance, ID or name
- Go To, Bring, Spectate, Freeze, ban/warn/DM

**Access control**
- Local accounts only: usernames and bcrypt password hashes stored in `txData/admins.json`
- The first master account is created through a one-time PIN printed in the FXServer console
- Granular admin permission system ([docs/permissions.md](docs/permissions.md))
- Full action logging

**Presentation**
- Rebrandable: panel name, logo, favicon, banner and accent colour are configurable in the settings
- Responsive dark-mode web interface

## Running cAdminPanel

cAdminPanel replaces the `monitor` resource that ships inside FXServer.

1. Build the release bundle with `npm run build`, or download a release archive.
2. Replace the `citizen/system_resources/monitor` folder in your FXServer install with the
   contents of `dist/`.
3. Start FXServer **without** any `+exec server.cfg` launch argument.
4. On first boot a `txData` directory is created next to the server binary. Open the URL printed in
   the console, then enter the one-time PIN from the console to create your master account.

Node 22.9 or newer is required to build from source. See
[docs/development.md](docs/development.md) for the development workflow.

## Configuration & Integrations

- Most settings live in the panel's Settings page. Host-level settings such as the TCP interface and
  port are only available through environment variables — see [docs/env-config.md](docs/env-config.md).
- Resources can listen to the server events broadcast by the panel — see [docs/events.md](docs/events.md).
- The in-game menu and its keybinds are documented in [docs/menu.md](docs/menu.md).
- Character Management is disabled until you enable it under Settings → Character Management. While
  it is off, no character routes are registered and no character UI is rendered.

## Telemetry

cAdminPanel inherits txAdmin's runtime statistics payload, which is **kept as-is** so that the
resource stays compatible with the FXServer/Cfx.re tooling that consumes it. What this means
concretely:

- The panel builds a JSON snapshot once a minute containing host and runtime facts: provider name,
  OS distro, CPU model, FXServer boot time, login origins and methods, feature flags, admin **count**,
  allowlist mode, recipe name, player-database size, and performance summaries.
- That snapshot is encrypted (JWE, `RSA-OAEP-256` + `A256GCM`) with a public key compiled into
  [core/modules/Metrics/txRuntime/index.ts](core/modules/Metrics/txRuntime/index.ts). Only the holder
  of the matching private key — Cfx.re, not chyarogroup — can read it.
- cAdminPanel does **not** send it anywhere. The encrypted blob is exposed on the resource's own HTTP
  endpoint at `/stats.json`, and it is FXServer's existing infrastructure that reads it from there.
- It contains no admin names, no player identifiers, no IP addresses, and no configuration secrets.

If you would rather not expose it at all, delete the `/stats.json` branch of `handleHttp` in
[resource/sv_main.lua](resource/sv_main.lua); nothing else depends on it.

## Update Checks

On boot and every 15 minutes after that, cAdminPanel makes two outbound `GET` requests and shows a
notice bar in the panel when either reports something newer than what is running:

- `https://api.github.com/repos/chyarofivem/cAdminPanel/releases/latest` for panel releases.
- `https://changelogs-live.fivem.net/api/changelog/versions/<win32|linux>/server` for the Cfx.re
  recommended FXServer build.

Both are unauthenticated reads. No server, admin or player data is sent; the only thing either host
learns is the requesting IP address and the `User-Agent`, which is `cAdminPanel <version>`. Failures
are ignored and logged only in verbose mode. To disable the checks entirely, remove the
`_txCore.updateChecker = startModule(UpdateChecker);` line from [core/txAdmin.ts](core/txAdmin.ts).

## Contributing & Development

- If you want to build it or run it from source, see [docs/development.md](docs/development.md).
- Please open an issue before starting significant work, so the approach can be agreed up front.
- Translations are plain JSON files under [locale/](locale/) — see [docs/translation.md](docs/translation.md).

## License, Credits and Thanks

- cAdminPanel is licensed under the [MIT License](LICENSE).
- cAdminPanel is a derivative work of **txAdmin** by André Tabarra and contributors, and is
  distributed under the same MIT license. The upstream copyright notice is retained in
  [LICENSE](LICENSE).
- ["Kick" button icons](https://www.flaticon.com/free-icon/users-avatar_8188385) made by
  __SeyfDesigner__ from [www.flaticon.com](https://www.flaticon.com).
- Warning Sounds ([1](https://freesound.org/people/Ultranova105/sounds/136756/) /
  [2](https://freesound.org/people/Ultranova105/sounds/136754/)) made by __Ultranova105__, licensed
  under [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/).
- [Announcement Sound](https://freesound.org/people/IENBA/sounds/545495/) made by __IENBA__, licensed
  under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- [Message Sound](https://freesound.org/people/Divinux/sounds/198414/) made by __Divinux__, licensed
  under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
