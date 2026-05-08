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
      expandTemplates: async () => ""
    }
  });

  assert.equal(result.flow, "foreign");
  assert.equal(result.entry.term, "debían");
  assert.equal(result.entry.redirectedFrom, "debian");

  const html = foreignView(result);
  assert.match(html, /<h1>debían<\/h1>/);
  assert.match(html, /redirected from deb<u>i<\/u>an/);
  assert.match(html, /<h3>Verb<\/h3>/);
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

function spanishVerb() {
  return `
==Spanish==
===Verb===
# should
`;
}
