import test from "node:test";
import assert from "node:assert/strict";
import { parseEnglishEntry, parseTranslationGroups } from "../src/english-parser.js";
import { parseForeignEntry } from "../src/foreign-parser.js";

test("English parser extracts etymology and sense translations", () => {
  const entry = parseEnglishEntry("run", `
==English==
===Etymology===
From Middle English runnen.

===Verb===
# To move swiftly.
`, `
==English==
===Verb===
====Translations====
{{trans-top|to move quickly on two feet}}
* Spanish: {{t+|es|correr}}
{{trans-bottom}}
`);

  assert.equal(entry.term, "run");
  assert.equal(entry.etymologyNotes[0], "From Middle English runnen.");
  assert.equal("partsOfSpeech" in entry, false);
  assert.deepEqual(entry.translationGroups[0].senses[0].translations.Spanish, ["correr (es)"]);
});

test("translation parser groups preferred languages by sense", () => {
  const groups = parseTranslationGroups(`
==English==
===Verb===
====Translations====
{{trans-top|to manage}}
* Spanish: {{t+|es|dirigir}}, {{t+|es|gestionar}}
* Portuguese: {{t+|pt|dirigir}}
{{trans-bottom}}
`);

  assert.equal(groups[0].pos, "verb");
  assert.equal(groups[0].senses[0].gloss, "to manage");
  assert.deepEqual(groups[0].senses[0].translations.Spanish, ["dirigir (es)", "gestionar (es)"]);
});

test("foreign parser extracts definitions", () => {
  const entry = parseForeignEntry("casa", `
==Spanish==
===Noun===
# house
# home
`, "Spanish");

  assert.equal(entry.language, "Spanish");
  assert.equal(entry.partsOfSpeech[0].pos, "noun");
  assert.deepEqual(entry.partsOfSpeech[0].definitions, ["house", "home"]);
});
