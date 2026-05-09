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

hosted st: https://appmogged.com/glotmaxxing/
