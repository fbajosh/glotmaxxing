# Glotmaxxing

A focused Wiktionary reader for looking up a word across a small ranked set of preferred languages.

The app is intentionally narrow: search a term, route it to the most useful English or foreign-language page, parse the relevant Wiktionary section, and render only the content needed for that flow.

## Lookup Flow

1. User enters a word.
2. The app downloads the Wiktionary page for that word.
3. `src/routing.js` classifies the English section as `strong`, `some`, `minimal`, or `none`.
4. Strong/some English entries use the English template.
5. Minimal/no English entries check preferred languages in order.
6. Foreign entries use the foreign template.
7. If no preferred-language section exists, the app says no page exists in preferred languages.

English pages show sense-level translations into the highest-priority available preferred language, plus links to other available preferred languages. They do not show English definitions.

Foreign pages show the selected language section content parsed from Wiktionary.

## Deploy Version

GitHub Actions stamps each deploy as `vYYYYMMDD.hhmmss`, writes that value to `src/version.js` and `version.json`, and updates static asset query strings before packaging. The About page shows the loaded app version, fetches `version.json` from the server with a cache-busting query, and marks the app out of sync when those versions differ.

The deployed `.htaccess` sends no-store cache headers for this app path when Apache allows per-directory headers. A `sw.js` kill switch is also deployed so any older service worker registered for the app path can clear Cache Storage and unregister.

## License

MIT. See `LICENSE`.
