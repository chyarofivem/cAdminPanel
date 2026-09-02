## Permission System
The permission system allows you to control which admins can perform which actions.
For instance you can allow one admin to only view the console and kick players, but not restart the server and execute arbitrary commands.
The permissions are saved in the `txData/admins.json` file and can be edited through the *Staff & Permissions* page by the Master admin, or users with `all_permissions` or `manage.admins` permissions.

Some pages are reserved for the Master admin and have no permission of their own, namely the **CFG Editor** and **Master Actions** pages.

### Panel Permissions
- `all_permissions`: Root permission that allows the user to perform any action. When set, this will remove all other permissions.
- `manage.admins`: Create, edit, and remove other admin accounts.
- `settings.view`: View Settings. The Discord bot token remains hidden.
- `settings.write`: Change Settings. Only the master can view or change the Discord bot token.
- `settings.appearance`: Change the panel name, logos, and other appearance settings.
- `console.view`: View the live console.
- `console.write`: Run commands in the console.
- `control.server`: Start/Stop/Restart the server, and manage the restart scheduler.
- `announcement`: Send announcements.
- `commands.resources`: Start/Stop resources.
- `panel.log.view`: View the Panel Log (server events and administrator actions).
- `players.remove_ids`: Remove IDs/HWIDs of a player from the database.

### Character Management Permissions
These only apply when Character Management is enabled in the settings.
- `cadmin.players.view`: View connected characters and their details.
- `cadmin.players.search_offline`: Search characters that are currently offline.
- `cadmin.money.give`: Add or remove money from a character.
- `cadmin.money.set`: Set a character's money to an exact value.
- `cadmin.job.set`: Change a character's job.
- `cadmin.group.set`: Change a character's permission group.
- `cadmin.inventory.give`: Give items to a character.
- `cadmin.garage.view`: View a character's garage.
- `cadmin.garage.manage`: Modify a character's garage.

### In-Game Permissions
- `menu.vehicle`: Spawn/Fix vehicles.
- `menu.clear_area`: Reset a world area.
- `menu.viewids`: View player IDs in-game.
- `players.direct_message`: Send direct messages.
- `players.whitelist`: Add a player to the allowlist.
- `players.warn`: Warn a player.
- `players.kick`: Kick a player.
- `players.ban`: Ban/Unban a player.
- `players.freeze`: Freeze a player's ped.
- `players.heal`: Heal self or everyone.
- `players.playermode`: Toggle NoClip, God Mode, or Superjump.
- `players.spectate`: Spectate a player.
- `players.teleport`: Teleport self or a player.
