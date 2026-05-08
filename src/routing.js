import { englishSignals, hasEnglishTranslationSubpageReference, parseEnglishEntry, parseEnglishTranslationGroups } from "./english-parser.js";
import { parseForeignEntry } from "./foreign-parser.js";
import { fetchWikitext, hasLanguageSection } from "./wiktionary.js";

export const ENGLISH_RULES = {
  strongDefinitionMinimum: 3,
  someDefinitionMinimum: 2,
  routeToEnglish: new Set(["strong", "some"])
};

export function classifyEnglish(signals) {
  if (!signals.hasEnglish) return "none";
  if (signals.ordinaryDefinitionCount >= ENGLISH_RULES.strongDefinitionMinimum) return "strong";
  if (signals.ordinaryDefinitionCount >= ENGLISH_RULES.someDefinitionMinimum) return "some";
  return "minimal";
}

export async function routeWord({ query, preferredLanguages, selectedLanguage }) {
  const term = query.trim();
  const pageWikitext = await fetchWikitext(term);

  const englishPresence = classifyEnglish(englishSignals(pageWikitext));

  if (ENGLISH_RULES.routeToEnglish.has(englishPresence)) {
    const mainTranslationGroups = parseEnglishTranslationGroups(pageWikitext);
    const needsTranslationSubpage = hasEnglishTranslationSubpageReference(pageWikitext);
    const translationSources = needsTranslationSubpage
      ? [pageWikitext, await fetchWikitext(`${term}/translations`)]
      : [pageWikitext];

    return {
      kind: "entry",
      flow: "english",
      englishPresence,
      entry: parseEnglishEntry(term, pageWikitext, translationSources)
    };
  }

  const availableLanguages = preferredLanguages.filter((language) => hasLanguageSection(pageWikitext, language));
  if (selectedLanguage && !availableLanguages.includes(selectedLanguage)) {
    throw new Error(`${selectedLanguage} section not available for ${term}`);
  }

  const selected = selectedLanguage || availableLanguages[0];

  if (!selected) return { kind: "none", term, englishPresence };

  return {
    kind: "entry",
    flow: "foreign",
    englishPresence,
    entry: parseForeignEntry(term, pageWikitext, selected),
    availableLanguages,
    nextLanguage: availableLanguages[availableLanguages.indexOf(selected) + 1] || ""
  };
}
