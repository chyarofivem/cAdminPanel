# In-Game Menu

cAdminPanel ships with an in-game menu equipped with common admin functionality,
an online player browser, and a slightly trimmed down version of the web panel.

## Accessing the Menu

You can access the menu in-game by using the command `/tx` or `/txadmin`, alternatively
you can also use a keybind by going to `Game Settings > Key Bindings > FiveM` and
setting the `Open Main Page` option.

> RedM does not support key mappings, so no keybinds are registered there and the
> commands are the only way to open the menu on a RedM server.

> The `/tx` and `/txadmin` commands, as well as the `txAdmin-*` convars and
> `txAdmin:*` command/event names below, are kept as-is for compatibility with the
> wide range of existing FiveM/RedM resources, guides and server configs that rely
> on them. They are stable contracts and will not be renamed.

### Permissions
Anybody who you would like to give permissions to open the menu in-game, must have a panel
account with either their Discord or Cfx.re identifiers tied to it.

***If you do not have any of these identifiers attached, you will not be able to access the menu***

You can further control the menu options accessible to admins by changing their permissions
in the admin manager.

## Convars
The in-game menu has a variety convars that can alter the default behavior of the menu.  
Convars configured in the settings page should not be set manually.

### Settings page only
**txAdmin-menuEnabled**
- Description: Whether the menu is enabled or not. Changing it requires server restart.
- Default: `true`

**txAdmin-menuAlignRight**
- Description: Whether to align the menu to the right of the screen instead of the left.
- Default: `false`

**txAdmin-menuPageKey**
- Description: Will change the key used for changing pages in the menu. This value must be the exact browser key code for your preferred key. You can use [this](https://keycode.info/) website and the `event.code` section to find it.
- Default: `Tab`

**txAdmin-playerModePtfx**
- Description: Determine whether to play particles effects and sound whenever an admin's player mode is changed, such as when enabling god mode or noclip. On RedM only the particles play.
- Default: `true`

**txAdmin-hideAdminInPunishments**
- Description: Never show to the players the admin name on Bans or Warns.
- Default: `true`

**txAdmin-hideAdminInMessages**
- Description: Do not show the admin name on Announcements or DMs. 
- Default: `false`

**txAdmin-hideDefaultAnnouncement**
- Description: Suppresses the display of announcements, allowing you to implement your own announcement via the event `txAdmin:events:announcement`.
- Default: `false`

**txAdmin-hideDefaultDirectMessage**
- Description: Suppresses the display of direct messages, allowing you to implement your own direct message notification via the event `txAdmin:events:playerDirectMessage`.
- Default: `false`

**txAdmin-hideDefaultWarning**
- Description: Suppresses the display of warnings, allowing you to implement your own warning via the event `txAdmin:events:playerWarned`.
- Default: `false`

**txAdmin-hideDefaultScheduledRestartWarning**
- Description: Suppresses the display of scheduled restart warnings, allowing you to implement your own warning via the event `txAdmin:events:scheduledRestart`.
- Default: `false`

### Convar only (not in settings page)
**txAdmin-debugMode**
- Description: Will toggle debug printing on the server and client.
- Default: `false`
- Usage: `setr txAdmin-debugMode true`

**txAdmin-menuPlayerIdDistance**
- Description: The distance in which Player IDs become visible, if toggled on. Note that the game engine limits to show tags that are only closer than ~300m, so increasing the number above that might be useless. 
- Default: 150
- Usage: `setr txAdmin-menuPlayerIdDistance 100`

**txAdmin-menuAnnounceNotiPos**
- Description: Determines the location of the announcement notification. This **must** use one of the following valid
positions, `top-center`, `top-left`, `top-right`, `bottom-center`, `bottom-left`, `bottom-right`.
- Default: `top-center`
- Usage: `set txAdmin-menuAnnounceNotiPos top-right`


## Commands
**tx | txadmin**
- Description: Will toggle the in-game menu. This command has an optional argument of a player id that will quickly open up the target player's info modal.
- Usage: `/tx (playerID)`, `/txadmin (playerID)`
- Required Perm: `Must be an admin registered in the Admin Manager`

**cadmin-reauth**
- Description: Will retrigger the reauthentication process.
- Usage: `/cadmin-reauth` (the old `/txAdmin-reauth` name still works)
- Required Perm: `none`

## Troubleshooting menu access
- If you type `/tx` and nothing happens, your menu is probably disabled.  
- If you see a red authentication error in the chat and you are registered in the panel, you can type `/cadmin-reauth` in the chat to retry the authentication.  
- If you can't authenticate and the reason id `Invalid Request: source`, this means the source IP of the HTTP request being made by fxserver to the panel is not a "localhost" one, which might occur if your host has multiple IPs. To disable this protection, edit your `config.json` file and add `webServer.disableNuiSourceCheck` with value `true` then restart the server.

## Development
You can find development instructions regarding the menu [here.](https://github.com/chyarofivem/cAdminPanel/blob/master/docs/development.md#menu-development)

## FAQ
- **Q**: Why don't the 'Heal' options revive a player when using ESX/QBCore/etc?
- **A**: Many frameworks independently handle a "dead" state for a player, meaning
  the menu is unable to reset this state in an resource agnostic form directly. To establish compatibility 
  with any framework, the panel will emit an [txAdmin:events:playerHealed](https://github.com/chyarofivem/cAdminPanel/blob/master/docs/events.md#txadmineventsplayerhealed)
  for developers to handle.
