import test from "node:test";
import assert from "node:assert/strict";
import { aboutView } from "../src/about.js";
import { englishView } from "../src/english.js";
import { foreignView } from "../src/foreign.js";
import { lightHeroSvg, splashView } from "../src/splash.js";

test("English result renders as one table with part headers", () => {
  const html = englishView({
    term: "house",
    translationGroups: [
      { pos: "noun", senses: [{ gloss: "human abode", translations: { Spanish: [{ query: "casa", text: "casa" }] } }] },
      {
        pos: "verb",
        senses: [{
          gloss: "keep within",
          translations: {
            Spanish: [{ query: "alojar", text: "alojar" }],
            Portuguese: [{ query: "alojar", text: "alojar" }]
          }
        }]
      }
    ],
    etymologyNotes: []
  }, "Spanish", ["Spanish", "Portuguese"], ["Spanish", "Italian"]);

  assert.equal((html.match(/<table class="result-table">/g) || []).length, 1);
  assert.match(html, /<tr class="part-header"><th>Noun<\/th><th>Spanish<\/th><\/tr>/);
  assert.match(html, /<tr class="part-header"><th>Verb<\/th><th>Spanish<\/th><\/tr>/);
  assert.match(html, /<a href="\?q=casa" data-word-query="casa">casa<\/a>/);
  assert.doesNotMatch(html, /\(es\)/);
  assert.doesNotMatch(html, /Also available/);
  assert.match(html, /Other translations/);
  assert.match(html, /data-translation-language="Portuguese"/);
  assert.match(html, /Other results for house/);
  assert.match(html, /data-result-language="Spanish"/);
  assert.match(html, /class="part-gap"/);
});

test("Foreign result renders as one table with part headers", () => {
  const html = foreignView({
    entry: {
      term: "cantas",
      language: "Spanish",
      partsOfSpeech: [
        { pos: "noun", formOf: { label: "plural of canta" }, definitions: ["song"], alternateForms: [] },
        {
          pos: "verb",
          formOf: { label: "second-person singular of cantar" },
          definitions: ["to sing"],
          alternateForms: ["canto"],
          conjugation: {
            lemma: "cantar",
            nonfinite: [
              { label: "Infinitive", value: "cantar" },
              { label: "Gerund", value: "cantando" },
              { label: "Past participle", value: "cantado" }
            ],
            tenses: [
              {
                mood: "indicative",
                name: "present",
                rows: [
                  { person: "1st", singular: "canto", plural: "cantamos" },
                  { person: "2nd", singular: "cantas, cantás", plural: "cantáis" },
                  { person: "3rd", singular: "canta", plural: "cantan" }
                ]
              }
            ]
          }
        }
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
  assert.match(html, /<h2>Verb conjugation of cantar<\/h2>/);
  assert.match(html, /<tr><th>Infinitive<\/th><td>cantar<\/td><\/tr>/);
  assert.match(html, /class="conjugation-grid"/);
  assert.match(html, /class="tense-table"/);
  assert.match(html, /<h3>Present Indicative<\/h3>/);
  assert.match(html, /<tr><td>2nd<\/td><td>cantas, cantás<\/td><td>cantáis<\/td><\/tr>/);
  assert.match(html, /class="part-gap"/);
});

test("About page explains data source and routing", () => {
  const html = aboutView({
    appVersion: "v20260509.152647",
    serverVersion: { version: "v20260509.152647", deployedAt: "2026-05-09T15:26:47Z" }
  });

  assert.match(html, /<h1>About<\/h1>/);
  assert.match(html, /Wiktionary/);
  assert.match(html, /strong English entry/);
  assert.match(html, /Other translations/);
  assert.match(html, /Other results/);
  assert.match(html, /preferred languages in order/);
  assert.match(html, /App version: v20260509\.152647/);
  assert.match(html, /Latest version: v20260509\.152647/);
  assert.match(html, /Status: current/);
  assert.match(html, /<a href="\?page=about&amp;recache=1" data-action="force-recache">Force recache<\/a>/);
});

test("About page shows out-of-sync server version", () => {
  const html = aboutView({
    appVersion: "v20260509.152647",
    serverVersion: { version: "v20260509.152700", deployedAt: "2026-05-09T15:27:00Z" }
  });

  assert.match(html, /Status: out of sync/);
});

test("Splash renders theme-specific hero", () => {
  const html = splashView();
  const darkHtml = splashView({ darkMode: true });

  assert.match(html, /public\/assets\/hero\.svg/);
  assert.match(html, /data-hero-mode="light"/);
  assert.match(darkHtml, /public\/assets\/hero\.svg/);
  assert.match(darkHtml, /data-hero-mode="dark"/);
  assert.doesNotMatch(`${html}${darkHtml}`, /hero-light\.svg|hero-dark\.svg/);
});

test("Light splash hero swaps SVG colors", () => {
  const svg = '<svg><path fill="#6666FF" stroke="white"/><path fill="#66FFFF"/><path fill="#4FFFFF"/><path fill="#FFFFFF"/><path fill="#FFD4D4"/><path fill="#FF5757"/></svg>';
  const light = lightHeroSvg(svg);

  assert.match(light, /fill="#000066"/);
  assert.match(light, /stroke="#000000"/);
  assert.match(light, /fill="#00004F"/);
  assert.match(light, /fill="#000000"/);
  assert.match(light, /fill="#D40000"/);
  assert.match(light, /fill="#570000"/);
});
