import test from "node:test";
import assert from "node:assert/strict";
import { errorView } from "../src/error.js";
import { foreignView } from "../src/foreign.js";
import { routeWord } from "../src/routing.js";

const PREFERRED_LANGUAGES = ["Spanish", "Portuguese", "French", "Italian"];

test("missing title resolves to first search result with a preferred language page", async () => {
  const result = await routeWord({
    query: "debian",
    preferredLanguages: PREFERRED_LANGUAGES,
    selectedLanguage: "",
    tools: {
      fetchWikitext: async (title) => {
        if (title === "debian") throw missingTitle();
        if (title === "DFSG") return englishOnly();
        if (title === "debían") return spanishVerb();
        throw new Error(`Unexpected fetch: ${title}`);
      },
      searchTitles: async (query, limit) => {
        assert.equal(query, "debian");
        assert.equal(limit, 8);
        return ["DFSG", "debían"];
      },
      expandTemplates: async (title, text) => {
        if (title === "debían" && text === "{{es-conj}}") return spanishConjugation();
        return "";
      }
    }
  });

  assert.equal(result.flow, "foreign");
  assert.equal(result.entry.term, "debían");
  assert.equal(result.entry.redirectedFrom, "debian");

  const html = foreignView(result);
  assert.match(html, /<h1>debían<\/h1>/);
  assert.match(html, /redirected from deb<u>i<\/u>an/);
  assert.match(html, /<tr class="part-header"><th>Verb<\/th><\/tr>/);
});

test("English entries without sense translations route to preferred language", async () => {
  const result = await routeWord({
    query: "parles",
    preferredLanguages: ["Catalan"],
    selectedLanguage: "",
    tools: {
      fetchWikitext: async (title) => {
        assert.equal(title, "parles");
        return `
==English==
===Noun===
# One English definition.
# Another English definition.

==Catalan==
===Verb===
# you speak

====Conjugation====
{{ca-conj}}
`;
      },
      searchTitles: async () => {
        throw new Error("Search should not run");
      },
      expandTemplates: async (title, text) => {
        if (title === "parles" && text === "{{ca-conj}}") return catalanConjugation();
        return "";
      }
    }
  });

  assert.equal(result.flow, "foreign");
  assert.equal(result.englishPresence, "some");
  assert.equal(result.entry.language, "Catalan");
  assert.equal(result.entry.partsOfSpeech[0].conjugation.lemma, "parles");
});

test("English entries expose foreign result languages and can open them explicitly", async () => {
  const tools = {
    fetchWikitext: async (title) => {
      assert.equal(title, "casa");
      return englishWithSpanishResult();
    },
    searchTitles: async () => {
      throw new Error("Search should not run");
    },
    expandTemplates: async () => ""
  };

  const english = await routeWord({
    query: "casa",
    preferredLanguages: ["Spanish", "Portuguese"],
    selectedLanguage: "",
    resultLanguage: "",
    tools
  });

  assert.equal(english.flow, "english");
  assert.deepEqual(english.availableLanguages, ["Spanish"]);

  const foreign = await routeWord({
    query: "casa",
    preferredLanguages: ["Spanish", "Portuguese"],
    selectedLanguage: "",
    resultLanguage: "Spanish",
    tools
  });

  assert.equal(foreign.flow, "foreign");
  assert.equal(foreign.entry.language, "Spanish");
  assert.equal(foreign.entry.partsOfSpeech[0].definitions[0], "house");
});

test("missing title with no preferred-language search result returns No result", async () => {
  await assert.rejects(
    routeWord({
      query: "notaword",
      preferredLanguages: PREFERRED_LANGUAGES,
      selectedLanguage: "",
      tools: {
        fetchWikitext: async (title) => {
          if (title === "notaword") throw missingTitle();
          return englishOnly();
        },
        searchTitles: async () => ["EnglishOnly"],
        expandTemplates: async () => ""
      }
    }),
    /No result/
  );
});

test("error view recognizes No result", () => {
  const html = errorView("notaword", new Error("No result"));

  assert.match(html, /<h1>notaword<\/h1>/);
  assert.match(html, /No result/);
});

function missingTitle() {
  const error = new Error("missing title");
  error.code = "missingtitle";
  return error;
}

function englishOnly() {
  return `
==English==
===Noun===
# A test page.
`;
}

function englishWithSpanishResult() {
  return `
==English==
===Noun===
# One definition.
# Another definition.
# A third definition.

====Translations====
{{trans-top|human abode}}
* Spanish: {{t|es|casa}}
* Portuguese: {{t|pt|casa}}
{{trans-bottom}}

==Spanish==
===Noun===
# house
`;
}

function catalanConjugation() {
  return `
{| class="roa-inflection-table"
|-
! colspan="3" class="roa-nonfinite-header" | <span title="infinitiu">infinitive</span>
| colspan="5" | <span class="Latn form-of" lang="ca">[[:parlar#Catalan|parlar]]</span>
|-
! rowspan="2" class="roa-indicative-left-rail" | <span title="indicatiu">indicative</span>
! class="roa-native-person-number-header" |
|-
! class="roa-finite-header" | <span title="present">present</span>
| <span class="Latn form-of" lang="ca">[[:parlo#Catalan|parlo]]</span>
| <span class="Latn form-of" lang="ca">[[:parles#Catalan|parles]]</span>
| <span class="Latn form-of" lang="ca">[[:parla#Catalan|parla]]</span>
| <span class="Latn form-of" lang="ca">[[:parlem#Catalan|parlem]]</span>
| <span class="Latn form-of" lang="ca">[[:parleu#Catalan|parleu]]</span>
| <span class="Latn form-of" lang="ca">[[:parlen#Catalan|parlen]]</span>
|}
`;
}

function spanishVerb() {
  return `
==Spanish==
===Verb===
# should

====Conjugation====
{{es-conj}}
`;
}

function spanishConjugation() {
  return `
{| class="roa-inflection-table"
|-
! colspan="3" class="roa-nonfinite-header" | <span title="infinitivo">infinitive</span>
| colspan="5" | <span class="Latn form-of" lang="es">[[:deber#Spanish|deber]]</span>
|-
! rowspan="2" class="roa-indicative-left-rail" | <span title="indicativo">indicative</span>
! class="roa-native-person-number-header" |
|-
! class="roa-finite-header" | <span title="presente de indicativo">present</span>
| <span class="Latn form-of" lang="es">[[:debo#Spanish|debo]]</span>
| <span class="Latn form-of" lang="es">[[:debes#Spanish|debes]]</span>
| <span class="Latn form-of" lang="es">[[:debe#Spanish|debe]]</span>
| <span class="Latn form-of" lang="es">[[:debemos#Spanish|debemos]]</span>
| <span class="Latn form-of" lang="es">[[:debéis#Spanish|debéis]]</span>
| <span class="Latn form-of" lang="es">[[:deben#Spanish|deben]]</span>
|}
`;
}
