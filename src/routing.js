import { englishSignals, hasEnglishTranslationSubpageReference, parseEnglishEntry, parseEnglishTranslationGroups } from "./english-parser.js";
import { resolveForeignEntry } from "./foreign-parser.js?v=missing-search-20260508";
import { expandTemplates, fetchWikitext, hasLanguageSection, isMissingTitle, searchTitles } from "./wiktionary.js?v=missing-search-20260508";

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

export async function routeWord({ query, preferredLanguages, selectedLanguage, tools = {} }) {
  const api = { fetchWikitext, expandTemplates, searchTitles, ...tools };
  const requestedTerm = query.trim();
  const lookup = await lookupWikitext(requestedTerm, preferredLanguages, api);
  const term = lookup.term;
  const pageWikitext = lookup.wikitext;

  const englishPresence = classifyEnglish(englishSignals(pageWikitext));

  if (!lookup.redirectedFrom && ENGLISH_RULES.routeToEnglish.has(englishPresence)) {
    const mainTranslationGroups = parseEnglishTranslationGroups(pageWikitext);
    const needsTranslationSubpage = hasEnglishTranslationSubpageReference(pageWikitext);
    const translationSources = needsTranslationSubpage
      ? [pageWikitext, await api.fetchWikitext(`${term}/translations`)]
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
    entry: redirectedEntry(
      await resolveForeignEntry(term, pageWikitext, selected, api),
      lookup.redirectedFrom
    ),
    availableLanguages,
    nextLanguage: availableLanguages[availableLanguages.indexOf(selected) + 1] || ""
  };
}

async function lookupWikitext(term, preferredLanguages, api) {
  try {
    return { term, wikitext: await api.fetchWikitext(term), redirectedFrom: "" };
  } catch (error) {
    if (!isMissingTitle(error)) throw error;
  }

  const titles = await api.searchTitles(term, 8);
  for (const title of titles) {
    const wikitext = await candidateWikitext(title, api);
    if (!wikitext) continue;
    if (preferredLanguages.some((language) => hasLanguageSection(wikitext, language))) {
      return { term: title, wikitext, redirectedFrom: term };
    }
  }

  throw new Error("No result");
}

async function candidateWikitext(title, api) {
  try {
    return await api.fetchWikitext(title);
  } catch (error) {
    if (isMissingTitle(error)) return "";
    throw error;
  }
}

function redirectedEntry(entry, redirectedFrom) {
  return redirectedFrom ? { ...entry, redirectedFrom } : entry;
}
