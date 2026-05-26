import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuery, queryFromParams } from "../src/query.js";
import { routeWord } from "../src/routing.js";

test("query normalization strips trailing spaces", () => {
  assert.equal(normalizeQuery("lima   "), "lima");
  assert.equal(queryFromParams(new URLSearchParams("q=lima%20%20")), "lima");
});

test("routing uses normalized query for lookup", async () => {
  const result = await routeWord({
    query: "lima   ",
    preferredLanguages: ["Spanish"],
    selectedLanguage: "",
    tools: {
      fetchWikitext: async (title) => {
        assert.equal(title, "lima");
        return `
==Spanish==
===Noun===
# file
`;
      },
      searchTitles: async () => {
        throw new Error("Search should not run");
      },
      expandTemplates: async () => ""
    }
  });

  assert.equal(result.flow, "foreign");
  assert.equal(result.entry.term, "lima");
});
