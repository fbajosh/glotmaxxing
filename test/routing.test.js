import test from "node:test";
import assert from "node:assert/strict";
import { routeWord } from "../src/routing.js";

const PREFERRED_LANGUAGES = ["Spanish", "Portuguese", "French", "Italian"];
const WORD_POOLS = {
  noun: ["house", "cloud", "water", "book", "city", "hand", "river", "road"],
  verb: ["run", "eat", "sleep", "write", "read", "walk", "build", "carry"],
  adjective: ["good", "bad", "old", "new", "small", "large", "cold", "clear"],
  adverb: ["well", "here", "there", "often", "always", "never", "soon", "then"]
};

test("random common English words route to English across parts of speech", async (t) => {
  for (const [expectedPart, words] of Object.entries(WORD_POOLS)) {
    const word = words[Math.floor(Math.random() * words.length)];

    await t.test(`${expectedPart}: ${word}`, async () => {
      const result = await routeWord({
        query: word,
        preferredLanguages: PREFERRED_LANGUAGES,
        selectedLanguage: ""
      });

      assert.equal(result.flow, "english", `${word} routed to ${result.flow}`);
      assert.match(result.englishPresence, /^(strong|some)$/, `${word} classified as ${result.englishPresence}`);

      const group = result.entry.translationGroups.find((item) => item.pos === expectedPart);
      assert.ok(group, `${word} did not parse a ${expectedPart} translation group`);
      assert.ok(
        group.senses.some((sense) =>
          PREFERRED_LANGUAGES.some((language) => sense.translations[language]?.length)
        ),
        `${word} has no preferred-language translations in its ${expectedPart} group`
      );
    });
  }
});
