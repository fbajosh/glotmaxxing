import test from "node:test";
import assert from "node:assert/strict";
import { parseEnglishEntry, parseTranslationGroups } from "../src/english-parser.js";
import { parseForeignEntry, resolveForeignEntry } from "../src/foreign-parser.js";
import { wiki } from "../src/html.js";
import { cleanWikiText } from "../src/wiktionary.js";

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

test("wikitext cleaner preserves glosses, object usage, and linked emphasis", () => {
  const text = cleanWikiText("{{lb|pt|transitive}} to [[know]] {{gl|someone/something}} {{gloss|to ascribe to something the title or quality of}} {{+obj|pt|dirobj<someone/something> + :como/:por<as someone/something else>}}");

  assert.equal(wiki(text), "(transitive) to <em>know</em> (someone/something) (to ascribe to something the title or quality of) [with direct object ‘someone/something’, along with como or por ‘as someone/something else’]");
});

test("wikitext cleaner preserves simple object-usage brackets", () => {
  const text = cleanWikiText("{{lb|pt|intransitive|legal}} to [[hear]] {{gl|to consider on its merits}} {{+obj|pt|:de<an appeal or request>}}");

  assert.equal(wiki(text), "(intransitive, legal) to <em>hear</em> (to consider on its merits) [with de ‘an appeal or request’]");
});

test("wikitext cleaner handles object qualifiers and blank labels", () => {
  assert.equal(
    wiki(cleanWikiText("{{lb|es|reflexive|_|with preposition a}} to be [[due to]]")),
    "(reflexive, with preposition a) to be <em>due to</em>"
  );
  assert.equal(
    wiki(cleanWikiText("{{+obj|es|:de<q:optionally>}}")),
    "[with (optionally) de]"
  );
});

test("foreign parser ignores punctuation-only definition rows", () => {
  const entry = parseForeignEntry("deber", `
==Spanish==
===Verb===
# {{lb|es|auxiliary}} [[must]]
#:
# ;
# {{lb|es|auxiliary}} [[shall]]
`, "Spanish");

  assert.deepEqual(entry.partsOfSpeech[0].definitions.map(wiki), [
    "(auxiliary) <em>must</em>",
    "(auxiliary) <em>shall</em>"
  ]);
});

test("foreign parser follows form-of entries to lemmas", async () => {
  const pages = {
    canta: `
==Spanish==
===Etymology===
{{dercat|es|ine-pro}} {{root|es|ine-pro|*bʰeh₂-|id=speak}}
Deverbal from {{m|es|cantar}}.

===Noun===
{{es-noun|f}}
# {{lb|es|Aragon|Venezuela}} [[song]]; [[singing]]
`,
    cantar: `
==Spanish==
===Etymology===
{{root|es|ine-pro|*bʰeh₂-|id=speak}}
Inherited from {{der|es|la|cantāre}}, frequentative of {{m|la|canere}}. Cognate with English {{m|en|chant}}.

===Verb===
{{es-verb}}
# {{lb|es|transitive|intransitive}} to [[sing]]
# {{lb|es|intransitive|colloquial}} to [[stink]]
`
  };
  const expansions = {
    "cantas|{{noun form of|es|canta||p}}": "plural of [[canta]]",
    "cantas|{{es-verb form of|cantar}}": "second-person singular present indicative of [[cantar]]",
    "canta|{{es-noun|f}}": "canta f (plural cantas)",
    "cantar|{{es-verb}}": "cantar (first-person singular present canto, first-person singular preterite canté, past participle cantado)"
  };

  const entry = await resolveForeignEntry("cantas", `
==Spanish==
===Noun===
{{head|es|noun form|g=f-p}}
# {{noun form of|es|canta||p}}

===Verb===
{{head|es|verb form}}
# {{es-verb form of|cantar}}
`, "Spanish", {
    fetchWikitext: async (page) => {
      if (!pages[page]) throw new Error(`Missing test page: ${page}`);
      return pages[page];
    },
    expandTemplates: async (title, text) => {
      const expanded = expansions[`${title}|${text}`];
      if (!expanded) throw new Error(`Missing test expansion: ${title}|${text}`);
      return expanded;
    }
  });

  assert.equal(entry.term, "cantas");
  assert.equal(entry.partsOfSpeech[0].pos, "noun");
  assert.equal(wiki(entry.partsOfSpeech[0].formOf.label), "plural of <em>canta</em>, f pl");
  assert.deepEqual(entry.partsOfSpeech[0].definitions.map(wiki), ["(Aragon, Venezuela) <em>song</em>; <em>singing</em>"]);
  assert.deepEqual(entry.partsOfSpeech[0].alternateForms, []);

  assert.equal(entry.partsOfSpeech[1].pos, "verb");
  assert.equal(wiki(entry.partsOfSpeech[1].formOf.label), "second-person singular present indicative of <em>cantar</em>");
  assert.deepEqual(entry.partsOfSpeech[1].definitions.map(wiki), ["(transitive, intransitive) to <em>sing</em>", "(intransitive, colloquial) to <em>stink</em>"]);
  assert.deepEqual(entry.partsOfSpeech[1].alternateForms, [
    "first-person singular present canto",
    "first-person singular preterite canté",
    "past participle cantado"
  ]);
  assert.deepEqual(entry.etymologyNotes, [
    "Deverbal from cantar.",
    "Inherited from Latin cantāre, frequentative of canere. Cognate with English chant."
  ]);
  assert.equal(entry.etymologyNotes.some((note) => note.includes("ine-pro") || note.includes("*bʰeh₂-")), false);
});
