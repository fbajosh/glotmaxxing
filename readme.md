# Glotmaxxing

A focused Wiktionary reader for looking up a word across a small ranked set of preferred languages.

The app is intentionally narrow: search a term, route it to the most useful English or foreign-language page, parse the relevant Wiktionary section, and render only the content needed for that flow.

## Current Scope

- Dependency-free static app
- Live lookup through the English Wiktionary API
- Splash page with theme-specific hero, app name, and fixed bottom search/settings bar
- Compact fixed bottom search/settings bar on app pages
- Five preferred-language rows with drag reordering
- Editable routing rules in `src/routing.js`
- English parser in `src/english-parser.js`
- Foreign parser in `src/foreign-parser.js`
- Shared Wiktionary download/helpers in `src/wiktionary.js`
- Explicit handled user-facing error pages for known lookup failures

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

`No result`

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

## Deploy

GitHub Actions deploys `main` to a VM through the `production` environment.

Create a GitHub Environment named `production` and add these environment secrets:

| Secret | Purpose |
| --- | --- |
| `DEPLOY_HOST` | VM external IP or hostname |
| `DEPLOY_USER` | SSH user on the VM |
| `DEPLOY_SSH_KEY` | Private SSH key for `DEPLOY_USER` |
| `DEPLOY_TARGET_DIR` | Absolute target directory on the VM |
| `DEPLOY_SSH_PORT` | Optional SSH port; defaults to `22` when omitted |

The workflow packages the static app, uploads it to `DEPLOY_TARGET_DIR`, clears existing generated files there, preserves `.htaccess`, and extracts the new files.

The VM needs `tar` and SSH. Apache/Bitnami serves the deployed files from `DEPLOY_TARGET_DIR`.

## License

MIT. See `LICENSE`.
