# Glotmaxxing

A focused Wiktionary reader for looking up a word across a small ranked set of preferred languages.

The app is intentionally narrow: search a term, route it to the most useful English or foreign-language page, parse the relevant Wiktionary section, and render only the content needed for that flow.

## Current Scope

- Dependency-free static app
- Live lookup through the English Wiktionary API
- Splash page with hero, app name, and search
- Compact word-page top bar with search and settings
- Five preferred-language rows with drag reordering
- Editable routing rules in `src/routing.js`
- English parser in `src/english-parser.js`
- Foreign parser in `src/foreign-parser.js`
- Shared Wiktionary download/helpers in `src/wiktionary.js`
- One handled user-facing error page: `No sense-level translations available`

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

## Error Policy

The app should not hide lookup, routing, or parser failures behind generic fallbacks.

Known user-facing errors live in `src/error.js`. At the moment, the only defined handled error is:

`No sense-level translations available`

All other failures should remain visible as raw errors while the app is under active development.

## Run

```sh
npm run dev
```

The dev server starts on the first available port at or above `8080`.

## Test

```sh
npm test
```

Tests include parser fixtures and live randomized routing checks for common English nouns, verbs, adjectives, and adverbs.

## License

MIT. See `LICENSE`.
