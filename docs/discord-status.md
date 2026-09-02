# Custom Discord Status Embed

The panel can maintain a persistent status embed in a Discord channel.  
This is a Discord embed that the panel will update every minute, and you can configure it to display server status, and any other random thing that you can normally do with a Discord embed.  
To add the embed, type `/status add` on a channel that your bot has Send Message permission.  
  
To modify the embed, navigate to `Settings > Appearance`, and click on the two JSON editor buttons.
> **Important:** If you are having issues with the JSON encoding, we recommend you use [jsoneditoronline.org](https://jsoneditoronline.org/) to modify your JSON.

## Placeholders
To add dynamic data to the embed, you can use the built-in placeholders, which the panel will replace at runtime.  

- `{{serverCfxId}}`: The Cfx.re id of your server, this is tied to your `sv_licenseKey` and detected at runtime.
- `{{serverJoinUrl}}`: The direct join URL of your server. Example: `https://cfx.re/join/xxxxxx`.
- `{{serverBrowserUrl}}`: The FiveM Server browser URL of your server. Example: `https://servers.fivem.net/servers/detail/xxxxxx`.
- `{{serverClients}}`: The number of players online in your server.
- `{{serverMaxClients}}`: The `sv_maxclients` of your server, detected at runtime.
- `{{serverName}}`: The server name configured in the panel. Can be changed in `Settings > General`.
- `{{statusColor}}`: A hex-encoded color, from the Config JSON.
- `{{statusString}}`: A text to be displayed with the server status, from the Config JSON.
- `{{uptime}}`: For how long is the server online. Example: `1 hr, 50 mins`.
- `{{nextScheduledRestart}}`: String with when is the next scheduled restart. Example: `in 2 hrs, 48 mins`.


## Embed JSON:
This is the JSON of the Embed that will be sent to Discord.  
This MUST be a valid Discord embed JSON, and we recommend you use a tool like [discohook.org](https://discohook.org/) to edit the embed. To do so, at the bottom click `JSON Data Editor` and paste the JSON inside the `embeds: [...]` array.  
On the JSON, you don't need to set `color` because the panel replaces it from the config JSON. Footer data is removed from the status embed.

> **Important:** At save time, the panel cannot validate if the embed is correct or not without sending it to the Discord API, so if it does not work check the `System > Panel Log` page and see if there are any errors related to it.

```json
{
    "title": "{{serverName}}",
    "url": "{{serverBrowserUrl}}",
    "description": "You can configure this embed in `Settings > Appearance`.",
    "fields": [
        {
            "name": "> STATUS",
            "value": "```\n{{statusString}}\n```",
            "inline": true
        },
        {
            "name": "> PLAYERS",
            "value": "```\n{{serverClients}}/{{serverMaxClients}}\n```",
            "inline": true
        },
        {
            "name": "> F8 CONNECT COMMAND",
            "value": "```\nconnect 123.123.123.123\n```"
        },
        {
            "name": "> NEXT RESTART",
            "value": "```\n{{nextScheduledRestart}}\n```",
            "inline": true
        },
        {
            "name": "> UPTIME",
            "value": "```\n{{uptime}}\n```",
            "inline": true
        }
    ]
}
```

## Embed Config JSON:
The configuration of the embed, where you can change the status texts, as well as the embed color. 
You can set up to 5 buttons.  
For emojis, you can use an actual unicode emoji character, or the emoji ID.  
To get the emoji ID, insert it into discord, and add `\` before it then send the message to get the full name (eg `<:myicon:1062339910654246964>`).

```json
{
    "onlineString": "🟢 Online",
    "onlineColor": "#0BA70B",
    "partialString": "🟡 Partial",
    "partialColor": "#FFF100",
    "offlineString": "🔴 Offline",
    "offlineColor": "#A70B28",
    "buttons": [
        {
            "emoji": "🎮",
            "label": "Connect",
            "url": "{{serverJoinUrl}}"
        }
    ]
}
```
