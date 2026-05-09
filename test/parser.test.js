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
  assert.deepEqual(entry.translationGroups[0].senses[0].translations.Spanish, [{ query: "correr", text: "correr" }]);
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
  assert.deepEqual(groups[0].senses[0].translations.Spanish, [
    { query: "dirigir", text: "dirigir" },
    { query: "gestionar", text: "gestionar" }
  ]);
});

test("translation parser removes wiki link brackets from translation text and query", () => {
  const linkedTemplateGroups = parseTranslationGroups(`
==English==
===Noun===
====Translations====
{{trans-top|small house}}
* Spanish: {{t+|es|[[casa]]|alt=[[casita]]}}
{{trans-bottom}}
`);
  const linkedTextGroups = parseTranslationGroups(`
==English==
===Noun===
====Translations====
{{trans-top|home}}
* Spanish: [[hogar]]
{{trans-bottom}}
`);

  assert.deepEqual(linkedTemplateGroups[0].senses[0].translations.Spanish, [
    { query: "casa", text: "casita" }
  ]);
  assert.deepEqual(linkedTextGroups[0].senses[0].translations.Spanish, [
    { query: "hogar", text: "hogar" }
  ]);
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

test("foreign parser attaches conjugation tables to lemma verbs", async () => {
  const entry = await resolveForeignEntry("cantar", `
==Spanish==
===Verb===
{{es-verb}}
# to [[sing]]

====Conjugation====
{{es-conj}}
`, "Spanish", {
    fetchWikitext: async (page) => {
      throw new Error(`Unexpected lemma fetch: ${page}`);
    },
    expandTemplates: async (title, text) => {
      const expansions = {
        "cantar|{{es-verb}}": "cantar (first-person singular present canto)",
        "cantar|{{es-conj}}": `
{| class="roa-inflection-table"
|-
! colspan="3" class="roa-nonfinite-header" | <span title="infinitivo">infinitive</span>
| colspan="5" | <span class="Latn form-of" lang="es">[[:cantar#Spanish|cantar]]</span>
|-
! rowspan="2" class="roa-indicative-left-rail" | <span title="indicativo">indicative</span>
! class="roa-native-person-number-header" |
|-
! class="roa-finite-header" | <span title="presente de indicativo">present</span>
| <span class="Latn form-of" lang="es">[[:canto#Spanish|canto]]</span>
| <span class="Latn form-of" lang="es">[[:cantas#Spanish|cantas]]</span>
| <span class="Latn form-of" lang="es">[[:canta#Spanish|canta]]</span>
| <span class="Latn form-of" lang="es">[[:cantamos#Spanish|cantamos]]</span>
| <span class="Latn form-of" lang="es">[[:cantáis#Spanish|cantáis]]</span>
| <span class="Latn form-of" lang="es">[[:cantan#Spanish|cantan]]</span>
|}
`
      };
      const expanded = expansions[`${title}|${text}`];
      if (!expanded) throw new Error(`Missing test expansion: ${title}|${text}`);
      return expanded;
    }
  });

  assert.equal(entry.partsOfSpeech[0].pos, "verb");
  assert.equal(entry.partsOfSpeech[0].conjugation.lemma, "cantar");
  assert.deepEqual(entry.partsOfSpeech[0].conjugation.nonfinite, [
    { label: "Infinitive", value: "cantar" }
  ]);
  assert.deepEqual(entry.partsOfSpeech[0].conjugation.tenses[0].rows[0], {
    person: "1st",
    singular: "canto",
    plural: "cantamos"
  });
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

====Conjugation====
{{es-conj}}
`
  };
  const cantarConjugation = `
{| class="roa-inflection-table"
|-
! colspan="3" class="roa-nonfinite-header" | <span title="infinitivo">infinitive</span>
| colspan="5" | <span class="Latn form-of" lang="es">[[:cantar#Spanish|cantar]]</span>
|-
! colspan="3" class="roa-nonfinite-header" | <span title="gerundio">gerund</span>
| colspan="5" | <span class="Latn form-of" lang="es">[[:cantando#Spanish|cantando]]</span>
|-
! rowspan="2" colspan="2" class="roa-nonfinite-header" | <span title="participio (pasado)">past participle</span>
|-
| colspan="2" | <span class="Latn form-of" lang="es">[[:cantado#Spanish|cantado]]</span>
|-
! rowspan="2" class="roa-indicative-left-rail" | <span title="indicativo">indicative</span>
! class="roa-native-person-number-header" |
|-
! class="roa-finite-header" | <span title="presente de indicativo">present</span>
| <span class="Latn form-of" lang="es">[[:canto#Spanish|canto]]</span>
| <span class="Latn form-of" lang="es">[[:cantas#Spanish|cantas]]</span><sup><sup>tú</sup></sup><br /><span class="Latn form-of" lang="es">[[:cantás#Spanish|cantás]]</span><sup><sup>vos</sup></sup>
| <span class="Latn form-of" lang="es">[[:canta#Spanish|canta]]</span>
| <span class="Latn form-of" lang="es">[[:cantamos#Spanish|cantamos]]</span>
| <span class="Latn form-of" lang="es">[[:cantáis#Spanish|cantáis]]</span>
| <span class="Latn form-of" lang="es">[[:cantan#Spanish|cantan]]</span>
|-
! class="roa-finite-header" | <span title="pretérito imperfecto (copréterito)">imperfect</span>
| <span class="Latn form-of" lang="es">[[:cantaba#Spanish|cantaba]]</span>
| <span class="Latn form-of" lang="es">[[:cantabas#Spanish|cantabas]]</span>
| <span class="Latn form-of" lang="es">[[:cantaba#Spanish|cantaba]]</span>
| <span class="Latn form-of" lang="es">[[:cantábamos#Spanish|cantábamos]]</span>
| <span class="Latn form-of" lang="es">[[:cantabais#Spanish|cantabais]]</span>
| <span class="Latn form-of" lang="es">[[:cantaban#Spanish|cantaban]]</span>
|-
! rowspan="2" class="roa-subjunctive-left-rail" | <span title="subjuntivo">subjunctive</span>
! class="roa-native-person-number-header" |
|-
! class="roa-finite-header" | <span title="presente de subjuntivo">present</span>
| <span class="Latn form-of" lang="es">[[:cante#Spanish|cante]]</span>
| <span class="Latn form-of" lang="es">[[:cantes#Spanish|cantes]]</span>
| <span class="Latn form-of" lang="es">[[:cante#Spanish|cante]]</span>
| <span class="Latn form-of" lang="es">[[:cantemos#Spanish|cantemos]]</span>
| <span class="Latn form-of" lang="es">[[:cantéis#Spanish|cantéis]]</span>
| <span class="Latn form-of" lang="es">[[:canten#Spanish|canten]]</span>
|-
! rowspan="2" class="roa-imperative-left-rail" | <span title="imperativo">imperative</span>
! class="roa-native-person-number-header" |
|-
! class="roa-finite-header" | <span title="imperativo afirmativo">affirmative</span>
| <span class="Latn form-of" lang="es">[[:canta#Spanish|canta]]</span>
| <span class="Latn form-of" lang="es">[[:cante#Spanish|cante]]</span>
| <span class="Latn form-of" lang="es">[[:cantemos#Spanish|cantemos]]</span>
| <span class="Latn form-of" lang="es">[[:cantad#Spanish|cantad]]</span>
| <span class="Latn form-of" lang="es">[[:canten#Spanish|canten]]</span>
|}
`;
  const expansions = {
    "cantas|{{noun form of|es|canta||p}}": "plural of [[canta]]",
    "cantas|{{es-verb form of|cantar}}": "second-person singular present indicative of [[cantar]]",
    "canta|{{es-noun|f}}": "canta f (plural cantas)",
    "cantar|{{es-verb}}": "cantar (first-person singular present canto, first-person singular preterite canté, past participle cantado)",
    "cantar|{{es-conj}}": cantarConjugation
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
  assert.deepEqual(entry.partsOfSpeech[1].conjugation.nonfinite, [
    { label: "Infinitive", value: "cantar" },
    { label: "Gerund", value: "cantando" },
    { label: "Past participle", value: "cantado" }
  ]);
  assert.equal(entry.partsOfSpeech[1].conjugation.tenses.length, 3);
  assert.deepEqual(entry.partsOfSpeech[1].conjugation.tenses[0], {
    mood: "indicative",
    name: "present",
    rows: [
      { person: "1st", singular: "canto", plural: "cantamos" },
      { person: "2nd", singular: "cantas, cantás", plural: "cantáis" },
      { person: "3rd", singular: "canta", plural: "cantan" }
    ]
  });
  assert.equal(entry.partsOfSpeech[1].conjugation.tenses.some((tense) => tense.mood === "imperative"), false);
  assert.deepEqual(entry.etymologyNotes, [
    "Deverbal from cantar.",
    "Inherited from Latin cantāre, frequentative of canere. Cognate with English chant."
  ]);
  assert.equal(entry.etymologyNotes.some((note) => note.includes("ine-pro") || note.includes("*bʰeh₂-")), false);
});

test("foreign parser follows Portuguese verb forms to conjugation tables", async () => {
  const entry = await resolveForeignEntry("conheces", `
==Portuguese==
===Verb===
{{head|pt|verb form}}
# {{pt-verb form of|conhecer}}
`, "Portuguese", {
    fetchWikitext: async (page) => {
      if (page !== "conhecer") throw new Error(`Missing test page: ${page}`);
      return `
==Portuguese==
===Verb===
{{pt-verb}}
# to [[know]]

====Conjugation====
{{pt-conj}}
`;
    },
    expandTemplates: async (title, text) => {
      const expansions = {
        "conheces|{{pt-verb form of|conhecer}}": "second-person singular present indicative of [[conhecer]]",
        "conhecer|{{pt-verb}}": "conhecer",
        "conhecer|{{pt-conj}}": `
{| class="roa-inflection-table"
|-
! class="roa-nonfinite-header" colspan="7" | ''<span title="infinitivo">Infinitive</span>''
|-
! class="roa-nonfinite-header" | '''<span title="infinitivo impessoal">Impersonal</span>'''
| colspan="6" | <span class="Latn form-of" lang="pt">[[:conhecer#Portuguese|conhecer]]</span>
|-
! class="roa-nonfinite-header" colspan="7" | ''<span title="gerúndio">Gerund</span>''
|-
| class="roa-nonfinite-header" |
| colspan="6" | <span class="Latn form-of" lang="pt">[[:conhecendo#Portuguese|conhecendo]]</span>
|-
! class="roa-nonfinite-header" colspan="7" | ''<span title="particípio passado">Past participle</span>''
|-
! class="roa-nonfinite-header" | Masculine
| colspan="3" | <span class="Latn form-of" lang="pt">[[:conhecido#Portuguese|conhecido]]</span>
| colspan="3" | <span class="Latn form-of" lang="pt">[[:conhecidos#Portuguese|conhecidos]]</span>
|-
! class="roa-indicative-left-rail" colspan="7" | ''<span title="indicativo">Indicative</span>''
|-
! class="roa-indicative-left-rail" | <span title="presente">Present</span>
| <span class="Latn form-of" lang="pt">[[:conheço#Portuguese|conheço]]</span>
| <span class="Latn form-of" lang="pt">[[:conheces#Portuguese|conheces]]</span>
| <span class="Latn form-of" lang="pt">[[:conhece#Portuguese|conhece]]</span>
| <span class="Latn form-of" lang="pt">[[:conhecemos#Portuguese|conhecemos]]</span>
| <span class="Latn form-of" lang="pt">[[:conheceis#Portuguese|conheceis]]</span>
| <span class="Latn form-of" lang="pt">[[:conhecem#Portuguese|conhecem]]</span>
|-
! class="roa-subjunctive-left-rail" colspan="7" | ''<span title="subjuntivo">Subjunctive</span>''
|-
! class="roa-subjunctive-left-rail" | <span title="presente">Present</span>
| <span class="Latn form-of" lang="pt">[[:conheça#Portuguese|conheça]]</span>
| <span class="Latn form-of" lang="pt">[[:conheças#Portuguese|conheças]]</span>
| <span class="Latn form-of" lang="pt">[[:conheça#Portuguese|conheça]]</span>
| <span class="Latn form-of" lang="pt">[[:conheçamos#Portuguese|conheçamos]]</span>
| <span class="Latn form-of" lang="pt">[[:conheçais#Portuguese|conheçais]]</span>
| <span class="Latn form-of" lang="pt">[[:conheçam#Portuguese|conheçam]]</span>
|}
`
      };
      const expanded = expansions[`${title}|${text}`];
      if (!expanded) throw new Error(`Missing test expansion: ${title}|${text}`);
      return expanded;
    }
  });

  assert.equal(entry.partsOfSpeech[0].formOf.lemma, "conhecer");
  assert.deepEqual(entry.partsOfSpeech[0].conjugation.nonfinite, [
    { label: "Infinitive", value: "conhecer" },
    { label: "Gerund", value: "conhecendo" },
    { label: "Past participle", value: "conhecido" }
  ]);
  assert.deepEqual(entry.partsOfSpeech[0].conjugation.tenses[0].rows[1], {
    person: "2nd",
    singular: "conheces",
    plural: "conheceis"
  });
});
