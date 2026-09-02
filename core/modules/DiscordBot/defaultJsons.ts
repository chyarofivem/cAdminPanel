export const defaultEmbedJson = JSON.stringify({
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
});

export const defaultEmbedConfigJson = JSON.stringify({
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
        },
    ].filter(Boolean)
});
