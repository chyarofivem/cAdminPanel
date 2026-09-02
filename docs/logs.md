# Logging
The panel writes persistent log files with rotation into `txData/<profile>/logs/`, keeping them up to a maximum size and number of days.

> Note: player warn/ban/allowlist actions are not just stored in the panel log, but also in the players database.

There are two log files:

## Panel Log (`panel.log`)
The combined timeline shown on the *System > Panel Log* page. It holds two channels:
- **Actions**: administrative actions and automated ones such as server restarts, bans, warns, settings changes and live console input. It does not log the user IP unless it comes from an authentication endpoint.
- **Server events**: everything that happens inside the game server — player join/leave/die, chat messages, explosions, menu events, commands. Player sources are kept in the format `[mutex#id] name`, where the mutex identifies that server execution. If you search the file for a `[mutex#id]`, the first result will be the player join with all their identifiers available.

The active file is newline-delimited JSON so the in-memory buffer can be restored after a panel restart.
- Recent Buffer: 32k entries
- Interval: 1d (fixed — the interval cannot be overridden)
- maxFiles: 7
- maxSize: 10G

## FXServer Console Log (`fxserver.log`)
Contains the log of everything that happens in the fxserver console (`stdin`, `stdout`, `stderr`). Any live console input is prefixed with `> `.
- Recent Buffer: 64~128kb
- Interval: 1d
- maxFiles: 7
- maxSize: 5G


## Configuring Log Rotate
The log rotation can be configured, so you can choose to store more or less logs according to your needs.  
To configure it, edit your `txData/<profile>/config.json` and add an object inside `logger` with the key being one of `[fxserver, txadmin]` (`txadmin` is the storage key for the panel log). Then add option keys according with the library reference: https://github.com/iccicci/rotating-file-stream#options

Example:
```jsonc
{
  //...
  "logger": {
    "fxserver": {
      "interval": "1d",
      "maxSize": "2G", //max size of rotated files to keep
      "maxFiles": 14 //max number of rotated files to keep
    }
  }
  //...
}
```

To completely disable one of the log types, set its value to `false`.

Example:
```jsonc
{
  //...
  "logger": {
    "fxserver": false
  }
  //...
}
```
