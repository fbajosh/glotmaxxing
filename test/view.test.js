import test from "node:test";
import assert from "node:assert/strict";
import { aboutView } from "../src/about.js";
import { englishView } from "../src/english.js";
import { foreignView } from "../src/foreign.js";
import { splashView } from "../src/splash.js";

test("English result renders as one table with part headers", () => {
  const html = englishView({
    term: "house",
    translationGroups: [
      { pos: "noun", senses: [{ gloss: "human abode", translations: { Spanish: ["casa (es)"] } }] },
      { pos: "verb", senses: [{ gloss: "keep within", translations: { Spanish: ["alojar (es)"] } }] }
    ],
    etymologyNotes: []
  }, "Spanish", ["Spanish"]);

  assert.equal((html.match(/<table class="result-table">/g) || []).length, 1);
  assert.match(html, /<tr class="part-header"><th>Noun<\/th><th>Spanish<\/th><\/tr>/);
  assert.match(html, /<tr class="part-header"><th>Verb<\/th><th>Spanish<\/th><\/tr>/);
  assert.match(html, /class="part-gap"/);
});

test("Foreign result renders as one table with part headers", () => {
  const html = foreignView({
    entry: {
      term: "cantas",
      language: "Spanish",
      partsOfSpeech: [
        { pos: "noun", formOf: { label: "plural of canta" }, definitions: ["song"], alternateForms: [] },
        { pos: "verb", formOf: { label: "second-person singular of cantar" }, definitions: ["to sing"], alternateForms: ["canto"] }
      ],
      etymologyNotes: []
    },
    nextLanguage: ""
  });

  assert.match(html, /<h1>cantas<\/h1>\s*<p class="foreign-language">Spanish<\/p>/);
  assert.equal((html.match(/<table class="result-table foreign-table">/g) || []).length, 1);
  assert.match(html, /<tr class="part-header"><th>Noun<\/th><\/tr>/);
  assert.match(html, /<tr class="part-header"><th>Verb<\/th><\/tr>/);
  assert.doesNotMatch(html, /<td>1<\/td>/);
  assert.match(html, /<td class="form-of">form: second-person singular of cantar<\/td>/);
  assert.match(html, /<td class="alternate-forms">alternate forms: canto<\/td>/);
  assert.match(html, /class="part-gap"/);
});

test("About page explains data source and routing", () => {
  const html = aboutView();

  assert.match(html, /<h1>About<\/h1>/);
  assert.match(html, /Wiktionary/);
  assert.match(html, /strong English entry/);
  assert.match(html, /preferred languages in order/);
});

test("Splash renders theme-specific hero", () => {
  const html = splashView();
  const darkHtml = splashView({ darkMode: true });

  assert.match(html, /hero-light\.svg/);
  assert.match(darkHtml, /hero-dark\.svg/);
});
