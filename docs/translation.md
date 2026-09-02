# Translation Support

The panel ships with translations for the in-game interface (menu/warn), chat messages and Discord warnings.  
Two locales are currently bundled: `en` (English) and `hr` (Croatian). Contributions for other languages are welcome.


## Custom locales:
If your language is not available, or you want to customize the messages, create a `locale.json` file inside the `txData` folder based on any language file found in [the `locale/` folder of this repository](https://github.com/chyarofivem/cAdminPanel/tree/master/locale). Then go to the settings and select the "Custom" language option.

The `$meta.humanizer_language` key must be compatible with the library [humanize-duration](https://www.npmjs.com/package/humanize-duration), check their page for a list of compatible languages.


## Contributing:
Translations are community-maintained, and help keeping them updated and high-quality is always welcome.  
For that you will need to:
- Make a custom locale file with the instructions above;
- Name the file using the language code in [this page](https://www.science.co.il/language/Locale-codes.php);
- The `$meta.label` must be the language name in English (eg `Spanish` instead of `Español`);
- Add the new locale to `shared/localeMap.ts`, keeping the alphabetical order;
- Open a [Pull Request](https://github.com/chyarofivem/cAdminPanel/pulls) with a few screenshots as evidence that you tested your changes in-game.
- An automatic check will run, make sure to read the output in case of any errors.

> [!TIP]
> To quickly test your changes, you can edit the `locale.json` file and then in the settings page click "Save Global Settings" again to see the changes in the game menu without needing to restart the panel or the server.

> [!TIP]
> To make sure you didn't miss anything in the locale file, clone this repository, run `npm i`, move your `locale.json` into the `locale/` folder and run `npm run locale:check`. This will tell you about missing or extra keys.

> [!NOTE]
> The performance of custom locales on big servers may not be ideal due to the way dynamic content needs to be synced to clients. Contributing translations upstream is preferred, so they get packed with the rest of the panel.
