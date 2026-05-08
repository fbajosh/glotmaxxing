# Glotmaxxing

A focused dictionary PWA for users who care about a small ranked set of languages.

This first pass is dependency-free and runs from static files. It includes:

- live Wiktionary lookup
- editable English/foreign routing rules in `src/routing.js`
- English translation parsing in `src/english-parser.js`
- foreign entry parsing in `src/foreign-parser.js`
- splash search screen and focused word pages
- five-slot preferred-language settings with drag reordering
- installable PWA metadata

## Run

```sh
npm run dev
```

The server starts on the first available port at or above `8080`.

## Verify

```sh
npm test
```
